import trimesh

scene = trimesh.load('public/models/avatar.vrm', file_type='glb')
print("Geometries in avatar.vrm:")
for name, g in scene.geometry.items():
    print(f"'{name}': {len(g.vertices)} verts, bounds: {g.bounds}")
