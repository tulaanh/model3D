import json

with open('scripts/female_model.glb', 'rb') as f:
    f.seek(12)
    chunk_len = int.from_bytes(f.read(4), 'little')
    f.seek(20)
    gltf = json.loads(f.read(chunk_len).decode('utf-8'))

print("Scene default:", gltf.get('scene'))
print("Scenes:", gltf.get('scenes'))
for i, node in enumerate(gltf.get('nodes', [])):
    print(f"Node {i} ({node.get('name')}): mesh={node.get('mesh')}, children={node.get('children')}, matrix={node.get('matrix')}, scale={node.get('scale')}, rot={node.get('rotation')}")
