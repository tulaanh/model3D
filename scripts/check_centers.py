import json, struct, numpy as np

with open('scripts/female_model.glb', 'rb') as f:
    f.seek(12)
    chunk_len = int.from_bytes(f.read(4), 'little')
    f.seek(20)
    gltf = json.loads(f.read(chunk_len).decode('utf-8'))
    f.seek(20 + chunk_len)
    bin_len, bin_type = struct.unpack('<II', f.read(8))
    bin_bytes = f.read(bin_len)

# Let's inspect mesh names or primitives
for i in range(4):
    mesh = gltf['meshes'][i]
    prim = mesh['primitives'][0]
    pos_acc = gltf['accessors'][prim['attributes']['POSITION']]
    pos_view = gltf['bufferViews'][pos_acc['bufferView']]
    offset = pos_view.get('byteOffset', 0) + pos_acc.get('byteOffset', 0)
    count = pos_acc['count']
    verts = np.frombuffer(bin_bytes, dtype=np.float32, count=count*3, offset=offset).reshape(-1, 3)
    
    # Calculate center of mass
    center = verts.mean(axis=0)
    print(f"Mesh {i}: center = {center.round(2)}, std = {verts.std(axis=0).round(2)}")
