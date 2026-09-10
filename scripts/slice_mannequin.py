import trimesh
import numpy as np

scene = trimesh.load('scripts/female_model.glb')

# Find node for Female Sculpt_Material_0.002
geom_name = 'Female Sculpt_Material_0.002'
geom = scene.geometry[geom_name]

# Get the world transform matrix for this geometry
transform, _ = scene.graph.get(geom_name)
print("Transform matrix:\n", transform)

# Apply transform to duplicate of geometry so it is in world coordinates
mesh = geom.copy()
mesh.apply_transform(transform)

print("World bounds:\n", mesh.bounds)
# World bounds:
# X is width: ~ -592 to 592
# Y is height: ~ 0 to 1920
# Z is depth: ~ -186 to 147

# The torso region:
# Height (Y): Waist at Y ~ 1080 mm, Thighs at Y ~ 680 mm
# Width (X): Exclude hands/arms (|X| > 210 mm at Y ~ 1000)

print(f"Original mesh: {len(mesh.vertices)} verts, {len(mesh.faces)} faces")

# Slice plane 1: Cut off above waist
sliced_top = trimesh.intersections.slice_mesh_plane(
    mesh,
    plane_normal=[0, -1, 0], # keep below 1070
    plane_origin=[0, 1070, 0],
    cap=False
)
print(f"After cutting top: {len(sliced_top.vertices)} verts, {len(sliced_top.faces)} faces, bounds Y: [{sliced_top.bounds[0][1]:.1f}, {sliced_top.bounds[1][1]:.1f}]")

# Slice plane 2: Cut off below thighs
mannequin = trimesh.intersections.slice_mesh_plane(
    sliced_top,
    plane_normal=[0, 1, 0], # keep above 680
    plane_origin=[0, 680, 0],
    cap=False
)
print(f"After cutting bottom: {len(mannequin.vertices)} verts, {len(mannequin.faces)} faces, bounds Y: [{mannequin.bounds[0][1]:.1f}, {mannequin.bounds[1][1]:.1f}]")

# Filter out disconnected hands/arms components if any
components = mannequin.split(only_watertight=False)
print(f"Split into {len(components)} connected components:")
for i, comp in enumerate(components):
    print(f"  Component {i}: {len(comp.vertices)} verts, bounds X:[{comp.bounds[0][0]:.1f}, {comp.bounds[1][0]:.1f}], Y:[{comp.bounds[0][1]:.1f}, {comp.bounds[1][1]:.1f}], Z:[{comp.bounds[0][2]:.1f}, {comp.bounds[1][2]:.1f}]")
