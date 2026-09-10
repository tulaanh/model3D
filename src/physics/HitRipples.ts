import * as THREE from 'three';
import type { HitEffect } from './CharacterPhysics';

export class HitRipples {
  private group: THREE.Group;
  private ringGeometry: THREE.RingGeometry;
  private sharedMaterial: THREE.MeshBasicMaterial;
  private ringsPool: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'HitRipplesGroup';
    scene.add(this.group);

    this.ringGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
    this.sharedMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaacc,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  public update(effects: HitEffect[]) {
    // Synchronize mesh pool with current effects
    while (this.ringsPool.length < effects.length) {
      const mat = this.sharedMaterial.clone();
      const mesh = new THREE.Mesh(this.ringGeometry, mat);
      this.ringsPool.push(mesh);
      this.group.add(mesh);
    }

    // Update active rings
    for (let i = 0; i < this.ringsPool.length; i++) {
      const mesh = this.ringsPool[i];
      if (i < effects.length) {
        mesh.visible = true;
        const fx = effects[i];
        mesh.position.copy(fx.position);
        mesh.lookAt(fx.position.clone().add(fx.normal));
        mesh.scale.set(fx.size, fx.size, fx.size);
        (mesh.material as THREE.MeshBasicMaterial).opacity = fx.opacity * 0.7;
      } else {
        mesh.visible = false;
      }
    }
  }

  public dispose() {
    this.group.clear();
    this.ringGeometry.dispose();
    this.sharedMaterial.dispose();
    this.ringsPool.forEach((m) => (m.material as THREE.Material).dispose());
  }
}
