import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm';
import { CharacterPhysics } from '../physics/CharacterPhysics';
import { HitRipples } from '../physics/HitRipples';
import { ZenUI } from './ZenUI';

export const SceneViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [fps, setFps] = useState<number>(60);

  // References for three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const physicsRef = useRef<CharacterPhysics | null>(null);
  const vrmRef = useRef<VRM | null>(null);

  // Interaction tracking
  const isInteractingModelRef = useRef<boolean>(false);
  const pointerDownPosRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const pointerCurrentPosRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const pointerLastPosRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const pointerVelocityRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const pointerDownTimeRef = useRef<number>(0);
  const lastHitInfoRef = useRef<{ point: THREE.Vector3; normal: THREE.Vector3 } | null>(null);

  // Reset Camera Callback
  const handleResetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 1.35, 1.85);
    controlsRef.current.target.set(0, 1.05, 0);
    controlsRef.current.update();
  }, []);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Modern Studio Gradient Background
    scene.background = new THREE.Color(0x18181b); // Zinc-900 base
    scene.fog = new THREE.FogExp2(0x18181b, 0.12);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 20);
    camera.position.set(0, 1.35, 1.85);
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
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.05, 0);
    controls.minDistance = 0.6;
    controls.maxDistance = 4.5;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // don't go below floor
    controlsRef.current = controls;

    // 5. Studio Three-Point Lighting
    // Ambient / Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(0xfff5ea, 0x1e1e24, 0.9);
    scene.add(hemiLight);

    // Key Light (Main soft directional light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(1.5, 3.0, 2.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 10;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.radius = 3;
    scene.add(keyLight);

    // Fill Light (Soft cool light to soften harsh shadows)
    const fillLight = new THREE.DirectionalLight(0xddeeff, 0.8);
    fillLight.position.set(-2.0, 1.8, 1.2);
    scene.add(fillLight);

    // Rim Light / Back Light (Backlight to highlight silhouette and hair)
    const rimLight = new THREE.DirectionalLight(0xffe4f0, 1.6);
    rimLight.position.set(0, 2.5, -2.5);
    scene.add(rimLight);

    // Soft Studio Ground Plane
    const floorGeo = new THREE.PlaneGeometry(12, 12);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e1e24,
      roughness: 0.85,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Studio Contact Shadow Disc directly under avatar
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sctx = shadowCanvas.getContext('2d');
    if (sctx) {
      const gradient = sctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sctx.fillStyle = gradient;
      sctx.fillRect(0, 0, 256, 256);
    }
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
      })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.005;
    scene.add(shadowDisc);

    // 6. Hit Ripples VFX Manager
    const hitRipples = new HitRipples(scene);

    // 7. Raycaster for Interaction
    const raycaster = new THREE.Raycaster();
    const lookAtTarget = new THREE.Object3D();
    scene.add(lookAtTarget);

    // 8. Load VRM Model
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      '/models/avatar.vrm',
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) {
          console.error('No VRM found in glTF userData');
          setIsLoading(false);
          return;
        }

        vrmRef.current = vrm;

        // Optimization
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.removeUnnecessaryJoints(gltf.scene);

        // Standard VRM rotation to face camera
        vrm.scene.rotation.y = Math.PI;

        // Enable shadow casting on all character meshes
        vrm.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });

        scene.add(vrm.scene);

        // Bind lookAt target to track mouse
        if (vrm.lookAt) {
          vrm.lookAt.target = lookAtTarget;
        }

        // Initialize Character Physics
        const physics = new CharacterPhysics(vrm, scene);
        physicsRef.current = physics;

        setIsLoading(false);
      },
      (progress) => {
        if (progress.total > 0) {
          setLoadingProgress((progress.loaded / progress.total) * 100);
        } else {
          // Estimated loading
          setLoadingProgress((prev) => Math.min(prev + 12, 95));
        }
      },
      (error) => {
        console.error('Error loading VRM model:', error);
        setIsLoading(false);
      }
    );

    // 9. Input & Interaction Events
    const getNDCCoords = (event: PointerEvent): THREE.Vector2 => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      // If right click: allow orbit controls
      if (event.button === 2) {
        controls.enabled = true;
        return;
      }

      if (!vrmRef.current || !physicsRef.current) return;

      const ndc = getNDCCoords(event);
      raycaster.setFromCamera(ndc, camera);

      // Check intersection with character meshes
      const intersects = raycaster.intersectObjects(vrmRef.current.scene.children, true);

      if (intersects.length > 0) {
        // Intersected character! Disable orbit controls and start physics interaction
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
        pointerCurrentPosRef.current.set(event.clientX, event.clientY);
        pointerLastPosRef.current.set(event.clientX, event.clientY);
        pointerDownTimeRef.current = performance.now();

        // Start elastic drag
        physicsRef.current.startDrag(hit.point, null);
      } else {
        // Hit empty background: enable orbit controls
        controls.enabled = true;
        isInteractingModelRef.current = false;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const ndc = getNDCCoords(event);
      raycaster.setFromCamera(ndc, camera);

      // 1. Update LookAt Target smoothly in front of avatar
      const ray = raycaster.ray;
      const targetPos = ray.origin.clone().add(ray.direction.clone().multiplyScalar(1.5));
      lookAtTarget.position.lerp(targetPos, 0.25);

      // 2. Calculate Pointer Velocity (pixels per second)
      const now = performance.now();
      const dt = Math.max(0.001, (now - (pointerDownTimeRef.current || now)) / 1000);
      const curX = event.clientX;
      const curY = event.clientY;
      const lastX = pointerLastPosRef.current.x;
      const lastY = pointerLastPosRef.current.y;

      pointerVelocityRef.current.set((curX - lastX) / dt, (curY - lastY) / dt);
      pointerLastPosRef.current.set(curX, curY);
      pointerCurrentPosRef.current.set(curX, curY);

      // 3. Update 3D Cursor Collider in physics
      if (physicsRef.current) {
        physicsRef.current.updateCursorPosition(ray);

        // 4. If actively dragging on model, update dragged spring position
        if (isInteractingModelRef.current && physicsRef.current.isDragging) {
          const planePoint = new THREE.Vector3();
          const charDepth = vrmRef.current ? vrmRef.current.scene.position.z : 0;
          const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -charDepth);
          if (ray.intersectPlane(plane, planePoint)) {
            physicsRef.current.updateDrag(planePoint);
          }
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
        const distance = Math.hypot(upX - downX, upY - downY);
        const duration = performance.now() - pointerDownTimeRef.current;

        // If movement was small & fast (< 15px and < 350ms): Slap / Poke!
        if (distance < 15 && duration < 350 && lastHitInfoRef.current) {
          physicsRef.current.applySlap(
            lastHitInfoRef.current.point,
            lastHitInfoRef.current.normal,
            pointerVelocityRef.current,
            null
          );
        } else if (physicsRef.current.isDragging) {
          // Elastic spring drag released!
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

    // Prevent context menu on canvas to make right-click camera orbit seamless
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    domElement.addEventListener('contextmenu', handleContextMenu);

    // 10. Animation & Render Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();

      // FPS tracking
      frameCount++;
      const now = performance.now();
      if (now - lastFpsUpdate >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsUpdate)));
        frameCount = 0;
        lastFpsUpdate = now;
      }

      // Update Character Physics & Spring Bones
      if (physicsRef.current) {
        physicsRef.current.update(delta);
        hitRipples.update(physicsRef.current.hitEffects);
      }

      // Update Camera Controls
      controls.update();

      // Render Frame
      renderer.render(scene, camera);
    };

    animate();

    // 11. Handle Resize
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const newW = containerRef.current.clientWidth;
      const newH = containerRef.current.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      domElement.removeEventListener('contextmenu', handleContextMenu);

      controls.dispose();
      hitRipples.dispose();
      if (physicsRef.current) physicsRef.current.dispose();
      renderer.dispose();
    };
  }, [handleResetCamera]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-zinc-950 select-none">
      <canvas ref={canvasRef} className="block w-full h-full cursor-grab active:cursor-grabbing touch-none" />
      <ZenUI
        isLoading={isLoading}
        loadingProgress={loadingProgress}
        onResetCamera={handleResetCamera}
        fps={fps}
      />
    </div>
  );
};
