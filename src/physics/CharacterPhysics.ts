import * as THREE from 'three';
import { VRM, VRMHumanBoneName, VRMSpringBoneCollider, VRMSpringBoneColliderShapeSphere } from '@pixiv/three-vrm';
import { soundEngine } from '../audio/soundEngine';

export interface HitEffect {
  id: number;
  position: THREE.Vector3;
  normal: THREE.Vector3;
  size: number;
  opacity: number;
  maxAge: number;
  age: number;
}

export class CharacterPhysics {
  public vrm: VRM;
  private scene: THREE.Scene;

  // 3D Cursor Collider
  public cursorNode: THREE.Object3D;
  public cursorCollider: VRMSpringBoneCollider | null = null;
  private planeZ: THREE.Plane;

  // Recoil & Elastic spring simulation for bones
  private boneRecoils: Map<VRMHumanBoneName, {
    offsetRot: THREE.Euler;
    velocityRot: THREE.Vector3;
    stiffness: number;
    damping: number;
  }> = new Map();

  // Active dragging state
  public isDragging: boolean = false;
  private dragBoneName: VRMHumanBoneName | null = null;
  private dragStartPos: THREE.Vector3 = new THREE.Vector3();
  private dragCurrentPos: THREE.Vector3 = new THREE.Vector3();
  private dragInitialRot: THREE.Quaternion = new THREE.Quaternion();

  // Hit visual ripple effects
  public hitEffects: HitEffect[] = [];
  private nextHitId: number = 1;

  // Expressions & Reactions
  private reactionTimer: number = 0;
  private activeReaction: 'surprised' | 'happy' | 'angry' | 'relaxed' | null = null;
  private blinkTimer: number = 0;
  private blinkDuration: number = 0.15;
  private nextBlinkInterval: number = 3.0;

  // Breathing time
  private breatheTime: number = 0;

  constructor(vrm: VRM, scene: THREE.Scene) {
    this.vrm = vrm;
    this.scene = scene;

    this.planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    // Initialize 3D cursor collider node
    this.cursorNode = new THREE.Object3D();
    this.cursorNode.name = 'CursorColliderNode';
    this.scene.add(this.cursorNode);

    this.setupCursorCollider();
    this.tuneSpringBones();
    this.initBoneSprings();
  }

  /**
   * Set up an active 3D sphere collider attached to the mouse pointer
   */
  private setupCursorCollider() {
    try {
      const shape = new VRMSpringBoneColliderShapeSphere({
        radius: 0.12,
        offset: new THREE.Vector3(0, 0, 0),
      });

      this.cursorCollider = new VRMSpringBoneCollider(shape);
      this.cursorNode.add(this.cursorCollider);

      // Register cursor collider with spring bones
      if (this.vrm.springBoneManager) {
        if (this.vrm.springBoneManager.colliderGroups) {
          // Add to existing collider groups or create a new group
          this.vrm.springBoneManager.colliderGroups.push({
            colliders: [this.cursorCollider],
            name: 'CursorColliderGroup',
          });
        }
      }
    } catch (err) {
      console.warn('Failed to attach cursor spring collider:', err);
    }
  }

  /**
   * Tune spring bones for maximum bounce and lively elasticity
   */
  private tuneSpringBones() {
    if (!this.vrm.springBoneManager || !this.vrm.springBoneManager.joints) return;

    this.vrm.springBoneManager.joints.forEach((joint) => {
      if (joint.settings) {
        // Lower stiffness slightly and tune dragForce for bouncy, elastic jiggle
        joint.settings.stiffness = Math.min(joint.settings.stiffness, 3.2);
        joint.settings.dragForce = 0.45; // allows 3-5 smooth elastic oscillations
        joint.settings.hitRadius = Math.max(joint.settings.hitRadius, 0.04);
      }
    });
  }

