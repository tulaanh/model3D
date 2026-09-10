import trimesh
import numpy as np
from scipy.spatial import cKDTree

def generate_short_leg_prominent_cleft_torso():
    print('Starting short-legs prominent-cleft mannequin generator...')
    s = trimesh.load('scripts/kirika/Kirika Bikini.obj')
    body = s.geometry['Body.001']
    bikini = s.geometry['水着.001']

    rot180 = trimesh.transformations.rotation_matrix(np.pi, [0, 1, 0])
    body.apply_transform(rot180)
    bikini.apply_transform(rot180)

    # 1. Torso body: high density, Taubin smoothed, short legs
    rough_body = trimesh.intersections.slice_mesh_plane(body, plane_normal=[0, -1, 0], plane_origin=[0, 1.10, 0])
    rough_body = trimesh.intersections.slice_mesh_plane(rough_body, plane_normal=[0, 1, 0], plane_origin=[0, 0.48, 0])

    arm_mask = (np.abs(rough_body.vertices[:, 0]) > 0.165) & (rough_body.vertices[:, 1] > 0.65)
    face_mask = (~arm_mask)[rough_body.faces].all(axis=1)
    rough_body = rough_body.submesh([face_mask], append=True)

    v1, f1 = trimesh.remesh.subdivide(rough_body.vertices, rough_body.faces)
    v2, f2 = trimesh.remesh.subdivide(v1, f1)
    v3, f3 = trimesh.remesh.subdivide(v2, f2)
    body3 = trimesh.Trimesh(vertices=v3, faces=f3, process=True)
    trimesh.smoothing.filter_taubin(body3, lamb=0.5, nu=-0.53, iterations=40)

    y_top = 1.045
    y_bot = 0.68  # Chic short upper-thigh cut
    torso_final = trimesh.intersections.slice_mesh_plane(body3, plane_normal=[0, -1, 0], plane_origin=[0, y_top, 0])
    torso_final = trimesh.intersections.slice_mesh_plane(torso_final, plane_normal=[0, 1, 0], plane_origin=[0, y_bot, 0])

    # Bikini: slice only at top 0.96 (preserves natural lower leg openings)
    bikini_cut = trimesh.intersections.slice_mesh_plane(bikini, plane_normal=[0, -1, 0], plane_origin=[0, 0.96, 0])

    # Coordinate Normalization
    min_y = torso_final.vertices[:, 1].min()
    torso_final.vertices[:, 1] -= min_y
    bikini_cut.vertices[:, 1] -= min_y

    center_x = (torso_final.bounds[0][0] + torso_final.bounds[1][0]) / 2.0
    center_z = (torso_final.bounds[0][2] + torso_final.bounds[1][2]) / 2.0
    torso_final.vertices[:, 0] -= center_x
    torso_final.vertices[:, 2] -= center_z
    bikini_cut.vertices[:, 0] -= center_x
    bikini_cut.vertices[:, 2] -= center_z

    scale = 0.50 / (torso_final.bounds[1][1] - torso_final.bounds[0][1])
    torso_final.apply_scale(scale)
    bikini_cut.apply_scale(scale)

    # Subdivide bikini twice for smooth fabric
    vb1, fb1 = trimesh.remesh.subdivide(bikini_cut.vertices, bikini_cut.faces)
    b1 = trimesh.Trimesh(vertices=vb1, faces=fb1, process=False)
    vb2, fb2 = trimesh.remesh.subdivide(b1.vertices, b1.faces)
    b_dense = trimesh.Trimesh(vertices=vb2, faces=fb2, process=False)

    # === STEP 1: ACCENTUATE INTERGLUTEAL CLEFT (KHE MONG) ON TORSO BODY ===
    vb = torso_final.vertices.copy()
    y_mid = 0.24
    y_half = 0.11
    y_factor = np.clip(1.0 - ((vb[:, 1] - y_mid) / y_half)**2, 0.0, 1.0)
    sigma_x = 0.016
    x_factor = np.exp(-(vb[:, 0] / sigma_x)**2)
    z_mask = (vb[:, 2] > 0.04) & (vb[:, 1] > 0.13) & (vb[:, 1] < 0.36)

    cleft_depth_body = 0.016 # 16mm deep definition
    delta_z_body = cleft_depth_body * y_factor * x_factor * z_mask
    vb[:, 2] -= delta_z_body
    torso_final.vertices = vb

    # Recompute smooth normals
    torso_final.vertex_normals

    # === STEP 2: CONFORM BIKINI DEEP INTO THE CLEFT (NO TENTING / BRIDGING) ===
    vk = b_dense.vertices.copy()
    vk_y_factor = np.clip(1.0 - ((vk[:, 1] - y_mid) / y_half)**2, 0.0, 1.0)
    vk_x_factor = np.exp(-(vk[:, 0] / sigma_x)**2)
    vk_z_mask = (vk[:, 2] > 0.04) & (vk[:, 1] > 0.13) & (vk[:, 1] < 0.36)

    # Pre-sink bikini into cleft valley so it hugs the crease tightly
    delta_z_bikini = 0.020 * vk_y_factor * vk_x_factor * vk_z_mask
    vk[:, 2] -= delta_z_bikini

    tree = cKDTree(torso_final.vertices)
    dists, idxs = tree.query(vk)
    disp = vk - torso_final.vertices[idxs]
    n = torso_final.vertex_normals[idxs]
    signed_dist = np.sum(disp * n, axis=1)

    target_clearance = 0.0018
    push = np.maximum(0.0, target_clearance - signed_dist)
    is_buttock = (vk[:, 2] > 0.01) & (vk[:, 1] > 0.15) & (vk[:, 1] < 0.33)
    pull = np.where(is_buttock & (signed_dist > target_clearance), (target_clearance - signed_dist) * 0.70, 0.0)

    vk += n * (push + pull)[:, None]
    b_dense.vertices = vk

    # === STEP 3: BAKE CAVITY CREASE SHADING (VERTEX COLORS) ===
    # Torso body vertex colors
    body_colors = np.ones((len(torso_final.vertices), 4), dtype=np.uint8) * 255
    cleft_intensity_body = (y_factor * x_factor * z_mask)
    for i in range(len(body_colors)):
        factor = cleft_intensity_body[i]
        if factor > 0.02:
            darkness = 1.0 - 0.28 * factor
            r = int(np.clip(255 * darkness, 0, 255))
            g = int(np.clip(255 * (darkness * 0.96 + 0.04), 0, 255))
            b = int(np.clip(255 * (darkness * 0.93 + 0.07), 0, 255))
            body_colors[i] = [r, g, b, 255]
    torso_final.visual.vertex_colors = body_colors

    # Bikini vertex colors (subtle natural crease depth)
    bikini_colors = np.ones((len(b_dense.vertices), 4), dtype=np.uint8) * 255
    cleft_intensity_bikini = (vk_y_factor * vk_x_factor * vk_z_mask)
    for i in range(len(bikini_colors)):
        factor = cleft_intensity_bikini[i]
        if factor > 0.02:
            darkness = 1.0 - 0.26 * factor
            val = int(np.clip(255 * darkness, 0, 255))
            bikini_colors[i] = [val, val, val, 255]
    b_dense.visual.vertex_colors = bikini_colors

    # === STEP 4: GENERATE EXACT BOUNDARY PLANAR CAPS ===
    H = torso_final.bounds[1][1]

    def make_exact_boundary_cap(torso_mesh, target_y, is_left=None, normal_down=True, n_samples=128):
        mask = np.abs(torso_mesh.vertices[:, 1] - target_y) < 1e-4
        pts = torso_mesh.vertices[mask]
        if is_left is True:
            pts = pts[pts[:, 0] < -0.005]
        elif is_left is False:
            pts = pts[pts[:, 0] > 0.005]
        
        xc = pts[:, 0].mean()
        zc = pts[:, 2].mean()
        angles = np.arctan2(pts[:, 2] - zc, pts[:, 0] - xc)
        order = np.argsort(angles)
        pts_sorted = pts[order]
        
        sample_angles = np.linspace(-np.pi, np.pi, n_samples, endpoint=False)
        radii = np.hypot(pts_sorted[:, 0] - xc, pts_sorted[:, 2] - zc)
        ang_sorted = angles[order]
        
        r_interp = np.interp(sample_angles, ang_sorted, radii, period=2*np.pi)
        cap_v = [[xc, target_y, zc]]
        for th, r in zip(sample_angles, r_interp):
            cap_v.append([xc + r * np.cos(th), target_y, zc + r * np.sin(th)])
        cap_f = []
        for i in range(n_samples):
            next_i = (i + 1) % n_samples
            if normal_down:
                cap_f.append([0, 1 + i, 1 + next_i])
            else:
                cap_f.append([0, 1 + next_i, 1 + i])
        
        cap_mesh = trimesh.Trimesh(vertices=cap_v, faces=cap_f)
        cap_mesh.visual.vertex_colors = np.ones((len(cap_v), 4), dtype=np.uint8) * 255
        return cap_mesh

    top_cap = make_exact_boundary_cap(torso_final, H, normal_down=False)
    left_cap = make_exact_boundary_cap(torso_final, 0.0, is_left=True, normal_down=True)
    right_cap = make_exact_boundary_cap(torso_final, 0.0, is_left=False, normal_down=True)

    caps = trimesh.util.concatenate([top_cap, left_cap, right_cap])
    final_body = trimesh.util.concatenate([torso_final, caps])

    # Two-tier turntable pedestal
    rot_to_y = trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0])
    p1 = trimesh.creation.cylinder(radius=0.28, height=0.03, sections=64)
    p1.apply_transform(rot_to_y)
    p1.vertices[:, 1] -= 0.015

    p2 = trimesh.creation.cylinder(radius=0.32, height=0.03, sections=64)
    p2.apply_transform(rot_to_y)
    p2.vertices[:, 1] -= (0.015 + 0.03)

    pedestal = trimesh.util.concatenate([p1, p2])

    scene = trimesh.Scene()
    scene.add_geometry(final_body, node_name='TorsoBody', geom_name='TorsoBody')
    scene.add_geometry(b_dense, node_name='BikiniThong', geom_name='BikiniThong')
    scene.add_geometry(pedestal, node_name='Pedestal', geom_name='Pedestal')

    scene.export('public/models/bikini_torso.glb')
    print('=== SHORT LEGS & PROMINENT CLEFT GLB EXPORTED ===')
    print(f'Body verts: {len(final_body.vertices)}, faces: {len(final_body.faces)}')
    print(f'Bikini verts: {len(b_dense.vertices)}, faces: {len(b_dense.faces)}')
    print('Torso bounds:\n', final_body.bounds)
    print('Bikini bounds:\n', b_dense.bounds)

if __name__ == '__main__':
    generate_short_leg_prominent_cleft_torso()