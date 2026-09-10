import trimesh
import numpy as np

mesh = trimesh.load('public/models/torso_mannequin.glb', force='mesh')
print(f"Mannequin: {len(mesh.vertices)} verts, {len(mesh.faces)} faces")
print("Bounds:", mesh.bounds)

# Check protrusion:
# In human body, the buttocks are on one side (Z+ or Z-)
# Let's check where the cleft/cheeks are
y_mid = (mesh.bounds[0][1] + mesh.bounds[1][1]) / 2.0
hip_mask = (mesh.vertices[:, 1] >= y_mid - 0.15) & (mesh.vertices[:, 1] <= y_mid + 0.1)
hip_verts = mesh.vertices[hip_mask]

z_max_verts = hip_verts[hip_verts[:, 2] > 0.15]
z_min_verts = hip_verts[hip_verts[:, 2] < -0.15]
print(f"Points with Z > 0.15: {len(z_max_verts)}")
print(f"Points with Z < -0.15: {len(z_min_verts)}")

if len(z_max_verts) > len(z_min_verts):
    print("Z+ is the buttocks (back), Z- is the abdomen (front)")
else:
    print("Z- is the buttocks (back), Z+ is the abdomen (front)")
