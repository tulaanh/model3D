import json
import struct
import numpy as np

with open('scripts/female_model.glb', 'rb') as f:
    magic, version, length = struct.unpack('<III', f.read(12))
    chunk_len, chunk_type = struct.unpack('<II', f.read(8))
    json_bytes = f.read(chunk_len)
    gltf = json.loads(json_bytes.decode('utf-8'))
    
    # Read binary buffer
    bin_chunk_len, bin_chunk_type = struct.unpack('<II', f.read(8))
    bin_bytes = f.read(bin_chunk_len)

# Extract POSITION of Mesh 0
prim = gltf['meshes'][0]['primitives'][0]
pos_idx = prim['attributes']['POSITION']
pos_acc = gltf['accessors'][pos_idx]
pos_view = gltf['bufferViews'][pos_acc['bufferView']]

offset = pos_view.get('byteOffset', 0) + pos_acc.get('byteOffset', 0)
count = pos_acc['count']
vertices = np.frombuffer(bin_bytes, dtype=np.float32, count=count*3, offset=offset).reshape(-1, 3)

print('Vertices count:', count)
print('X min/max:', vertices[:,0].min(), vertices[:,0].max())
print('Y min/max:', vertices[:,1].min(), vertices[:,1].max())
print('Z min/max:', vertices[:,2].min(), vertices[:,2].max())

# Percentiles along Z (height)
print('Z percentiles:')
for p in [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]:
    print(f'P{p}: {np.percentile(vertices[:,2], p):.2f}')