  /**
   * Setup physical recoil springs for major humanoid bones
   */
  private initBoneSprings() {
    const bonesToSpring: Array<{ name: VRMHumanBoneName; stiffness: number; damping: number }> = [
      { name: 'head', stiffness: 220, damping: 14 },
      { name: 'neck', stiffness: 240, damping: 16 },
      { name: 'chest', stiffness: 180, damping: 12 },
      { name: 'spine', stiffness: 160, damping: 12 },
      { name: 'hips', stiffness: 150, damping: 11 },
      { name: 'leftUpperArm', stiffness: 200, damping: 15 },
      { name: 'rightUpperArm', stiffness: 200, damping: 15 },
    ];

    bonesToSpring.forEach(({ name, stiffness, damping }) => {
      this.boneRecoils.set(name, {
        offsetRot: new THREE.Euler(0, 0, 0),
        velocityRot: new THREE.Vector3(0, 0, 0),
        stiffness,
        damping,
      });
    });
  }

  /**
   * Update 3D cursor position in world space
   */
  public updateCursorPosition(ray: THREE.Ray) {
    const target = new THREE.Vector3();
    const characterPos = this.vrm.scene.position;
    this.planeZ.constant = -characterPos.z;

    if (ray.intersectPlane(this.planeZ, target)) {
      this.cursorNode.position.copy(target);
    }
  }

  /**
   * Trigger a slap or poke impulse when the character is clicked or swiped
   */
  public applySlap(
    hitPoint: THREE.Vector3,
    hitNormal: THREE.Vector3,
    pointerVelocity: THREE.Vector2,
    nearestBoneName: VRMHumanBoneName | null = null
  ) {
    const speed = pointerVelocity.length();
    const isHardSlap = speed > 600;
    const intensity = THREE.MathUtils.clamp(speed / 1200 + 0.35, 0.3, 1.0);

    // Play procedural sound
    soundEngine.playImpact(intensity, isHardSlap ? 'slap' : 'poke');

    // Spawn hit visual effect
    this.hitEffects.push({
      id: this.nextHitId++,
      position: hitPoint.clone(),
      normal: hitNormal.clone(),
      size: isHardSlap ? 0.35 : 0.2,
      opacity: 1.0,
      maxAge: 0.45,
      age: 0,
    });

    // Determine impulse direction
    const impulseDir = new THREE.Vector3(
      pointerVelocity.x * 0.003,
      pointerVelocity.y * 0.003,
      -0.8
    ).normalize();

    // 1. Inject impulse to nearest VRM Spring Bone joints
    if (this.vrm.springBoneManager && this.vrm.springBoneManager.joints) {
      const impulseStrength = (isHardSlap ? 0.25 : 0.12) * intensity;

      this.vrm.springBoneManager.joints.forEach((joint) => {
        const bone = joint.bone;
        if (bone) {
          const worldPos = new THREE.Vector3();
          bone.getWorldPosition(worldPos);
          const dist = worldPos.distanceTo(hitPoint);

          // Apply force if joint is within influence radius
          if (dist < 0.6) {
            const falloff = 1.0 - dist / 0.6;
            const j = joint as unknown as { _prevTail?: THREE.Vector3; _currentTail?: THREE.Vector3 };
            if (j._prevTail && j._currentTail) {
              const kick = impulseDir.clone().multiplyScalar(impulseStrength * falloff);
              j._prevTail.sub(kick);
            }
          }
        }
      });
    }

    // 2. Apply recoil spring to the nearest humanoid bone
    const targetBone = nearestBoneName || this.findClosestHumanoidBone(hitPoint);
    if (targetBone && this.boneRecoils.has(targetBone)) {
      const recoil = this.boneRecoils.get(targetBone)!;
      const kickX = (Math.random() - 0.5) * 0.4 * intensity;
      const kickY = impulseDir.x * 0.8 * intensity;
      const kickZ = -Math.abs(impulseDir.y) * 0.6 * intensity;

      recoil.velocityRot.x += kickX;
      recoil.velocityRot.y += kickY;
      recoil.velocityRot.z += kickZ;
    }

    // 3. Trigger facial reaction
    this.triggerReaction(isHardSlap ? 'surprised' : 'happy', 1.6);
  }

