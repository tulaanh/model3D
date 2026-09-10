import * as THREE from 'three';

export type BikiniVariant = 'Pearl' | 'Noir';

export interface PBRTextureSet {
  diffuseMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

export class BikiniTextureGenerator {
  private static cachedTextures: Map<BikiniVariant, PBRTextureSet> = new Map();

  public static getTextureSet(variant: BikiniVariant): PBRTextureSet {
    if (this.cachedTextures.has(variant)) {
      return this.cachedTextures.get(variant)!;
    }

    const width = 2048;
    const height = 2048;

    // 1. Diffuse / BaseColor Canvas
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = width;
    diffCanvas.height = height;
    const diffCtx = diffCanvas.getContext('2d')!;

    // 2. Roughness Canvas
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = width;
    roughCanvas.height = height;
    const roughCtx = roughCanvas.getContext('2d')!;

    // 3. Normal / Bump Canvas
    const normCanvas = document.createElement('canvas');
    normCanvas.width = width;
    normCanvas.height = height;
    const normCtx = normCanvas.getContext('2d')!;

    // --- BASE SKIN FILL ---
    // Warm natural skin gradient
    const skinGrad = diffCtx.createLinearGradient(0, height, 0, 0);
    skinGrad.addColorStop(0.0, '#e5b699'); // Thighs
    skinGrad.addColorStop(0.45, '#e0aa8b'); // Buttocks
    skinGrad.addColorStop(0.70, '#dfa685'); // Hips
    skinGrad.addColorStop(1.0, '#e3ad8e'); // Waist
    diffCtx.fillStyle = skinGrad;
    diffCtx.fillRect(0, 0, width, height);

    // Skin roughness: 0.45 (115 out of 255)
    roughCtx.fillStyle = 'rgb(115, 115, 115)';
    roughCtx.fillRect(0, 0, width, height);

    // Normal base: Flat [128, 128, 255]
    normCtx.fillStyle = 'rgb(128, 128, 255)';
    normCtx.fillRect(0, 0, width, height);

    // --- DRAW BIKINI PATH (THONG + WAIST STRAPS) ---
    // Geometry mapping:
    // u = 0.25 is Back (Buttocks)
    // u = 0.75 is Front (Abdomen)
    // v in [0, 1] mapped to [height, 0] in Canvas Y (Canvas Y = (1 - v) * height)

    const toX = (u: number) => u * width;
    const toY = (v: number) => (1.0 - v) * height;

    const vStrapTop = 0.68;
    const vStrapBottom = 0.63;
    const vBackThongBottom = 0.37;
    const vFrontBottom = 0.36;

    const drawBikiniShapes = (ctx: CanvasRenderingContext2D, isFill: boolean = true) => {
      ctx.beginPath();

      // 1. High-waist side straps (continuous strip across waist)
      const yStrapTop = toY(vStrapTop);
      const yStrapBot = toY(vStrapBottom);
      ctx.rect(0, yStrapTop, width, yStrapBot - yStrapTop);

      // 2. Back V-Thong (Centered at u = 0.25)
      const uBackCenter = 0.25;
      const wBackTop = 0.08;
      const wBackMid = 0.035;
      const wBackBot = 0.022;

      ctx.moveTo(toX(uBackCenter - wBackTop), toY(vStrapBottom));
      ctx.bezierCurveTo(
        toX(uBackCenter - wBackMid),
        toY(0.50),
        toX(uBackCenter - wBackBot),
        toY(0.42),
        toX(uBackCenter - wBackBot),
        toY(vBackThongBottom)
      );
      ctx.lineTo(toX(uBackCenter + wBackBot), toY(vBackThongBottom));
      ctx.bezierCurveTo(
        toX(uBackCenter + wBackBot),
        toY(0.42),
        toX(uBackCenter + wBackMid),
        toY(0.50),
        toX(uBackCenter + wBackTop),
        toY(vStrapBottom)
      );
      ctx.closePath();

      // 3. Front Triangle (Centered at u = 0.75)
      const uFrontCenter = 0.75;
      const wFrontTop = 0.105;
      const wFrontMid = 0.06;
      const wFrontBot = 0.032;

      ctx.moveTo(toX(uFrontCenter - wFrontTop), toY(vStrapBottom));
      ctx.bezierCurveTo(
        toX(uFrontCenter - wFrontMid),
        toY(0.50),
        toX(uFrontCenter - wFrontBot),
        toY(0.42),
        toX(uFrontCenter - wFrontBot),
        toY(vFrontBottom)
      );
      ctx.lineTo(toX(uFrontCenter + wFrontBot), toY(vFrontBottom));
      ctx.bezierCurveTo(
        toX(uFrontCenter + wFrontBot),
        toY(0.42),
        toX(uFrontCenter + wFrontMid),
        toY(0.50),
        toX(uFrontCenter + wFrontTop),
        toY(vStrapBottom)
      );
      ctx.closePath();

      if (isFill) {
        ctx.fill();
      }
    };

    // --- RENDER DIFFUSE BIKINI ---
    diffCtx.save();
    if (variant === 'Pearl') {
      // Creamy pearl white with soft silk gradient
      const pearlGrad = diffCtx.createLinearGradient(0, toY(vStrapTop), 0, toY(vBackThongBottom));
      pearlGrad.addColorStop(0.0, '#ffffff');
      pearlGrad.addColorStop(0.4, '#fdfbf7');
      pearlGrad.addColorStop(1.0, '#f5efe6');
      diffCtx.fillStyle = pearlGrad;
    } else {
      // Noir black satin with subtle dark luster
      const noirGrad = diffCtx.createLinearGradient(0, toY(vStrapTop), 0, toY(vBackThongBottom));
      noirGrad.addColorStop(0.0, '#222226');
      noirGrad.addColorStop(0.5, '#18181b');
      noirGrad.addColorStop(1.0, '#101012');
      diffCtx.fillStyle = noirGrad;
    }

    drawBikiniShapes(diffCtx, true);

    // Add fine stitching detail along borders
    diffCtx.strokeStyle = variant === 'Pearl' ? 'rgba(215, 205, 195, 0.7)' : 'rgba(50, 50, 55, 0.7)';
    diffCtx.lineWidth = 3;
    diffCtx.setLineDash([6, 5]);
    drawBikiniShapes(diffCtx, false);
    diffCtx.stroke();
    diffCtx.restore();

    // --- RENDER ROUGHNESS BIKINI ---
    roughCtx.save();
    // Silk satin roughness: 0.22 (56 out of 255) -> much shinier than skin
    roughCtx.fillStyle = 'rgb(56, 56, 56)';
    drawBikiniShapes(roughCtx, true);
    roughCtx.restore();

    // --- RENDER NORMAL MAP BIKINI SEAM / HEM ---
    normCtx.save();
    // Raised hem border (subtle bevel)
    normCtx.strokeStyle = 'rgb(148, 128, 255)'; // +X normal bevel
    normCtx.lineWidth = 6;
    drawBikiniShapes(normCtx, false);
    normCtx.stroke();
    normCtx.restore();

    const diffuseMap = new THREE.CanvasTexture(diffCanvas);
    diffuseMap.colorSpace = THREE.SRGBColorSpace;

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);

    const normalMap = new THREE.CanvasTexture(normCanvas);

    const set: PBRTextureSet = { diffuseMap, roughnessMap, normalMap };
    this.cachedTextures.set(variant, set);
    return set;
  }
}
