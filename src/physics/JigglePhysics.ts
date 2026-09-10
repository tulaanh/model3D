import * as THREE from 'three';
import { soundEngine } from '../audio/soundEngine';

export interface ActiveRipple {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  amplitude: number;
  frequency: number;
  damping: number;
  waveSpeed: number;
  radius: number;
  age: number;
  maxAge: number;
  isSecondary?: boolean;
}

export class JigglePhysics {
  public mannequinMesh: THREE.Mesh;
  public bikiniMesh: THREE.Mesh | null = null;
  public rootObject: THREE.Object3D;

  private basePositions: Float32Array;
  private buttockIndices: number[] = [];

  private bikiniBasePositions: Float32Array | null = null;
  private bikiniIndices: number[] = [];

  private activeRipples: ActiveRipple[] = [];

  // Whole-Mannequin Spring Recoil on Turntable
  private recoilRot: THREE.Euler = new THREE.Euler(0, 0, 0);
  private recoilVel: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private recoilStiffness: number = 220;
  private recoilDamping: number = 14;

  // Dragging state
  public isDragging: boolean = false;
  private dragOrigin: THREE.Vector3 = new THREE.Vector3();
  private dragCurrent: THREE.Vector3 = new THREE.Vector3();
  private dragNormal: THREE.Vector3 = new THREE.Vector3();

  // Contact visual ripples
  public visualEffects: Array<{
    position: THREE.Vector3;
    normal: THREE.Vector3;
    size: number;
    opacity: number;
    age: number;
    maxAge: number;
  }> = [];

  constructor(mannequinMesh: THREE.Mesh, rootObject: THREE.Object3D, bikiniMesh?: THREE.Mesh | null) {
    this.mannequinMesh = mannequinMesh;
    this.bikiniMesh = bikiniMesh || null;
    this.rootObject = rootObject;

    const posAttr = mannequinMesh.geometry.attributes.position as THREE.BufferAttribute;
    this.basePositions = new Float32Array(posAttr.array);

    // Dynamically identify body / soft tissue vertices based on bounding box
    const count = this.basePositions.length / 3;
    const bbox = new THREE.Box3().setFromBufferAttribute(posAttr);
    const height = Math.max(0.01, bbox.max.y - bbox.min.y);
    const minY = bbox.min.y + height * 0.15;
    const maxY = bbox.min.y + height * 0.90;

    for (let i = 0; i < count; i++) {
      const y = this.basePositions[i * 3 + 1];
      if (y >= minY && y <= maxY) {
        this.buttockIndices.push(i);
      }
    }

    // Set up synchronized bikini mesh physics
    if (this.bikiniMesh) {
      const bPosAttr = this.bikiniMesh.geometry.attributes.position as THREE.BufferAttribute;
      this.bikiniBasePositions = new Float32Array(bPosAttr.array);
      const bCount = this.bikiniBasePositions.length / 3;
      for (let i = 0; i < bCount; i++) {
        this.bikiniIndices.push(i);
      }
    }
  }

  /**
   * Apply an elastic slap/poke impulse
   */
  public slap(
    hitPoint: THREE.Vector3,
    hitNormal: THREE.Vector3,
    velocity: THREE.Vector2
  ) {
    const speed = velocity.length();
    const isHardSlap = speed > 500;
    const intensity = THREE.MathUtils.clamp(speed / 1100 + 0.35, 0.3, 1.0);

    // Play procedural sound
    soundEngine.playImpact(intensity, isHardSlap ? 'slap' : 'poke');

    // Visual ripple effect
    this.visualEffects.push({
      position: hitPoint.clone(),
      normal: hitNormal.clone(),
      size: isHardSlap ? 0.20 : 0.13,
      opacity: 0.9,
      age: 0,
      maxAge: 0.45,
    });

    const localHit = this.mannequinMesh.worldToLocal(hitPoint.clone());
    const invWorld = new THREE.Matrix4().copy(this.mannequinMesh.matrixWorld).invert();
    const localNormal = hitNormal.clone().transformDirection(invWorld).normalize();

    const primaryAmp = (isHardSlap ? 0.047 : 0.027) * intensity;

    // 1. Soft-Tissue Wave on Hit Spot (+80% amplitude, buoyant 1.2s duration)
    this.activeRipples.push({
      origin: localHit,
      direction: localNormal.clone().negate(),
      amplitude: primaryAmp,
      frequency: 20, // deeper, luscious tissue wobble
      damping: 2.8, // reduced damping -> prolonged buoyant jiggle (~1.2s)
      waveSpeed: 2.1,
      radius: 0.125, // broader cheek ripple propagation
      age: 0,
      maxAge: 1.25,
    });

    // Secondary harmonic echo for layered tissue realism
    this.activeRipples.push({
      origin: localHit.clone(),
      direction: localNormal.clone().negate(),
      amplitude: primaryAmp * 0.38,
      frequency: 24,
      damping: 3.2,
      waveSpeed: 1.8,
      radius: 0.095,
      age: -0.04,
      maxAge: 0.95,
      isSecondary: true,
    });

    // 3. Very subtle recoil on turntable (so it doesn't rock the whole pedestal)
    const recoilKick = intensity * (isHardSlap ? 0.03 : 0.015);
    this.recoilVel.x += -recoilKick * 0.35;
    this.recoilVel.z += (localHit.x > 0 ? -1 : 1) * recoilKick * 0.25;
  }

