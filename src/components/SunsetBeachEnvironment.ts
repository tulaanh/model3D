import * as THREE from 'three';

export class SunsetBeachEnvironment {
  public group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'SunsetBeachEnvironment';
    scene.add(this.group);

    this.setupStudioBackground(scene);
    this.createContactShadow();
    this.setupSunsetLighting(scene);
  }

  private setupStudioBackground(scene: THREE.Scene) {
    // Clean, high-performance studio showroom background
    scene.background = new THREE.Color('#141316');
  }

  private createContactShadow() {
    // Soft Circular Contact Shadow directly under Turntable Pedestal
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d');
    if (sctx) {
      const grad = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(10, 8, 12, 0.7)');
      grad.addColorStop(0.45, 'rgba(15, 12, 18, 0.3)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 128, 128);
    }

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.2),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = -0.061;
    this.group.add(shadowDisc);
  }

  private setupSunsetLighting(scene: THREE.Scene) {
    // 1. Warm Soft Ambient Fill Light (balanced for rich sculptural depth)
    const hemiLight = new THREE.HemisphereLight(0xffecd8, 0x222026, 1.0);
    scene.add(hemiLight);

    // 2. Main Studio Key Light (Golden Hour Key from rear-left)
    const sunLight = new THREE.DirectionalLight(0xffdfc2, 2.0);
    sunLight.position.set(-1.4, 2.0, 1.8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.2;
    sunLight.shadow.camera.far = 8;
    sunLight.shadow.camera.left = -0.7;
    sunLight.shadow.camera.right = 0.7;
    sunLight.shadow.camera.top = 0.8;
    sunLight.shadow.camera.bottom = -0.2;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.radius = 2.0;
    scene.add(sunLight);

    // 3. Fill Light (Soft light keeping front details readable)
    const fillLight = new THREE.DirectionalLight(0xffecd8, 0.85);
    fillLight.position.set(1.5, 1.2, -1.4);
    scene.add(fillLight);

    // 4. Oblique Cross-Rim Light (Rear-Right: sculpts right cheek curve and accentuates the central cleft shadow)
    const rimLight = new THREE.DirectionalLight(0xffbe94, 1.4);
    rimLight.position.set(1.6, 1.6, 1.6);
    scene.add(rimLight);
  }

  public dispose() {
    this.group.clear();
  }
}
