import json, struct, numpy as np

with open('scripts/female_model.glb', 'rb') as f:
    f.seek(12)
    chunk_len = int.from_bytes(f.read(4), 'little')
    f.seek(20)
    gltf = json.loads(f.read(chunk_len).decode('utf-8'))
    f.seek(20 + chunk_len)
    bin_len, bin_type = struct.unpack('<II', f.read(8))
    bin_bytes = f.read(bin_len)

# Mesh 2 is Female_Sculpt_Material_0002
prim = gltf['meshes'][2]['primitives'][0]
pos_acc = gltf['accessors'][prim['attributes']['POSITION']]
pos_view = gltf['bufferViews'][pos_acc['bufferView']]
offset = pos_view.get('byteOffset', 0) + pos_acc.get('byteOffset', 0)
count = pos_acc['count']
verts = np.frombuffer(bin_bytes, dtype=np.float32, count=count*3, offset=offset).reshape(-1, 3)

# Node 4 transform: scale = [100, 100, 100], rot = [-0.7071068, 0, 0, 0.7071066] (which is -90 deg X)
# World coordinate Y = verts[:, 2] * 100 * 0.45, X = verts[:, 0] * 100 * 0.45, Z = -verts[:, 1] * 100 * 0.45
world_y = verts[:, 2] * 45.0
world_x = verts[:, 0] * 45.0
world_z = -verts[:, 1] * 45.0

print(f"Total vertices in mesh 2: {count}")
print(f"World Y range: {world_y.min():.1f} to {world_y.max():.1f}")
print(f"World X range: {world_x.min():.1f} to {world_x.max():.1f}")
print(f"World Z range: {world_z.min():.1f} to {world_z.max():.1f}")

# Width of body at various Y heights
for y_test in range(600, 1300, 50):
    mask = (world_y >= y_test - 15) & (world_y <= y_test + 15)
    if np.any(mask):
        xs = world_x[mask]
        zs = world_z[mask]
        width = xs.max() - xs.min()
        depth = zs.max() - zs.min()
        z_back = zs.max()
        z_front = zs.min()
        print(f"Y={y_test:4d}mm: Width={width:5.1f}mm, Depth={depth:5.1f}mm, Z_back={z_back:5.1f}mm, Z_front={z_front:5.1f}mm")