  /**
   * Start a spring drag interaction
   */
  public startDrag(hitPoint: THREE.Vector3, boneName: VRMHumanBoneName | null) {
    this.isDragging = true;
    this.dragStartPos.copy(hitPoint);
    this.dragCurrentPos.copy(hitPoint);
    this.dragBoneName = boneName || this.findClosestHumanoidBone(hitPoint);

    if (this.dragBoneName) {
      const boneNode = this.vrm.humanoid?.getNormalizedBoneNode(this.dragBoneName);
      if (boneNode) {
        this.dragInitialRot.copy(boneNode.quaternion);
      }
    }
  }

  /**
   * Update spring drag position
   */
  public updateDrag(currentPoint: THREE.Vector3) {
    if (!this.isDragging) return;
    this.dragCurrentPos.copy(currentPoint);

    if (this.dragBoneName && this.boneRecoils.has(this.dragBoneName)) {
      const delta = currentPoint.clone().sub(this.dragStartPos);
      const recoil = this.boneRecoils.get(this.dragBoneName)!;

      // Stretch bone rotation
      recoil.offsetRot.z = THREE.MathUtils.clamp(delta.x * 0.8, -0.6, 0.6);
      recoil.offsetRot.x = THREE.MathUtils.clamp(-delta.y * 0.8, -0.6, 0.6);
    }
  }

  /**
   * Release spring drag with snappy elastic bounce
   */
  public releaseDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;

    const stretch = this.dragCurrentPos.distanceTo(this.dragStartPos);
    const intensity = THREE.MathUtils.clamp(stretch * 2.5, 0.2, 1.0);

    // Play twang / boing sound
    soundEngine.playImpact(intensity, 'release');

    if (this.dragBoneName && this.boneRecoils.has(this.dragBoneName)) {
      const recoil = this.boneRecoils.get(this.dragBoneName)!;
      // Spring back with velocity proportional to stretch
      recoil.velocityRot.x += -recoil.offsetRot.x * 25;
      recoil.velocityRot.z += -recoil.offsetRot.z * 25;
    }

    // Trigger spring bones bounce
    if (this.vrm.springBoneManager && this.vrm.springBoneManager.joints) {
      const releaseKick = this.dragStartPos.clone().sub(this.dragCurrentPos).normalize().multiplyScalar(stretch * 0.4);
      this.vrm.springBoneManager.joints.forEach((joint) => {
        const j = joint as unknown as { _prevTail?: THREE.Vector3 };
        if (j._prevTail) {
          j._prevTail.sub(releaseKick);
        }
      });
    }

