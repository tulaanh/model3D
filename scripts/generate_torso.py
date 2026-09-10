import os
import math
import numpy as np

def generate_torso():
    os.makedirs('public/models', exist_ok=True)
    
    # Grid resolution
    Ny = 80
    Ntheta = 90
    
    y_vals = np.linspace(-0.55, 0.45, Ny)
    theta_vals = np.linspace(0, 2 * np.pi, Ntheta, endpoint=False)
    
    vertices = []
    normals = []
    uvs = []
    
    # Generate vertices ring by ring
    for iy, y in enumerate(y_vals):
        v = (y - (-0.55)) / (0.45 - (-0.55))
        
        # Base width (x) and depth (z) profiles along height y
        # Waist at y=0.45, hips widest at y=0.08, thighs below y=-0.2
        if y > 0.15:
            # Waist area
            t = (y - 0.15) / 0.30
            rx = 0.28 * (1.0 - t * 0.18) # narrow waist at top
            rz_front = 0.18 * (1.0 - t * 0.12)
            rz_back = 0.17 * (1.0 - t * 0.20)
        elif y > -0.20:
            # Hips & Buttocks area
            t = (y - (-0.20)) / 0.35
            # Parabolic flare for hips
            hip_flare = math.sin(t * math.pi) * 0.08
            rx = 0.28 + hip_flare
            rz_front = 0.18 + t * 0.02
            # Major buttock projection in back
            butt_curve = math.sin(t * math.pi) * 0.14
            rz_back = 0.17 + butt_curve
        else:
            # Thigh area
            t = (y - (-0.55)) / 0.35
            rx = 0.24 + t * 0.04
            rz_front = 0.16 + t * 0.02
            rz_back = 0.16 + t * 0.01

        for itheta, theta in enumerate(theta_vals):
            u = itheta / Ntheta
            
            # Parametric angle: 0 = +X (right), pi/2 = +Z (back), pi = -X (left), 3pi/2 = -Z (front)
            cos_t = math.cos(theta)
            sin_t = math.sin(theta)
            
            # Separate front vs back radii
            if sin_t >= 0:
                # Back half (buttocks, lower back)
                rz = rz_back
            else:
                # Front half (abdomen, groin)
                rz = rz_front
                
            # Base elliptical coordinate
            px = rx * cos_t
            pz = rz * sin_t
            
            # Anatomy Sculpting:
            # 1. Dual Buttock Cheeks & Intergluteal Cleft (back side, y in [-0.25, 0.25], sin_t > 0)
            if sin_t > 0.05 and y > -0.25 and y < 0.25:
                butt_h = math.exp(-((y - (-0.03)) / 0.15)**2)
                # Left and right lobes peaked around |px| = 0.13
                dist_from_lobe = (abs(px) - 0.13) / 0.12
                lobe_shape = math.exp(-dist_from_lobe**2)
                
                # Protrusion addition
                butt_pop = 0.09 * butt_h * lobe_shape * (sin_t**1.5)
                pz += butt_pop
                
                # Intergluteal Cleft indentation at px = 0
                cleft_indent = 0.07 * butt_h * math.exp(-((px / 0.04)**2)) * (sin_t**2)
                pz -= cleft_indent
                
                # Infragluteal Fold (crease under buttocks near y = -0.18)
                if y < -0.10:
                    fold_factor = math.exp(-((y - (-0.18)) / 0.06)**2) * (sin_t**2)
                    pz -= 0.03 * fold_factor
            
            # 2. Lower Back Spine Crease (y > 0.2, back)
            if sin_t > 0.2 and y > 0.18:
                spine_indent = 0.02 * math.exp(-((px / 0.03)**2)) * ((y - 0.18) / 0.27)
                pz -= spine_indent
                
            # 3. Leg Separation / Thigh Contours (y < -0.15)
            if y < -0.15:
                thigh_depth = (-0.15 - y) / 0.40 # 0 at crotch, 1 at bottom
                # Central gap / inner thigh indentation at x=0
                inner_gap = 0.06 * thigh_depth * math.exp(-((px / 0.045)**2))
                if sin_t >= 0:
                    pz -= inner_gap * 1.2
                else:
                    pz += inner_gap * 0.8
                
                # Thigh cylinder separation
                if abs(px) < 0.06:
                    # Pinch in at center
                    pinch = (1.0 - abs(px) / 0.06) * 0.04 * thigh_depth
                    if sin_t >= 0:
                        pz = max(0.01, pz - pinch)
                    else:
                        pz = min(-0.01, pz + pinch)

            vertices.append((px, y, pz))
            uvs.append((u, v))

    # Compute Faces
    faces = []
    for iy in range(Ny - 1):
        for itheta in range(Ntheta):
            next_theta = (itheta + 1) % Ntheta
            
            p1 = iy * Ntheta + itheta + 1
            p2 = iy * Ntheta + next_theta + 1
            p3 = (iy + 1) * Ntheta + next_theta + 1
            p4 = (iy + 1) * Ntheta + itheta + 1
            
            # Quad as 2 triangles
            faces.append((p1, p2, p3))
            faces.append((p1, p3, p4))
            
    # Write to OBJ file
    with open('public/models/torso.obj', 'w') as f:
        f.write('# Female Lower Torso Mannequin 3D Model\n')
        f.write('o Torso\n')
        for vx, vy, vz in vertices:
            f.write(f'v {vx:.6f} {vy:.6f} {vz:.6f}\n')
        for u, v in uvs:
            f.write(f'vt {u:.6f} {v:.6f}\n')
        for f1, f2, f3 in faces:
            f.write(f'f {f1}/{f1} {f2}/{f2} {f3}/{f3}\n')
            
    print(f'Generated torso.obj: {len(vertices)} vertices, {len(faces)} faces')

if __name__ == '__main__':
    generate_torso()
