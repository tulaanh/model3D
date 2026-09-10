import json, struct, numpy as np

with open('scripts/female_model.glb', 'rb') as f:
    magic, version, length = struct.unpack('<III', f.read(12))
    chunk_len, chunk_type = struct.unpack('<II', f.read(8))
    json_bytes = f.read(chunk_len)
    gltf = json.loads(json_bytes.decode('utf-8'))
    bin_chunk_len, bin_chunk_type = struct.unpack('<II', f.read(8))
    bin_bytes = f.read(bin_chunk_len)

for i, mesh in enumerate(gltf['meshes']):
    name = mesh.get('name', 'unnamed')
    prim = mesh['primitives'][0]
    pos_idx = prim['attributes']['POSITION']
    pos_acc = gltf['accessors'][pos_idx]
    pos_view = gltf['bufferViews'][pos_acc['bufferView']]
    offset = pos_view.get('byteOffset', 0) + pos_acc.get('byteOffset', 0)
    count = pos_acc['count']
    verts = np.frombuffer(bin_bytes, dtype=np.float32, count=count*3, offset=offset).reshape(-1, 3)
    print(f"Mesh {i} ({name}): {count} verts, X:[{verts[:,0].min():.2f}, {verts[:,0].max():.2f}], Y:[{verts[:,1].min():.2f}, {verts[:,1].max():.2f}], Z:[{verts[:,2].min():.2f}, {verts[:,2].max():.2f}]")
