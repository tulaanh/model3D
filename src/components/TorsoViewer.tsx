import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { JigglePhysics } from '../physics/JigglePhysics';
import { HitRipples } from '../physics/HitRipples';
import { SunsetBeachEnvironment } from './SunsetBeachEnvironment';
import { FloatingControls, type CameraViewPreset, type BikiniVariant } from './FloatingControls';

export const TorsoViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [currentView, setCurrentView] = useState<CameraViewPreset>('Back');
  const [currentVariant, setCurrentVariant] = useState<BikiniVariant>('Pearl');
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);
  const [isHoveringModel, setIsHoveringModel] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const physicsRef = useRef<JigglePhysics | null>(null);

  const mannequinRootRef = useRef<THREE.Group | null>(null);
  const torsoMeshRef = useRef<THREE.Mesh | null>(null);
  const bikiniMeshRef = useRef<THREE.Mesh | null>(null);
  const interactableObjectsRef = useRef<THREE.Mesh[]>([]);

  // Smooth camera transition state
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);
  const targetCamLookRef = useRef<THREE.Vector3 | null>(null);

  // Interaction tracking
  const isInteractingModelRef = useRef<boolean>(false);
  const pointerDownPosRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const pointerLastPosRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const pointerVelocityRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const pointerDownTimeRef = useRef<number>(0);
  const lastHitInfoRef = useRef<{ point: THREE.Vector3; normal: THREE.Vector3 } | null>(null);

  // View Preset Positions (centered on the buttocks at Y = 0.25m)
  const viewPresets: Record<CameraViewPreset, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
    Back: {
      pos: new THREE.Vector3(0, 0.28, 1.15),
      target: new THREE.Vector3(0, 0.25, 0),
    },
    Quarter: {
      pos: new THREE.Vector3(0.58, 0.30, 1.05),
      target: new THREE.Vector3(0, 0.25, 0),
    },
    Side: {
      pos: new THREE.Vector3(1.15, 0.28, 0),
      target: new THREE.Vector3(0, 0.25, 0),
    },
    Front: {
      pos: new THREE.Vector3(0, 0.28, -1.15),
      target: new THREE.Vector3(0, 0.25, 0),
    },
  };

  const handleSelectView = useCallback((view: CameraViewPreset) => {
    setCurrentView(view);
    const preset = viewPresets[view];
    targetCamPosRef.current = preset.pos.clone();
    targetCamLookRef.current = preset.target.clone();
  }, []);

  const handleResetView = useCallback(() => {
    handleSelectView('Back');
  }, [handleSelectView]);

  const applyBikiniMaterial = useCallback((variant: BikiniVariant) => {
    if (!bikiniMeshRef.current) return;
    const mesh = bikiniMeshRef.current;

    if (variant === 'Pearl') {
      mesh.material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#fcfaf4'),
        roughness: 0.22,
        metalness: 0.04,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18,
        sheen: 1.0,
        sheenColor: new THREE.Color('#ffffff'),
        vertexColors: true,
        side: THREE.DoubleSide,
      });
    } else {
      mesh.material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#101014'),
        roughness: 0.26,
        metalness: 0.10,
        clearcoat: 0.75,
        clearcoatRoughness: 0.20,
        sheen: 0.85,
        sheenColor: new THREE.Color('#4a4a55'),
        vertexColors: true,
        side: THREE.DoubleSide,
      });
    }
  }, []);

  const handleSelectVariant = useCallback((variant: BikiniVariant) => {
    setCurrentVariant(variant);
    applyBikiniMaterial(variant);
  }, [applyBikiniMaterial]);

  const handleToggleAutoRotate = useCallback(() => {
    setIsAutoRotating((prev) => {
      const next = !prev;
      if (controlsRef.current) {
        controlsRef.current.autoRotate = next;
        controlsRef.current.autoRotateSpeed = 1.4;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    const initialPreset = viewPresets['Back'];
    camera.position.copy(initialPreset.pos);
    cameraRef.current = camera;

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    // 4. Orbit Controls Setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.copy(initialPreset.target);
    controls.minDistance = 0.5;
    controls.maxDistance = 5.0;
    controls.maxPolarAngle = Math.PI / 2 + 0.02;
    controlsRef.current = controls;

    // 5. Sunset Beach Environment
    const env = new SunsetBeachEnvironment(scene);

    // 6. Hit Ripples VFX Manager
    const hitRipples = new HitRipples(scene);

    // 7. Mannequin Root Group
    const mannequinRoot = new THREE.Group();
    mannequinRoot.name = 'MannequinRoot';
    scene.add(mannequinRoot);
    mannequinRootRef.current = mannequinRoot;

    // 8. Load Bikini Buttocks Mannequin Model
    const loader = new GLTFLoader();
    interactableObjectsRef.current = [];

    loader.load(
      '/models/bikini_torso.glb',
      (gltf) => {
        let torsoMesh: THREE.Mesh | null = null;

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            if (mesh.name === 'Pedestal' || mesh.name.includes('Pedestal')) {
              mesh.geometry.computeVertexNormals();
              mesh.material = new THREE.MeshStandardMaterial({
                color: new THREE.Color('#dfccbb'),
                roughness: 0.5,
                metalness: 0.08,
              });
            } else if (mesh.name === 'BikiniThong' || mesh.name.includes('Bikini')) {
              mesh.geometry.computeVertexNormals();
              bikiniMeshRef.current = mesh;
              applyBikiniMaterial(currentVariant);
              interactableObjectsRef.current.push(mesh);
            } else {
              // TorsoBody - Organic soft human skin material
              torsoMesh = mesh;
              torsoMeshRef.current = mesh;

              mesh.geometry.computeVertexNormals();
              mesh.material = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color('#f2c6b4'),
                roughness: 0.38,
                metalness: 0.0,
                clearcoat: 0.12,
                clearcoatRoughness: 0.30,
                sheen: 1.0,
                sheenColor: new THREE.Color('#ffa08a'),
                vertexColors: true,
                side: THREE.DoubleSide,
              });

              interactableObjectsRef.current.push(mesh);
            }
          }
        });

        mannequinRoot.add(gltf.scene);

        if (torsoMesh) {
          const physics = new JigglePhysics(torsoMesh, mannequinRoot, bikiniMeshRef.current);
          physicsRef.current = physics;
        }

        setIsLoading(false);
      },
      undefined,
      (err) => {
        console.error('Error loading bikini_torso.glb:', err);
        setIsLoading(false);
      }
    );

    // 9. Input & Interaction Handling
    const raycaster = new THREE.Raycaster();

    const getNDCCoords = (event: PointerEvent): THREE.Vector2 => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 2) {
        controls.enabled = true;
        return;
      }

      if (interactableObjectsRef.current.length === 0 || !physicsRef.current) return;

      const ndc = getNDCCoords(event);
      raycaster.setFromCamera(ndc, camera);

      const intersects = raycaster.intersectObjects(interactableObjectsRef.current, false);

      if (intersects.length > 0) {
        controls.enabled = false;
        isInteractingModelRef.current = true;

        const hit = intersects[0];
        const normal = hit.normal
          ? hit.normal.clone().transformDirection(hit.object.matrixWorld)
          : new THREE.Vector3(0, 0, 1);

        lastHitInfoRef.current = {
          point: hit.point.clone(),
          normal: normal,
        };

        pointerDownPosRef.current.set(event.clientX, event.clientY);
        pointerLastPosRef.current.set(event.clientX, event.clientY);
        pointerDownTimeRef.current = performance.now();

        physicsRef.current.startDrag(hit.point, normal);
      } else {
        controls.enabled = true;
        isInteractingModelRef.current = false;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const ndc = getNDCCoords(event);
      raycaster.setFromCamera(ndc, camera);

      if (interactableObjectsRef.current.length > 0) {
        const intersects = raycaster.intersectObjects(interactableObjectsRef.current, false);
        setIsHoveringModel(intersects.length > 0);
      }

      const now = performance.now();
      const dt = Math.max(0.001, (now - (pointerDownTimeRef.current || now)) / 1000);
      const curX = event.clientX;
      const curY = event.clientY;
      const lastX = pointerLastPosRef.current.x;
      const lastY = pointerLastPosRef.current.y;

      pointerVelocityRef.current.set((curX - lastX) / dt, (curY - lastY) / dt);
      pointerLastPosRef.current.set(curX, curY);

      if (isInteractingModelRef.current && physicsRef.current && physicsRef.current.isDragging && lastHitInfoRef.current) {
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir).negate();
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          camDir,
          lastHitInfoRef.current.point
        );
        const planeHit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, planeHit)) {
          physicsRef.current.updateDrag(planeHit);
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button === 2) return;

      if (isInteractingModelRef.current && physicsRef.current) {
        const upX = event.clientX;
        const upY = event.clientY;
        const downX = pointerDownPosRef.current.x;
        const downY = pointerDownPosRef.current.y;
        const dist = Math.hypot(upX - downX, upY - downY);
        const duration = performance.now() - pointerDownTimeRef.current;

        // Slap impulse if fast tap
        if (dist < 18 && duration < 380 && lastHitInfoRef.current) {
          physicsRef.current.slap(
            lastHitInfoRef.current.point,
            lastHitInfoRef.current.normal,
            pointerVelocityRef.current
          );
        } else if (physicsRef.current.isDragging) {
          physicsRef.current.releaseDrag();
        }

        isInteractingModelRef.current = false;
      }

      controls.enabled = true;
    };

    const domElement = canvasRef.current;
    domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    domElement.addEventListener('contextmenu', handleContextMenu);

    // 10. Render Loop
    let animId: number;
    let lastTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Smooth Camera Transitions
      if (targetCamPosRef.current && targetCamLookRef.current) {
        camera.position.lerp(targetCamPosRef.current, 0.08);
        controls.target.lerp(targetCamLookRef.current, 0.08);

        if (camera.position.distanceTo(targetCamPosRef.current) < 0.008) {
          targetCamPosRef.current = null;
          targetCamLookRef.current = null;
        }
      }

      // Update Physics & Hit Ripples
      if (physicsRef.current) {
        physicsRef.current.update(delta);
        hitRipples.update(physicsRef.current.visualEffects as any);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 11. Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      domElement.removeEventListener('contextmenu', handleContextMenu);

      controls.dispose();
      env.dispose();
      hitRipples.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-zinc-950 select-none ${
        isHoveringModel ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-900/80 backdrop-blur-md z-30 transition-opacity duration-500">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-amber-300/20 border-t-amber-300 animate-spin" />
            <span className="text-xs text-stone-300 font-medium tracking-wide">Đang nạp Mannequin 3D...</span>
          </div>
        </div>
      )}

      {/* Floating Controls matching the reference image */}
      <FloatingControls
        currentView={currentView}
        onSelectView={handleSelectView}
        currentVariant={currentVariant}
        onSelectVariant={handleSelectVariant}
        isAutoRotating={isAutoRotating}
        onToggleAutoRotate={handleToggleAutoRotate}
        onResetView={handleResetView}
      />
    </div>
  );
};
