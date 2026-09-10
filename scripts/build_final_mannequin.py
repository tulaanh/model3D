import trimesh
import numpy as np

# 1. Load the sliced torso submesh
mesh = trimesh.load('public/models/torso_mannequin.glb', force='mesh')

# Rotate 180 degrees around Y so Buttocks is facing +Z (towards rear camera)
# and front abdomen is -Z
rot_y_180 = trimesh.transformations.rotation_matrix(np.pi, [0, 1, 0])
mesh.apply_transform(rot_y_180)

# Re-center slightly so thighs rest on ground / turntable
bounds = mesh.bounds
mesh.vertices[:, 1] -= bounds[0][1] # bottom of thighs at Y = 0
mesh.vertices[:, 0] -= (bounds[0][0] + bounds[1][0]) / 2.0
mesh.vertices[:, 2] -= (bounds[0][2] + bounds[1][2]) / 2.0

# 2. Add Flat Mannequin Caps at Top and Bottom Cuts
# Top cut: all boundary edges near Y = bounds[1][1]
y_top = mesh.bounds[1][1]
y_bottom = 0.0

# Top cap: an elliptical disk capping the waist
cap_top_verts = []
cap_top_faces = []
n_pts = 64
# Find waist boundary vertices
top_mask = mesh.vertices[:, 1] > y_top - 0.015
top_pts = mesh.vertices[top_mask]
rx_top = np.abs(top_pts[:, 0]).max() * 0.98
rz_top = np.abs(top_pts[:, 2]).max() * 0.98

center_top_idx = len(mesh.vertices)
cap_top_verts.append([0.0, y_top, 0.0])

for i in range(n_pts):
    theta = i * 2.0 * np.pi / n_pts
    px = rx_top * np.cos(theta)
    pz = rz_top * np.sin(theta)
    cap_top_verts.append([px, y_top, pz])

for i in range(n_pts):
    p1 = center_top_idx
    p2 = center_top_idx + 1 + i
    p3 = center_top_idx + 1 + ((i + 1) % n_pts)
    cap_top_faces.append([p1, p3, p2]) # normal pointing up +Y

# Bottom caps: 2 disks for left and right thighs
# Left thigh: X < 0, Right thigh: X > 0
bot_mask = mesh.vertices[:, 1] < y_bottom + 0.015
bot_pts = mesh.vertices[bot_mask]

left_thigh_pts = bot_pts[bot_pts[:, 0] < -0.02]
right_thigh_pts = bot_pts[bot_pts[:, 0] > 0.02]

def make_thigh_cap(pts, start_idx, normal_down=True):
    x_c = pts[:, 0].mean()
    z_c = pts[:, 2].mean()
    rx = np.abs(pts[:, 0] - x_c).max() * 0.95
    rz = np.abs(pts[:, 2] - z_c).max() * 0.95
    
    verts = [[x_c, y_bottom, z_c]]
    for i in range(n_pts):
        th = i * 2.0 * np.pi / n_pts
        verts.append([x_c + rx * np.cos(th), y_bottom, z_c + rz * np.sin(th)])
        
    faces = []
    for i in range(n_pts):
        p1 = start_idx
        p2 = start_idx + 1 + i
        p3 = start_idx + 1 + ((i + 1) % n_pts)
        if normal_down:
            faces.append([p1, p2, p3]) # normal pointing down -Y
        else:
            faces.append([p1, p3, p2])
    return verts, faces

curr_len = len(mesh.vertices) + len(cap_top_verts)
left_verts, left_faces = make_thigh_cap(left_thigh_pts, curr_len)
curr_len += len(left_verts)
right_verts, right_faces = make_thigh_cap(right_thigh_pts, curr_len)

all_cap_verts = np.array(cap_top_verts + left_verts + right_verts, dtype=np.float32)
all_cap_faces = np.array(cap_top_faces + left_faces + right_faces, dtype=np.int32)

combined_verts = np.vstack([mesh.vertices, all_cap_verts])
combined_faces = np.vstack([mesh.faces, all_cap_faces])

mannequin_body = trimesh.Trimesh(vertices=combined_verts, faces=combined_faces, process=True)
mannequin_body.visual = trimesh.visual.ColorVisuals(mannequin_body)

# 3. Create Conformal Bikini Thong Mesh
# Identify faces belonging to bikini thong:
# Height range of panties: Y in [0.35 * total_h, 0.65 * total_h]
h = y_top - y_bottom
# Normalized Y from 0 to 1
v_y_norm = mannequin_body.vertices[:, 1] / h
v_x = mannequin_body.vertices[:, 0]
v_z = mannequin_body.vertices[:, 2]

# Criteria for bikini vertex:
# 1. Waistband string circling hips: Y_norm in [0.56, 0.63]
waistband = (v_y_norm >= 0.56) & (v_y_norm <= 0.63)

# 2. Back Thong: Z > 0, Y_norm in [0.28, 0.63]
# Width tapers down from 0.09 at top to 0.025 at bottom
t_back = (v_y_norm - 0.28) / (0.63 - 0.28)
w_back = 0.028 + t_back * 0.085
back_thong = (v_z > 0) & (v_y_norm >= 0.28) & (v_y_norm <= 0.63) & (np.abs(v_x) <= w_back)

# 3. Front Triangle: Z < 0, Y_norm in [0.28, 0.63]
t_front = (v_y_norm - 0.28) / (0.63 - 0.28)
w_front = 0.035 + t_front * 0.095
front_triangle = (v_z < 0) & (v_y_norm >= 0.28) & (v_y_norm <= 0.63) & (np.abs(v_x) <= w_front)

# 4. Crotch Gusset: Y_norm in [0.25, 0.32], |X| <= 0.035
crotch = (v_y_norm >= 0.25) & (v_y_norm <= 0.32) & (np.abs(v_x) <= 0.035)

bikini_vertex_mask = waistband | back_thong | front_triangle | crotch
bikini_face_mask = bikini_vertex_mask[mannequin_body.faces].all(axis=1)

bikini_mesh = mannequin_body.submesh([bikini_face_mask], append=True)

# Offset bikini along vertex normals by 0.003m so it sits cleanly on top of skin without clipping
bikini_mesh.vertices += bikini_mesh.vertex_normals * 0.0035

# 4. Circular Turntable Pedestal
pedestal = trimesh.creation.cylinder(radius=0.48, height=0.07, sections=64)
# Bevel the top of pedestal slightly by lowering center
pedestal.vertices[:, 1] -= 0.035 # sits just below mannequin feet at Y=0

# Create a clean combined Scene with separate named nodes:
# 'TorsoBody', 'BikiniThong', 'Pedestal'
scene = trimesh.Scene()
scene.add_geometry(mannequin_body, node_name='TorsoBody', geom_name='TorsoBody')
scene.add_geometry(bikini_mesh, node_name='BikiniThong', geom_name='BikiniThong')
scene.add_geometry(pedestal, node_name='Pedestal', geom_name='Pedestal')

scene.export('public/models/torso_mannequin.glb')
print(f"Exported final torso_mannequin.glb successfully!")
print(f"Body: {len(mannequin_body.vertices)} verts, Bikini: {len(bikini_mesh.vertices)} verts, Pedestal: {len(pedestal.vertices)} verts")
