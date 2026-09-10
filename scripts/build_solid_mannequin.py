import trimesh
import numpy as np

def build_solid_mannequin():
    Ny = 90
    Ntheta = 100
    
    y_vals = np.linspace(0.0, 0.82, Ny)
    theta_vals = np.linspace(0, 2 * np.pi, Ntheta + 1) # Ntheta + 1 to include 2pi for UV seam
    
    body_verts = []
    body_uvs = []
    body_faces = []
    
    # 1. Generate Torso Body Surface
    for iy, y in enumerate(y_vals):
        v = iy / (Ny - 1)
        
        # Profile radii
        if y > 0.62:
            t = (y - 0.62) / (0.82 - 0.62)
            rx = 0.22 * (1.0 - t * 0.16)
            rz_front = 0.13 * (1.0 - t * 0.12)
            rz_back = 0.13 * (1.0 - t * 0.18)
        elif y > 0.32:
            t = (y - 0.32) / (0.62 - 0.32)
            hip_flare = np.sin(t * np.pi) * 0.065
            rx = 0.22 + hip_flare
            rz_front = 0.13 + t * 0.015
            butt_curve = np.sin(t * np.pi) * 0.105
            rz_back = 0.13 + butt_curve
        else:
            t = y / 0.32
            rx = 0.19 + t * 0.03
            rz_front = 0.12 + t * 0.01
            rz_back = 0.12 + t * 0.01
            
        for itheta, theta in enumerate(theta_vals):
            u = itheta / Ntheta
            
            cos_t = np.cos(theta)
            sin_t = np.sin(theta)
            
            rz = rz_back if sin_t >= 0 else rz_front
            px = rx * cos_t
            pz = rz * sin_t
            
            # Anatomy Sculpting
            if sin_t > 0.04 and y > 0.28 and y < 0.68:
                butt_h = np.exp(-((y - 0.47) / 0.14)**2)
                dist_lobe = (abs(px) - 0.095) / 0.09
                lobe_shape = np.exp(-dist_lobe**2)
                butt_pop = 0.075 * butt_h * lobe_shape * (sin_t**1.4)
                pz += butt_pop
                cleft = 0.06 * butt_h * np.exp(-((px / 0.032)**2)) * (sin_t**2)
                pz -= cleft
                if y < 0.38:
                    fold = np.exp(-((y - 0.34) / 0.045)**2) * (sin_t**2)
                    pz -= 0.025 * fold
            if sin_t > 0.2 and y > 0.64:
                spine = 0.015 * np.exp(-((px / 0.025)**2)) * ((y - 0.64) / 0.18)
                pz -= spine
            if y < 0.34:
                thigh_depth = (0.34 - y) / 0.34
                inner_gap = 0.045 * thigh_depth * np.exp(-((px / 0.038)**2))
                if sin_t >= 0:
                    pz -= inner_gap * 1.1
                else:
                    pz += inner_gap * 0.85
                if abs(px) < 0.048:
                    pinch = (1.0 - abs(px) / 0.048) * 0.03 * thigh_depth
                    if sin_t >= 0:
                        pz = max(0.012, pz - pinch)
                    else:
                        pz = min(-0.012, pz + pinch)
                        
            body_verts.append([px, y, pz])
            body_uvs.append([u, v])
            
    # Surface Quad Faces
    row_verts = Ntheta + 1
    for iy in range(Ny - 1):
        for itheta in range(Ntheta):
            p1 = iy * row_verts + itheta
            p2 = iy * row_verts + (itheta + 1)
            p3 = (iy + 1) * row_verts + (itheta + 1)
            p4 = (iy + 1) * row_verts + itheta
            
            body_faces.append([p1, p3, p2])
            body_faces.append([p1, p4, p3])
            
    # 2. Add Watertight Top Waist Cap
    top_start_idx = len(body_verts)
    body_verts.append([0.0, 0.82, 0.0]) # center vertex
    body_uvs.append([0.5, 1.0])
    
    top_ring_start = (Ny - 1) * row_verts
    for itheta in range(Ntheta):
        p1 = top_start_idx
        p2 = top_ring_start + itheta
        p3 = top_ring_start + (itheta + 1)
        body_faces.append([p1, p3, p2])
        
    # 3. Add Watertight Bottom Dual Thigh Caps
    bot_verts = np.array(body_verts[:row_verts])
    
    left_mask = np.where(bot_verts[:, 0] < 0)[0]
    left_center = bot_verts[left_mask].mean(axis=0)
    left_c_idx = len(body_verts)
    body_verts.append([left_center[0], 0.0, left_center[2]])
    body_uvs.append([0.25, 0.0])
    
    for i in range(len(left_mask) - 1):
        p2 = left_mask[i]
        p3 = left_mask[i + 1]
        body_faces.append([left_c_idx, p2, p3])
        
    right_mask = np.where(bot_verts[:, 0] > 0)[0]
    right_center = bot_verts[right_mask].mean(axis=0)
    right_c_idx = len(body_verts)
    body_verts.append([right_center[0], 0.0, right_center[2]])
    body_uvs.append([0.75, 0.0])
    
    for i in range(len(right_mask) - 1):
        p2 = right_mask[i]
        p3 = right_mask[i + 1]
        body_faces.append([right_c_idx, p2, p3])

    visuals = trimesh.visual.TextureVisuals(uv=np.array(body_uvs, dtype=np.float32))
    mannequin_mesh = trimesh.Trimesh(
        vertices=np.array(body_verts, dtype=np.float32),
        faces=np.array(body_faces, dtype=np.int32),
        visual=visuals,
        process=False
    )
    
    print(f"Mannequin: {len(mannequin_mesh.vertices)} verts, {len(mannequin_mesh.faces)} faces")
    print(f"Bounds: {mannequin_mesh.bounds}")
    
    pedestal = trimesh.creation.cylinder(radius=0.38, height=0.06, sections=64)
    pedestal.vertices[:, 1] -= 0.03
    
    scene = trimesh.Scene()
    scene.add_geometry(mannequin_mesh, node_name='SolidMannequin', geom_name='SolidMannequin')
    scene.add_geometry(pedestal, node_name='Pedestal', geom_name='Pedestal')
    
    scene.export('public/models/solid_mannequin.glb')
    print("Exported public/models/solid_mannequin.glb successfully!")

if __name__ == '__main__':
    build_solid_mannequin()
