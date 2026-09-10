import json

with open('scripts/female_model.glb', 'rb') as f:
    f.seek(12)
    chunk_len = int.from_bytes(f.read(4), 'little')
    f.seek(20)
    gltf = json.loads(f.read(chunk_len).decode('utf-8'))

for i, m in enumerate(gltf.get('materials', [])):
    print(f"Material {i}: {m.get('name')}, pbr: {m.get('pbrMetallicRoughness')}")

for i, mesh in enumerate(gltf['meshes']):
    print(f"Mesh {i} uses material: {mesh['primitives'][0].get('material')}")
