import trimesh
import numpy as np

# Load GLB
scene = trimesh.load('scripts/female_model.glb')
print("Loaded scene:", type(scene))
if isinstance(scene, trimesh.Scene):
    print("Geometries in scene:", len(scene.geometry))
    for name, geom in scene.geometry.items():
        print(f"Geom '{name}': {len(geom.vertices)} vertices, {len(geom.faces)} faces, bounds: {geom.bounds}")
