import * as THREE from 'three';

export class SunsetBeachEnvironment {
  public group: THREE.Group;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
  private environmentSource: THREE.CanvasTexture | null = null;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.group = new THREE.Group();
    this.group.name = 'SunsetBeachEnvironment';
    scene.add(this.group);

    this.setupStudioBackground(scene);
    this.setupEnvironment(scene, renderer);
    this.createContactShadow();
    this.setupSunsetLighting(scene);
  }

  private setupEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    // Lightweight equirectangular studio panorama: broad softboxes give
    // PhysicalMaterials stable highlights without downloading an HDR asset.
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return;

    const background = context.createLinearGradient(0, 0, 0, canvas.height);
    background.addColorStop(0, '#111218');
    background.addColorStop(0.48, '#34313a');
    background.addColorStop(1, '#090a0e');
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const softbox = (x: number, y: number, radius: number, color: string) => {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };

    softbox(110, 55, 125, 'rgba(255, 226, 203, 0.82)');
    softbox(390, 92, 105, 'rgba(255, 166, 128, 0.58)');
    softbox(255, 188, 150, 'rgba(152, 174, 214, 0.24)');

    const source = new THREE.CanvasTexture(canvas);
    source.colorSpace = THREE.SRGBColorSpace;
    this.environmentSource = source;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    this.environmentTarget = pmrem.fromEquirectangular(source);
    scene.environment = this.environmentTarget.texture;
    pmrem.dispose();
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
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.2;
    sunLight.shadow.camera.far = 8;
    sunLight.shadow.camera.left = -0.55;
    sunLight.shadow.camera.right = 0.55;
    sunLight.shadow.camera.top = 0.65;
    sunLight.shadow.camera.bottom = -0.12;
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
    this.environmentSource?.dispose();
    this.environmentTarget?.dispose();
    this.environmentSource = null;
    this.environmentTarget = null;
  }
}