    this.triggerReaction('happy', 1.2);
    this.dragBoneName = null;
  }

  /**
   * Trigger a facial expression reaction
   */
  public triggerReaction(reaction: 'surprised' | 'happy' | 'angry' | 'relaxed', duration: number = 1.5) {
    this.activeReaction = reaction;
    this.reactionTimer = duration;
  }

  /**
   * Find closest standard humanoid bone to a world position
   */
  public findClosestHumanoidBone(worldPos: THREE.Vector3): VRMHumanBoneName | null {
    if (!this.vrm.humanoid) return null;

    let closestBone: VRMHumanBoneName | null = null;
    let minDist = Infinity;

    this.boneRecoils.forEach((_, boneName) => {
      const node = this.vrm.humanoid?.getNormalizedBoneNode(boneName);
      if (node) {
        const boneWorld = new THREE.Vector3();
        node.getWorldPosition(boneWorld);
        const d = boneWorld.distanceTo(worldPos);
        if (d < minDist) {
          minDist = d;
          closestBone = boneName;
        }
      }
    });

    return closestBone;
  }

  /**
   * Main per-frame physics & animation update
   */
  public update(delta: number) {
    const clampedDelta = Math.min(delta, 0.05);

    // 1. Natural Breathing (gentle sinusoidal sway)
    this.breatheTime += clampedDelta * 1.8;
    const breatheAngle = Math.sin(this.breatheTime) * 0.02;
    const chestNode = this.vrm.humanoid?.getNormalizedBoneNode('chest');
    const spineNode = this.vrm.humanoid?.getNormalizedBoneNode('spine');
    if (chestNode) chestNode.rotation.x = breatheAngle * 1.2;
    if (spineNode) spineNode.rotation.x = breatheAngle * 0.6;

    // 2. Solve Bone Spring Recoils (F = -k*x - c*v)
    this.boneRecoils.forEach((recoil, boneName) => {
      const node = this.vrm.humanoid?.getNormalizedBoneNode(boneName);
      if (node) {
        const fx = -recoil.stiffness * recoil.offsetRot.x - recoil.damping * recoil.velocityRot.x;
        const fy = -recoil.stiffness * recoil.offsetRot.y - recoil.damping * recoil.velocityRot.y;
        const fz = -recoil.stiffness * recoil.offsetRot.z - recoil.damping * recoil.velocityRot.z;

        recoil.velocityRot.x += fx * clampedDelta;
        recoil.velocityRot.y += fy * clampedDelta;
        recoil.velocityRot.z += fz * clampedDelta;

        recoil.offsetRot.x += recoil.velocityRot.x * clampedDelta;
        recoil.offsetRot.y += recoil.velocityRot.y * clampedDelta;
        recoil.offsetRot.z += recoil.velocityRot.z * clampedDelta;

        node.rotation.x += recoil.offsetRot.x;
        node.rotation.y += recoil.offsetRot.y;
        node.rotation.z += recoil.offsetRot.z;
      }
    });

    // 3. Expressions & Blinking
    this.updateExpressions(clampedDelta);

    // 4. Update Hit Visual Effects
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const fx = this.hitEffects[i];
      fx.age += clampedDelta;
      const progress = fx.age / fx.maxAge;
      fx.opacity = Math.max(0, 1.0 - progress);
      fx.size += clampedDelta * 0.5;

      if (fx.age >= fx.maxAge) {
        this.hitEffects.splice(i, 1);
      }
    }

    // 5. Update VRM Core & Spring Bones
    this.vrm.update(clampedDelta);
  }

  /**
   * Handle facial expressions, natural blinking and emotional reactions
   */
  private updateExpressions(delta: number) {
    if (!this.vrm.expressionManager) return;

    // Handle blinking
    this.blinkTimer += delta;
    if (this.blinkTimer > this.nextBlinkInterval) {
      const blinkProgress = (this.blinkTimer - this.nextBlinkInterval) / this.blinkDuration;
      if (blinkProgress <= 1.0) {
        const blinkVal = Math.sin(blinkProgress * Math.PI);
        this.vrm.expressionManager.setValue('blink', blinkVal);
      } else {
        this.vrm.expressionManager.setValue('blink', 0);
        this.blinkTimer = 0;
        this.nextBlinkInterval = 2.5 + Math.random() * 3.5;
      }
    }

    // Handle reaction expressions (surprised, happy, blush)
    if (this.reactionTimer > 0) {
      this.reactionTimer -= delta;
      const weight = Math.min(1.0, this.reactionTimer * 2.0);

      if (this.activeReaction === 'surprised') {
        this.vrm.expressionManager.setValue('surprised', weight);
        this.vrm.expressionManager.setValue('aa', weight * 0.4);
      } else if (this.activeReaction === 'happy') {
        this.vrm.expressionManager.setValue('happy', weight);
        this.vrm.expressionManager.setValue('relaxed', weight * 0.3);
      }
    } else {
      this.vrm.expressionManager.setValue('surprised', 0);
      this.vrm.expressionManager.setValue('aa', 0);
      this.vrm.expressionManager.setValue('happy', 0);
      this.vrm.expressionManager.setValue('relaxed', 0);
      this.activeReaction = null;
    }
  }

  public dispose() {
    this.scene.remove(this.cursorNode);
    this.hitEffects = [];
  }
}
