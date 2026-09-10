import trimesh
import numpy as np

scene = trimesh.load('scripts/female_model.glb')
geom_name = 'Female Sculpt_Material_0.002'
geom = scene.geometry[geom_name]
transform, _ = scene.graph.get(geom_name)

mesh = geom.copy()
mesh.apply_transform(transform)

# Filter vertices directly: Keep only the Torso!
# Y in [660, 1080], X in [-220, 220]
# Let's find which faces have all 3 vertices inside this bounding box!
mask_v = (mesh.vertices[:, 1] >= 660) & (mesh.vertices[:, 1] <= 1080) & (np.abs(mesh.vertices[:, 0]) <= 220)
face_mask = mask_v[mesh.faces].all(axis=1)

torso_submesh = mesh.submesh([face_mask], append=True)
print(f"Torso submesh: {len(torso_submesh.vertices)} verts, {len(torso_submesh.faces)} faces")
print("Bounds:\n", torso_submesh.bounds)

# Export to OBJ / GLB
# Center at 0 and scale to 0.8m height
bounds = torso_submesh.bounds
x_mid = (bounds[0][0] + bounds[1][0]) / 2.0
y_mid = (bounds[0][1] + bounds[1][1]) / 2.0
z_mid = (bounds[0][2] + bounds[1][2]) / 2.0

torso_submesh.vertices[:, 0] -= x_mid
torso_submesh.vertices[:, 1] -= y_mid
torso_submesh.vertices[:, 2] -= z_mid

height = bounds[1][1] - bounds[0][1]
scale = 0.85 / height
torso_submesh.vertices *= scale

print("Centered & scaled bounds (m):", torso_submesh.bounds)
torso_submesh.export('public/models/torso_mannequin.glb')
print("Successfully exported public/models/torso_mannequin.glb!")