  public startDrag(hitPoint: THREE.Vector3, hitNormal: THREE.Vector3) {
    this.isDragging = true;
    const localHit = this.mannequinMesh.worldToLocal(hitPoint.clone());
    this.dragOrigin.copy(localHit);
    this.dragCurrent.copy(localHit);
    this.dragNormal.copy(hitNormal);
  }

  public updateDrag(currentPoint: THREE.Vector3) {
    if (!this.isDragging) return;
    const localCurrent = this.mannequinMesh.worldToLocal(currentPoint.clone());

    // Clamp maximum drag distance to realistic elastic tissue limit (max 6.5cm on peach glutes)
    const offset = localCurrent.clone().sub(this.dragOrigin);
    const maxStretch = 0.065;
    if (offset.length() > maxStretch) {
      offset.setLength(maxStretch);
    }
    this.dragCurrent.copy(this.dragOrigin).add(offset);
  }

  public releaseDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;

    const stretch = this.dragCurrent.distanceTo(this.dragOrigin);
    const intensity = THREE.MathUtils.clamp(stretch * 20, 0.25, 1.0);

    soundEngine.playImpact(intensity, 'release');

    if (stretch > 0.004) {
      const recoilDir = this.dragOrigin.clone().sub(this.dragCurrent).normalize();
      this.activeRipples.push({
        origin: this.dragOrigin.clone(),
        direction: recoilDir,
        amplitude: Math.min(stretch * 0.85, 0.048),
        frequency: 20,
        damping: 2.8, // buoyant prolonged bounce
        waveSpeed: 2.1,
        radius: 0.125, // full cheek rebound
        age: 0,
        maxAge: 1.25,
      });

      this.recoilVel.x += stretch * 0.28;
    }
  }

  public update(delta: number) {
    const clampedDelta = Math.min(delta, 0.05);

    // 1. Update visual hit ripples
    for (let i = this.visualEffects.length - 1; i >= 0; i--) {
      const fx = this.visualEffects[i];
      fx.age += clampedDelta;
      const progress = fx.age / fx.maxAge;
      fx.opacity = Math.max(0, 1.0 - progress);
      fx.size += clampedDelta * 0.4;
      if (fx.age >= fx.maxAge) {
        this.visualEffects.splice(i, 1);
      }
    }

    // 2. Solve Mannequin Spring Recoil (F = -kx - cv)
    const fx = -this.recoilStiffness * this.recoilRot.x - this.recoilDamping * this.recoilVel.x;
    const fz = -this.recoilStiffness * this.recoilRot.z - this.recoilDamping * this.recoilVel.z;

    this.recoilVel.x += fx * clampedDelta;
    this.recoilVel.z += fz * clampedDelta;

    this.recoilRot.x += this.recoilVel.x * clampedDelta;
    this.recoilRot.z += this.recoilVel.z * clampedDelta;

    this.rootObject.rotation.x = this.recoilRot.x;
    this.rootObject.rotation.z = this.recoilRot.z;

    // 3. Update Active Ripples
    for (let i = this.activeRipples.length - 1; i >= 0; i--) {
      const rip = this.activeRipples[i];
      rip.age += clampedDelta;
      if (rip.age >= rip.maxAge) {
        this.activeRipples.splice(i, 1);
      }
    }

    const posAttr = this.mannequinMesh.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    const bPosAttr = this.bikiniMesh ? (this.bikiniMesh.geometry.attributes.position as THREE.BufferAttribute) : null;
    const bArray = bPosAttr ? (bPosAttr.array as Float32Array) : null;

    const hasWaves = this.activeRipples.length > 0;
    const hasDrag = this.isDragging;

    // 4. Reset & Deform Both Torso and Bikini Mesh in Sync
    if (!hasWaves && !hasDrag) {
      let needsReset = false;
      for (let i = 0; i < this.buttockIndices.length; i++) {
        const idx = this.buttockIndices[i] * 3;
        if (array[idx] !== this.basePositions[idx] || array[idx + 1] !== this.basePositions[idx + 1] || array[idx + 2] !== this.basePositions[idx + 2]) {
          array[idx] = this.basePositions[idx];
          array[idx + 1] = this.basePositions[idx + 1];
          array[idx + 2] = this.basePositions[idx + 2];
          needsReset = true;
        }
      }

      if (bArray && this.bikiniBasePositions) {
        for (let i = 0; i < this.bikiniIndices.length; i++) {
          const idx = this.bikiniIndices[i] * 3;
          if (bArray[idx] !== this.bikiniBasePositions[idx] || bArray[idx + 1] !== this.bikiniBasePositions[idx + 1] || bArray[idx + 2] !== this.bikiniBasePositions[idx + 2]) {
            bArray[idx] = this.bikiniBasePositions[idx];
            bArray[idx + 1] = this.bikiniBasePositions[idx + 1];
            bArray[idx + 2] = this.bikiniBasePositions[idx + 2];
            needsReset = true;
          }
        }
      }

      if (needsReset) {
        posAttr.needsUpdate = true;
        this.mannequinMesh.geometry.computeVertexNormals();
        if (bPosAttr && this.bikiniMesh) {
          bPosAttr.needsUpdate = true;
          this.bikiniMesh.geometry.computeVertexNormals();
        }
      }
      return;
    }

    // Deform Mannequin Skin Vertices
    for (let i = 0; i < this.buttockIndices.length; i++) {
      const vIdx = this.buttockIndices[i];
      const i3 = vIdx * 3;
      const bx = this.basePositions[i3];
      const by = this.basePositions[i3 + 1];
      const bz = this.basePositions[i3 + 2];

      const [dx, dy, dz] = this.computeDeformation(bx, by, bz);
      array[i3] = bx + dx;
      array[i3 + 1] = by + dy;
      array[i3 + 2] = bz + dz;
    }

    posAttr.needsUpdate = true;
    this.mannequinMesh.geometry.computeVertexNormals();

    // Deform Bikini Thong Vertices in exact synchronization
    if (bArray && this.bikiniBasePositions && this.bikiniMesh) {
      for (let i = 0; i < this.bikiniIndices.length; i++) {
        const vIdx = this.bikiniIndices[i];
        const i3 = vIdx * 3;
        const bx = this.bikiniBasePositions[i3];
        const by = this.bikiniBasePositions[i3 + 1];
        const bz = this.bikiniBasePositions[i3 + 2];

        const [dx, dy, dz] = this.computeDeformation(bx, by, bz);
        bArray[i3] = bx + dx;
        bArray[i3 + 1] = by + dy;
        bArray[i3 + 2] = bz + dz;
      }

      bPosAttr!.needsUpdate = true;
      this.bikiniMesh.geometry.computeVertexNormals();
    }
  }

  private computeDeformation(bx: number, by: number, bz: number): [number, number, number] {
    let dx = 0;
    let dy = 0;
    let dz = 0;

    // 1. Process active ripples (slap, tap, release bounce)
    for (let w = 0; w < this.activeRipples.length; w++) {
      const rip = this.activeRipples[w];
      if (rip.age < 0) continue;

      const ox = rip.origin.x;
      const oy = rip.origin.y;
      const oz = rip.origin.z;

      // Front / Back isolation:
      // If ripple is on the back (oz > 0.015), do NOT affect front abdomen/groin (bz < 0.005)
      if (oz > 0.015 && bz < 0.005) continue;
      // If ripple is on the front (oz < -0.015), do NOT affect buttocks (bz > -0.005)
      if (oz < -0.015 && bz > -0.005) continue;

      // Left / Right cheek cleft isolation:
      // If ripple on right cheek (ox > 0.02), do NOT affect left cheek (bx < -0.005)
      if (ox > 0.02 && bx < -0.005) continue;
      // If ripple on left cheek (ox < -0.02), do NOT affect right cheek (bx > 0.005)
      if (ox < -0.02 && bx > 0.005) continue;

      const dist = Math.hypot(bx - ox, by - oy, bz - oz);
      const maxR = rip.radius * 1.35; // localized propagation boundary

      if (dist < maxR) {
        // Smooth cubic Hermite decay: eliminates sharp angular creases
        const normDist = dist / maxR;
        const s = 1.0 - normDist;
        let spatialFalloff = s * s * (3.0 - 2.0 * s);

        // Smooth midline cleft attenuation
        if (ox > 0.02) {
          spatialFalloff *= THREE.MathUtils.clamp((bx + 0.005) / 0.025, 0, 1);
        } else if (ox < -0.02) {
          spatialFalloff *= THREE.MathUtils.clamp((-bx + 0.005) / 0.025, 0, 1);
        }

        // Smooth front/back boundary attenuation
        if (oz > 0.015) {
          spatialFalloff *= THREE.MathUtils.clamp((bz - 0.005) / 0.025, 0, 1);
        } else if (oz < -0.015) {
          spatialFalloff *= THREE.MathUtils.clamp((-bz - 0.005) / 0.025, 0, 1);
        }

        if (spatialFalloff <= 0) continue;

        const timeDecay = Math.exp(-rip.damping * rip.age);
        const phase = rip.frequency * rip.age - (dist / rip.waveSpeed) * Math.PI * 2;
        const waveAmp = rip.amplitude * timeDecay * Math.sin(phase) * spatialFalloff;

        // Primary displacement along impact normal
        dx += rip.direction.x * waveAmp;
        dy += rip.direction.y * waveAmp;
        dz += rip.direction.z * waveAmp;

        // Soft-tissue volume bulge (Poisson effect)
        if (dist > 0.004) {
          const radialFactor = (dist / maxR) * (1.0 - dist / maxR) * 0.38;
          const rx = (bx - ox) / dist;
          const ry = (by - oy) / dist;
          const rz = (bz - oz) / dist;
          const bulge = waveAmp * radialFactor;
          dx += rx * bulge;
          dy += ry * bulge;
          dz += rz * bulge;
        }
      }
    }

    // 2. Process interactive pointer drag
    if (this.isDragging) {
      const ox = this.dragOrigin.x;
      const oy = this.dragOrigin.y;
      const oz = this.dragOrigin.z;

      // Front / Back surface isolation
      let canDrag = true;
      if (oz > 0.015 && bz < 0.005) canDrag = false;
      if (oz < -0.015 && bz > -0.005) canDrag = false;

      // Left / Right cheek cleft isolation
      if (ox > 0.02 && bx < -0.005) canDrag = false;
      if (ox < -0.02 && bx > 0.005) canDrag = false;

      if (canDrag) {
        const dragDist = Math.hypot(bx - ox, by - oy, bz - oz);
        // Realistic localized anatomical radius: max 9.5cm (tight cheek focus)
        const dragRadius = 0.095;

        if (dragDist < dragRadius) {
          const s = 1.0 - dragDist / dragRadius;
          let falloff = s * s * (3.0 - 2.0 * s); // Smooth cubic Hermite curve

          // Midline cleft smooth attenuation: prevents dragging the opposite cheek
          if (ox > 0.02) {
            falloff *= THREE.MathUtils.clamp((bx + 0.005) / 0.025, 0, 1);
          } else if (ox < -0.02) {
            falloff *= THREE.MathUtils.clamp((-bx + 0.005) / 0.025, 0, 1);
          }

          // Front/back smooth attenuation
          if (oz > 0.015) {
            falloff *= THREE.MathUtils.clamp((bz - 0.005) / 0.025, 0, 1);
          } else if (oz < -0.015) {
            falloff *= THREE.MathUtils.clamp((-bz - 0.005) / 0.025, 0, 1);
          }

          const deltaDrag = this.dragCurrent.clone().sub(this.dragOrigin);
          dx += deltaDrag.x * falloff * 0.9;
          dy += deltaDrag.y * falloff * 0.9;
          dz += deltaDrag.z * falloff * 0.9;
        }
      }
    }

    return [dx, dy, dz];
  }
}
