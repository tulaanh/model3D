import trimesh
import numpy as np

scene = trimesh.load('scripts/female_model.glb')
geom_name = 'Female Sculpt_Material_0.002'
geom = scene.geometry[geom_name]
transform, _ = scene.graph.get(geom_name)

mesh = geom.copy()
mesh.apply_transform(transform)

# Slice waist at Y=1060 and mid-thighs at Y=680
sliced_top = trimesh.intersections.slice_mesh_plane(
    mesh,
    plane_normal=[0, -1, 0],
    plane_origin=[0, 1060, 0],
    cap=False
)

mannequin = trimesh.intersections.slice_mesh_plane(
    sliced_top,
    plane_normal=[0, 1, 0],
    plane_origin=[0, 680, 0],
    cap=False
)

components = mannequin.split(only_watertight=False)
components.sort(key=lambda c: len(c.vertices), reverse=True)

print("Top 5 largest components:")
for i, comp in enumerate(components[:5]):
    print(f"Comp {i}: {len(comp.vertices)} verts, bounds: X:[{comp.bounds[0][0]:.1f}, {comp.bounds[1][0]:.1f}], Y:[{comp.bounds[0][1]:.1f}, {comp.bounds[1][1]:.1f}], Z:[{comp.bounds[0][2]:.1f}, {comp.bounds[1][2]:.1f}]")

# Save the main torso component
main_torso = components[0]

# Center at (0, 0, 0) and scale to height ~ 0.8 meters
bounds = main_torso.bounds
y_center = (bounds[0][1] + bounds[1][1]) / 2.0
x_center = (bounds[0][0] + bounds[1][0]) / 2.0
z_center = (bounds[0][2] + bounds[1][2]) / 2.0

main_torso.vertices[:, 0] -= x_center
main_torso.vertices[:, 1] -= y_center
main_torso.vertices[:, 2] -= z_center

# Scale from mm to meters
height_mm = bounds[1][1] - bounds[0][1]
scale_factor = 0.85 / height_mm
main_torso.vertices *= scale_factor

print("Final torso bounds (meters):", main_torso.bounds)
main_torso.export('public/models/torso_body.glb')
print("Exported public/models/torso_body.glb successfully!")
