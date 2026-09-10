import json
import struct

with open('scripts/female_model.glb', 'rb') as f:
    magic, version, length = struct.unpack('<III', f.read(12))
    chunk_len, chunk_type = struct.unpack('<II', f.read(8))
    json_bytes = f.read(chunk_len)
    gltf = json.loads(json_bytes.decode('utf-8'))

print('GLTF Version:', version)
print('Total length:', length)
print('Meshes count:', len(gltf.get('meshes', [])))
for i, m in enumerate(gltf.get('meshes', [])):
    print(f'Mesh {i}: {m.get("name")}, primitives: {len(m.get("primitives", []))}')

for i, n in enumerate(gltf.get('nodes', [])[:15]):
    print(f'Node {i}: {n.get("name")}')

# Check accessors for positions
pos_acc_idx = gltf['meshes'][0]['primitives'][0]['attributes']['POSITION']
pos_acc = gltf['accessors'][pos_acc_idx]
print('Position accessor:', pos_acc.get('count'), 'min:', pos_acc.get('min'), 'max:', pos_acc.get('max'))
