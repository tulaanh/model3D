import * as THREE from 'three';

export interface TorsoMeshes {
  torsoMesh: THREE.Mesh;
  bikiniMesh: THREE.Mesh;
  pedestalMesh: THREE.Mesh;
  basePositions: Float32Array;
  bikiniBasePositions: Float32Array;
  buttockVertexIndices: number[]; // indices of vertices that participate in jiggle physics
  leftCheekIndices: number[];
  rightCheekIndices: number[];
}

export function createTorsoScene(): TorsoMeshes {
  const Ny = 90;
  const Ntheta = 100;

  const yMin = -0.52;
  const yMax = 0.42;

  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const buttockVertexIndices: number[] = [];
  const leftCheekIndices: number[] = [];
  const rightCheekIndices: number[] = [];

  // 1. Generate Torso Body Vertices
  for (let iy = 0; iy < Ny; iy++) {
    const v = iy / (Ny - 1);
    const y = yMin + v * (yMax - yMin);

    // Profile radii
    let rx = 0.28;
    let rz_front = 0.17;
    let rz_back = 0.17;

    if (y > 0.15) {
      // Waist: tapers to hourglass narrowness at y = 0.42
      const t = (y - 0.15) / (yMax - 0.15);
      rx = 0.285 * (1.0 - t * 0.17);
      rz_front = 0.175 * (1.0 - t * 0.12);
      rz_back = 0.17 * (1.0 - t * 0.18);
    } else if (y > -0.22) {
      // Hips & Buttocks: wide flare
      const t = (y - (-0.22)) / (0.15 - (-0.22));
      const hipFlare = Math.sin(t * Math.PI) * 0.085;
      rx = 0.285 + hipFlare;
      rz_front = 0.175 + t * 0.015;
      const buttockCurve = Math.sin(t * Math.PI) * 0.135;
      rz_back = 0.17 + buttockCurve;
    } else {
      // Upper Thighs
      const t = (y - yMin) / (-0.22 - yMin);
      rx = 0.25 + t * 0.035;
      rz_front = 0.16 + t * 0.015;
      rz_back = 0.16 + t * 0.01;
    }

    for (let itheta = 0; itheta < Ntheta; itheta++) {
      const u = itheta / Ntheta;
      const theta = u * Math.PI * 2;

      const cos_t = Math.cos(theta);
      const sin_t = Math.sin(theta);

      // +Z is Back (Buttocks), -Z is Front (Abdomen)
      // +X is Right, -X is Left
      const rz = sin_t >= 0 ? rz_back : rz_front;

      let px = rx * cos_t;
      let pz = rz * sin_t;

      // Sculpt Buttocks & Intergluteal Cleft
      if (sin_t > 0.05 && y > -0.26 && y < 0.26) {
        const butt_h = Math.exp(-Math.pow((y - (-0.03)) / 0.15, 2));
        const distFromLobe = (Math.abs(px) - 0.13) / 0.115;
        const lobeShape = Math.exp(-Math.pow(distFromLobe, 2));

        // Plumpness addition
        const buttPop = 0.095 * butt_h * lobeShape * Math.pow(sin_t, 1.4);
        pz += buttPop;

        // Cleft indentation at px = 0
        const cleft = 0.075 * butt_h * Math.exp(-Math.pow(px / 0.038, 2)) * Math.pow(sin_t, 2);
        pz -= cleft;

        // Infragluteal crease fold
        if (y < -0.12) {
          const fold = Math.exp(-Math.pow((y - (-0.19)) / 0.055, 2)) * Math.pow(sin_t, 2);
          pz -= 0.035 * fold;
        }
      }

      // Lower back spine indent
      if (sin_t > 0.2 && y > 0.18) {
        const spine = 0.02 * Math.exp(-Math.pow(px / 0.032, 2)) * ((y - 0.18) / (yMax - 0.18));
        pz -= spine;
      }

      // Leg separation / inner thigh gap
      if (y < -0.16) {
        const thighDepth = (-0.16 - y) / (-0.16 - yMin);
        const innerGap = 0.055 * thighDepth * Math.exp(-Math.pow(px / 0.045, 2));
        if (sin_t >= 0) {
          pz -= innerGap * 1.1;
        } else {
          pz += innerGap * 0.8;
        }

        if (Math.abs(px) < 0.055) {
          const pinch = (1.0 - Math.abs(px) / 0.055) * 0.035 * thighDepth;
          if (sin_t >= 0) pz = Math.max(0.015, pz - pinch);
          else pz = Math.min(-0.015, pz + pinch);
        }
      }

      const vertIdx = vertices.length / 3;
      vertices.push(px, y, pz);
      uvs.push(u, v);

      // Track buttock vertices for soft-body jiggle physics
      if (sin_t > 0.15 && y > -0.24 && y < 0.22) {
        buttockVertexIndices.push(vertIdx);
        if (px > 0.02) {
          rightCheekIndices.push(vertIdx);
        } else if (px < -0.02) {
          leftCheekIndices.push(vertIdx);
        }
      }
    }
  }

  // Generate Quads/Triangles for Torso
  for (let iy = 0; iy < Ny - 1; iy++) {
    for (let itheta = 0; itheta < Ntheta; itheta++) {
      const nextTheta = (itheta + 1) % Ntheta;

      const p1 = iy * Ntheta + itheta;
      const p2 = iy * Ntheta + nextTheta;
      const p3 = (iy + 1) * Ntheta + nextTheta;
      const p4 = (iy + 1) * Ntheta + itheta;

      indices.push(p1, p2, p3);
      indices.push(p1, p3, p4);
    }
  }

  // Create Torso Geometry
  const torsoGeo = new THREE.BufferGeometry();
  const basePositions = new Float32Array(vertices);
  torsoGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
  torsoGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  torsoGeo.setIndex(indices);
  torsoGeo.computeVertexNormals();

  // Beautiful Realistic Skin Shader / PBR Material
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e0ab88'),
    roughness: 0.35,
    metalness: 0.02,
    clearcoat: 0.25,
    clearcoatRoughness: 0.2,
    sheen: 0.5,
    sheenColor: new THREE.Color('#ffd6c2'),
    transmission: 0.05,
    thickness: 0.5,
    attenuationColor: new THREE.Color('#ff8c7a'),
    attenuationDistance: 0.6,
  });

  const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;

  // 2. Generate Conformal Bikini Thong Geometry
  // We extract and offset the vertices that form the panties and waistband
  const bikiniVerts: number[] = [];
  const bikiniUvs: number[] = [];
  const bikiniIndices: number[] = [];
  const bikiniVertexMap = new Map<number, number>();

  const normals = torsoGeo.attributes.normal.array as Float32Array;

  // Check if a vertex is part of the bikini
  const isBikiniVertex = (px: number, py: number, pz: number): boolean => {
    // 1. High-waist side straps encircling the hips
    if (py >= 0.18 && py <= 0.22) {
      return true;
    }
    // 2. Back Thong: triangle tapering down
    if (pz > 0 && py > -0.22 && py < 0.22) {
      // Width tapers from 0.09 at top to 0.025 at bottom
      const t = (py - (-0.22)) / (0.22 - (-0.22));
      const maxWidth = 0.025 + t * 0.075;
      if (Math.abs(px) <= maxWidth) return true;
    }
    // 3. Front Triangle: coverage over pelvis
    if (pz < 0 && py > -0.22 && py < 0.22) {
      const t = (py - (-0.22)) / (0.22 - (-0.22));
      const maxWidth = 0.035 + t * 0.085;
      if (Math.abs(px) <= maxWidth) return true;
    }
    return false;
  };

  // Build bikini geometry from matching torso faces
  for (let iy = 0; iy < Ny - 1; iy++) {
    for (let itheta = 0; itheta < Ntheta; itheta++) {
      const nextTheta = (itheta + 1) % Ntheta;

      const p1 = iy * Ntheta + itheta;
      const p2 = iy * Ntheta + nextTheta;
      const p3 = (iy + 1) * Ntheta + nextTheta;
      const p4 = (iy + 1) * Ntheta + itheta;

      const v1 = [vertices[p1 * 3], vertices[p1 * 3 + 1], vertices[p1 * 3 + 2]];
      const v2 = [vertices[p2 * 3], vertices[p2 * 3 + 1], vertices[p2 * 3 + 2]];
      const v3 = [vertices[p3 * 3], vertices[p3 * 3 + 1], vertices[p3 * 3 + 2]];
      const v4 = [vertices[p4 * 3], vertices[p4 * 3 + 1], vertices[p4 * 3 + 2]];

      const b1 = isBikiniVertex(v1[0], v1[1], v1[2]);
      const b2 = isBikiniVertex(v2[0], v2[1], v2[2]);
      const b3 = isBikiniVertex(v3[0], v3[1], v3[2]);
      const b4 = isBikiniVertex(v4[0], v4[1], v4[2]);

      const getOrAddBikiniVertex = (origIdx: number): number => {
        if (bikiniVertexMap.has(origIdx)) {
          return bikiniVertexMap.get(origIdx)!;
        }
        const nx = normals[origIdx * 3];
        const ny = normals[origIdx * 3 + 1];
        const nz = normals[origIdx * 3 + 2];
        const offset = 0.0035; // slightly above skin to avoid z-fighting

        const newIdx = bikiniVerts.length / 3;
        bikiniVerts.push(
          vertices[origIdx * 3] + nx * offset,
          vertices[origIdx * 3 + 1] + ny * offset,
          vertices[origIdx * 3 + 2] + nz * offset
        );
        bikiniUvs.push(uvs[origIdx * 2], uvs[origIdx * 2 + 1]);
        bikiniVertexMap.set(origIdx, newIdx);
        return newIdx;
      };

      if (b1 && b2 && b3) {
        bikiniIndices.push(
          getOrAddBikiniVertex(p1),
          getOrAddBikiniVertex(p2),
          getOrAddBikiniVertex(p3)
        );
      }
      if (b1 && b3 && b4) {
        bikiniIndices.push(
          getOrAddBikiniVertex(p1),
          getOrAddBikiniVertex(p3),
          getOrAddBikiniVertex(p4)
        );
      }
    }
  }

  const bikiniGeo = new THREE.BufferGeometry();
  const bikiniBasePositions = new Float32Array(bikiniVerts);
  bikiniGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bikiniVerts), 3));
  bikiniGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(bikiniUvs), 2));
  bikiniGeo.setIndex(bikiniIndices);
  bikiniGeo.computeVertexNormals();

  // Bikini Material: Pearl (white silk satin) by default
  const bikiniMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fdfcf8'),
    roughness: 0.3,
    metalness: 0.1,
    clearcoat: 0.2,
    sheen: 0.8,
    sheenColor: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide,
  });

  const bikiniMesh = new THREE.Mesh(bikiniGeo, bikiniMat);
  bikiniMesh.castShadow = true;
  bikiniMesh.receiveShadow = true;

  // 3. Circular Turntable Pedestal Base
  const pedestalGeo = new THREE.CylinderGeometry(0.44, 0.47, 0.065, 64);
  const pedestalMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dfcbba'),
    roughness: 0.65,
    metalness: 0.05,
  });
  const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestalMesh.position.set(0, yMin - 0.032, 0);
  pedestalMesh.receiveShadow = true;
  pedestalMesh.castShadow = true;

  return {
    torsoMesh,
    bikiniMesh,
    pedestalMesh,
    basePositions,
    bikiniBasePositions,
    buttockVertexIndices,
    leftCheekIndices,
    rightCheekIndices,
  };
}
