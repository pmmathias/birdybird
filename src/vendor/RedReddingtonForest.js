/*
 * RedReddingtonForest.js
 *
 * Procedural L-system instanced forest with per-tree root spread, vertex-shader
 * LOD, distance green-tint on bark, and per-leaf sway.
 *
 * Original author: red-reddington (https://codepen.io/the-red-reddington)
 * Source: CodePen "Procedural Trees - Instanced High Performance" (JoXxmzY)
 * Thread: https://discourse.threejs.org/t/procedural-instanced-forest-high-performance-real-trees/88610
 *
 * License: MIT — author granted permission and encouraged reuse.
 *
 * Adaptation for birdybird (2026-04-20):
 *   - Ported from CodePen HTML to an ES module
 *   - CONFIG exposed via constructor options instead of a global
 *   - Demo-harness bits (lil-gui, stats-gl, OrbitControls, sky sphere, ground)
 *     removed — only the forest generator + procedural textures remain
 *   - Tree Y-position is left to the caller (flat y=0 by default). birdybird
 *     snaps trees to terrain via an optional `groundHeightFn(x, z)` callback.
 *
 * Kept as close to the original as reasonably possible so we can track
 * upstream improvements if red-reddington keeps iterating.
 */

import * as THREE from 'three';
import { createBarkNodeMaterial, createLeafNodeMaterial } from './RedReddingtonForestNode.js';

export const DEFAULT_CONFIG = {
  // Forest
  TREE_COUNT: 4500,
  FOREST_RADIUS: 80,
  CLEAR_RADIUS: 5,

  // Tree structure
  TRUNK_LENGTH_MIN: 4,
  TRUNK_LENGTH_MAX: 7,
  TRUNK_RADIUS_MIN: 0.18,
  TRUNK_RADIUS_MAX: 0.35,
  BRANCH_LEVELS: 4,
  BRANCH_ANGLE: 0.55,
  BRANCH_ANGLE_VARIANCE: 0.25,
  LENGTH_FALLOFF: 0.68,
  RADIUS_FALLOFF: 0.55,
  BRANCHES_PER_NODE: 3,
  TWIST: 0.5,

  // Leaves
  LEAF_SIZE: 0.8,
  LEAF_DENSITY: 4,
  LEAF_SPREAD: 0.8,

  // Colors
  BARK_COLOR: [0.24, 0.16, 0.09],
  BARK_DISTANT_TINT: [0.29, 0.52, 0.27],
  // Wide leaf-hue range so neighbouring trees read as different species:
  // ochre (0.12) → olive (0.18) → leaf-green (0.27) → forest-green (0.33)
  // → cool teal-green (0.42) → blue-spruce edge (0.48). Saturation +
  // lightness also vary widely. Per-leaf jitter on top adds intra-tree
  // shading.
  LEAF_HUE_MIN: 0.12,
  LEAF_HUE_MAX: 0.48,
  LEAF_SATURATION: 0.55,
  LEAF_LIGHTNESS_MIN: 0.22,
  LEAF_LIGHTNESS_MAX: 0.6,

  LEAF_TINGE_PERCENT: 0.15,
  LEAF_TINGE_YELLOW_CHANCE: 0.5,
  LEAF_TINGE_HUE_SHIFT: 0.03,
  LEAF_TINGE_SAT_SHIFT: 0.28,
  LEAF_TINGE_LIGHT_SHIFT: 0.09,

  // LOD
  LOD_FADE_START: 120,
  LOD_MAX_DISTANCE: 200,
  LOD_SWAY_DISTANCE: 50,
  LOD_SWAY_FADE_START: 30,

  // Roots
  ROOT_SPREAD_MIN: 0.2,
  ROOT_SPREAD_MAX: 0.6,
  ROOT_HEIGHT_MIN: 0.3,
  ROOT_HEIGHT_MAX: 0.6,
  ROOT_BUMPS_MIN: 2,
  ROOT_BUMPS_MAX: 5,

  // Rendering
  BARK_SEGMENTS: 8,
};

// ============================================================================
// PROCEDURAL LEAF TEXTURE
// ============================================================================

export function createLeafTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  function leafPath(ctx) {
    const s = size;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.03);
    ctx.bezierCurveTo(s * 0.78, s * 0.18, s * 0.82, s * 0.65, s * 0.5, s * 0.97);
    ctx.bezierCurveTo(s * 0.18, s * 0.65, s * 0.22, s * 0.18, s * 0.5, s * 0.03);
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#6ab560');
  gradient.addColorStop(0.3, '#5aa052');
  gradient.addColorStop(0.7, '#4a9045');
  gradient.addColorStop(1, '#3d8038');

  leafPath(ctx);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.globalCompositeOperation = 'overlay';
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const brightness = Math.random() * 40 - 20;
    ctx.fillStyle = `rgba(${128 + brightness}, ${128 + brightness}, ${128 + brightness}, 0.04)`;
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.globalCompositeOperation = 'source-over';

  ctx.save();
  leafPath(ctx);
  ctx.clip();

  ctx.strokeStyle = 'rgba(35, 60, 30, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.08);
  ctx.quadraticCurveTo(size * 0.5, size * 0.5, size * 0.5, size * 0.92);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(140, 180, 130, 0.1)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.1);
  ctx.quadraticCurveTo(size * 0.48, size * 0.5, size * 0.5, size * 0.88);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(40, 65, 35, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = size * (0.2 + i * 0.11);
    const spread = size * (0.18 + i * 0.02);
    ctx.beginPath();
    ctx.moveTo(size * 0.5, y);
    ctx.quadraticCurveTo(size * 0.5 - spread * 0.5, y + size * 0.04, size * 0.5 - spread, y + size * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.5, y);
    ctx.quadraticCurveTo(size * 0.5 + spread * 0.5, y + size * 0.04, size * 0.5 + spread, y + size * 0.06);
    ctx.stroke();
  }
  ctx.restore();

  ctx.globalCompositeOperation = 'source-atop';
  const edgeGradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size * 0.5);
  edgeGradient.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGradient.addColorStop(0.7, 'rgba(0,0,0,0)');
  edgeGradient.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = edgeGradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

// ============================================================================
// PROCEDURAL BARK TEXTURE
// ============================================================================

export function createBarkTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#4a3520';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const width = 1 + Math.random() * 4;
    const lightness = Math.random() > 0.5 ? 25 : -25;
    ctx.fillStyle = `rgba(${100 + lightness}, ${60 + lightness}, ${30 + lightness}, 0.4)`;
    ctx.fillRect(x, 0, width, size);
  }

  for (let i = 0; i < 20; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.15 + Math.random() * 0.25})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < size; x += 8) {
      ctx.lineTo(x, y + (Math.random() - 0.5) * 6);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 15; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 5 + Math.random() * 15;
    const h = 20 + Math.random() * 40;
    ctx.fillStyle = `rgba(160, 120, 80, ${0.1 + Math.random() * 0.15})`;
    ctx.fillRect(x, y, w, h);
  }

  for (let i = 0; i < 800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const b = Math.random() > 0.5 ? 35 : -35;
    ctx.fillStyle = `rgba(${100 + b}, ${65 + b}, ${35 + b}, 0.15)`;
    ctx.fillRect(x, y, 2, 2);
  }

  for (let i = 0; i < 5; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(20, 10, 5, ${0.3 + Math.random() * 0.3})`;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

// ============================================================================
// INSTANCED FOREST GENERATOR
// ============================================================================

export class InstancedForest {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
    this.treeCount = options.treeCount ?? this.config.TREE_COUNT;
    this.forestRadius = options.forestRadius ?? this.config.FOREST_RADIUS;
    this.forestCenter = options.forestCenter || new THREE.Vector3(0, 0, 0);
    this.groundHeightFn = options.groundHeightFn || null; // (x,z) → y
    this.groundFilterFn = options.groundFilterFn || null; // (x,y,z) → boolean
    this.treePositions = options.treePositions || null;   // pre-computed [{x,z}]
    this.seed = options.seed ?? 0;
    // When true, `_buildMeshes` emits NodeMaterial-based bark + leaf materials
    // compatible with WebGPURenderer. Default (false) uses the original
    // GLSL ShaderMaterials — no visual regression on WebGL.
    this.useWebGPU = !!options.useWebGPU;

    this.branchMatrices = [];
    this.branchTreeBaseY = []; // per-branch: Y of the tree's base (for terrain placement)
    this.leafMatrices = [];
    this.leafColors = [];
    this.leafRandoms = [];
    this.leafWobbleX = [];
    this.leafWobbleY = [];
    this.leafSwayPhase = [];
    this._currentTreeBaseY = 0;

    this.group = new THREE.Group();
    this.meshes = {};

    this._matrix = new THREE.Matrix4();
    this._quaternion = new THREE.Quaternion();
    this._scale = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._color = new THREE.Color();

    this._leafGeo = new THREE.PlaneGeometry(1, 1);
    this._leafGeo.computeBoundingBox();
    this._leafBottomY = this._leafGeo.boundingBox.min.y;
  }

  _mulberry32(seed) {
    return () => {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  generate(leafTexture, barkTexture) {
    this.branchMatrices = [];
    this.branchTreeBaseY = [];
    this.leafMatrices = [];
    this.leafColors = [];
    this.leafRandoms = [];
    this.leafWobbleX = [];
    this.leafWobbleY = [];
    this.leafSwayPhase = [];

    // Broadleaf shapes only. Stack-cone conifers (above ALPINE_ZONE)
    // are built separately in src/world/StackConeConifers.js.
    const treeTypes = [
      { levels: 4, branchAngle: 0.5, lengthFalloff: 0.7, radiusFalloff: 0.55, branches: 3 },
      { levels: 5, branchAngle: 0.4, lengthFalloff: 0.65, radiusFalloff: 0.5, branches: 2 },
      { levels: 4, branchAngle: 0.65, lengthFalloff: 0.72, radiusFalloff: 0.6, branches: 4 },
      { levels: 3, branchAngle: 0.55, lengthFalloff: 0.75, radiusFalloff: 0.58, branches: 3 },
      { levels: 4, branchAngle: 0.48, lengthFalloff: 0.68, radiusFalloff: 0.52, branches: 3 },
    ];

    let placed = 0;
    let attempts = 0;
    const hasPreset = Array.isArray(this.treePositions) && this.treePositions.length > 0;
    const maxAttempts = hasPreset
      ? this.treePositions.length
      : this.treeCount * 6;
    const seedBase = this.seed;

    while (placed < this.treeCount && attempts < maxAttempts) {
      const i = attempts;
      attempts++;
      const rand = this._mulberry32(i * 54321 + 11111 + seedBase);

      let treeX, treeZ;
      if (hasPreset) {
        const p = this.treePositions[i];
        if (!p) break;
        treeX = p.x;
        treeZ = p.z;
      } else {
        const r = this.config.CLEAR_RADIUS + Math.sqrt(rand()) * this.forestRadius;
        const theta = rand() * Math.PI * 2;
        treeX = this.forestCenter.x + Math.cos(theta) * r;
        treeZ = this.forestCenter.z + Math.sin(theta) * r;
      }
      let treeY = this.forestCenter.y;
      if (this.groundHeightFn) treeY = this.groundHeightFn(treeX, treeZ);
      if (this.groundFilterFn && !this.groundFilterFn(treeX, treeY, treeZ)) continue;
      const treeRotation = rand() * Math.PI * 2;

      const typeIndex = Math.floor(rand() * treeTypes.length);
      const treeType = treeTypes[typeIndex];
      const leafHue = this.config.LEAF_HUE_MIN + rand() * (this.config.LEAF_HUE_MAX - this.config.LEAF_HUE_MIN);
      const leafLightness = this.config.LEAF_LIGHTNESS_MIN + rand() * (this.config.LEAF_LIGHTNESS_MAX - this.config.LEAF_LIGHTNESS_MIN);

      const treeScale = 0.6 + rand() * 0.8;
      const trunkLength = (this.config.TRUNK_LENGTH_MIN + rand() * (this.config.TRUNK_LENGTH_MAX - this.config.TRUNK_LENGTH_MIN)) * treeScale;
      const trunkRadius = (this.config.TRUNK_RADIUS_MIN + rand() * (this.config.TRUNK_RADIUS_MAX - this.config.TRUNK_RADIUS_MIN)) * treeScale;

      this._currentTreeBaseY = treeY;
      this._generateTree(treeX, treeY, treeZ, treeRotation, treeScale, leafHue, leafLightness, trunkLength, trunkRadius, treeType, rand);
      placed++;
    }

    this._buildMeshes(leafTexture, barkTexture);

    return {
      group: this.group,
      stats: {
        trees: placed,
        branches: this.branchMatrices.length,
        leaves: this.leafMatrices.length,
      },
    };
  }

  _generateTree(x, y, z, rotation, scale, leafHue, leafLightness, trunkLength, trunkRadius, treeType, rand) {
    const origin = new THREE.Vector3(x, y, z);
    const direction = new THREE.Vector3(0, 1, 0);

    direction.x += (rand() - 0.5) * 0.12;
    direction.z += (rand() - 0.5) * 0.12;
    direction.normalize();

    this._branch(origin, direction, trunkLength, trunkRadius, 0, rotation, scale, leafHue, leafLightness, treeType, rand);
  }

  _branch(start, direction, length, radius, level, treeRotation, treeScale, leafHue, leafLightness, treeType, rand) {
    if (level > treeType.levels || radius < 0.012) return;

    const end = start.clone().addScaledVector(direction, length);
    const mid = start.clone().lerp(end, 0.5);

    this._quaternion.setFromUnitVectors(this._up, direction.clone().normalize());
    const topRadius = radius * treeType.radiusFalloff;
    const avgRadius = (radius + topRadius) * 0.5;
    this._scale.set(avgRadius, length, avgRadius);
    this._matrix.compose(mid, this._quaternion, this._scale);
    this.branchMatrices.push(this._matrix.clone());
    this.branchTreeBaseY.push(this._currentTreeBaseY);

    if (level >= treeType.levels - 1) {
      this._addLeaves(end, direction, treeScale, leafHue, leafLightness, rand, topRadius, level, treeType.levels);
    }

    if (level < treeType.levels) {
      const numChildren = level === 0
        ? treeType.branches + Math.floor(rand() * 2)
        : Math.max(1, treeType.branches - Math.floor(level * 0.3));

      const startT0 = 0.4;
      const startT1 = 0.9;
      for (let i = 0; i < numChildren; i++) {
        const twistAngle = (i / numChildren) * Math.PI * 2 + rand() * this.config.TWIST + treeRotation;
        const bendAngle = treeType.branchAngle + (rand() - 0.5) * this.config.BRANCH_ANGLE_VARIANCE * 2;

        const perp = new THREE.Vector3(1, 0, 0);
        if (Math.abs(direction.y) < 0.9) {
          perp.crossVectors(this._up, direction).normalize();
        } else {
          perp.crossVectors(new THREE.Vector3(0, 0, 1), direction).normalize();
        }

        const childDir = direction.clone();
        childDir.applyAxisAngle(perp, bendAngle);
        childDir.applyAxisAngle(direction, twistAngle);
        childDir.normalize();

        const startT = startT0 + rand() * (startT1 - startT0);
        const childStart = start.clone().lerp(end, startT);
        const childLength = length * treeType.lengthFalloff * (0.8 + rand() * 0.4);
        const childRadius = radius * treeType.radiusFalloff;

        this._branch(childStart, childDir, childLength, childRadius, level + 1, treeRotation, treeScale, leafHue, leafLightness, treeType, rand);
      }
    }
  }

  _addLeaves(branchEnd, branchDir, treeScale, leafHue, leafLightness, rand, topRadius, level, maxLevel) {
    const count = this.config.LEAF_DENSITY + Math.floor(rand() * 3);
    const size = this.config.LEAF_SIZE * treeScale;
    const spread = this.config.LEAF_SPREAD * treeScale;

    const perp1 = new THREE.Vector3(1, 0, 0);
    if (Math.abs(branchDir.y) > 0.9) perp1.set(0, 0, 1);
    perp1.crossVectors(branchDir, perp1).normalize();
    const perp2 = new THREE.Vector3().crossVectors(branchDir, perp1).normalize();

    for (let i = 0; i < count; i++) {
      const aroundAngle = rand() * Math.PI * 2;
      const outward = new THREE.Vector3()
        .addScaledVector(perp1, Math.cos(aroundAngle))
        .addScaledVector(perp2, Math.sin(aroundAngle))
        .normalize();

      const branchRadius = topRadius;
      const attachPoint = branchEnd.clone().addScaledVector(outward, branchRadius);

      const stemDir = new THREE.Vector3()
        .addScaledVector(outward, 0.5 + rand() * 0.3)
        .addScaledVector(branchDir, 0.3 + rand() * 0.4)
        .add(new THREE.Vector3(0, 0.2 + rand() * 0.3, 0))
        .normalize();

      const leafUp = stemDir.clone();

      let leafNormal = new THREE.Vector3(0, 1, 0).addScaledVector(outward, (rand() - 0.5) * 0.5);
      leafNormal.sub(leafUp.clone().multiplyScalar(leafNormal.dot(leafUp))).normalize();

      if (leafNormal.lengthSq() < 0.1) {
        leafNormal.copy(outward);
        leafNormal.sub(leafUp.clone().multiplyScalar(leafNormal.dot(leafUp))).normalize();
      }

      const leafRight = new THREE.Vector3().crossVectors(leafUp, leafNormal).normalize();
      leafNormal.crossVectors(leafRight, leafUp).normalize();

      const rotMatrix = new THREE.Matrix4();
      rotMatrix.makeBasis(leafRight, leafUp, leafNormal);

      const jitterQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (rand() - 0.5) * 0.3,
        (rand() - 0.5) * 0.3,
        (rand() - 0.5) * 0.2,
      ));
      const leafQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
      leafQuat.multiply(jitterQuat);

      const localBottom = new THREE.Vector3(0, this._leafBottomY, 0);
      const rotatedBottom = localBottom.clone().applyQuaternion(leafQuat);

      const taperFactor = 0.8 + 0.2 * (1 - level / maxLevel);
      const leafScale = size * (0.5 + rand() * 0.5) * taperFactor;

      const leafPos = attachPoint.clone().sub(rotatedBottom.clone().multiplyScalar(leafScale));

      this._scale.set(leafScale, leafScale, leafScale);
      this._matrix.compose(leafPos, leafQuat, this._scale);
      this.leafMatrices.push(this._matrix.clone());

      // Stronger per-leaf jitter so a single tree shows highlighted +
      // shadowed leaf variation instead of a uniform mass.
      let h = leafHue + (rand() - 0.5) * 0.10;
      let s = this.config.LEAF_SATURATION + (rand() - 0.3) * 0.30;
      let l = leafLightness + (rand() - 0.5) * 0.18;

      if (rand() < this.config.LEAF_TINGE_PERCENT) {
        if (rand() < this.config.LEAF_TINGE_YELLOW_CHANCE) {
          h += this.config.LEAF_TINGE_HUE_SHIFT;
          l = Math.min(1.0, l + this.config.LEAF_TINGE_LIGHT_SHIFT);
        } else {
          s = Math.max(0.0, s - this.config.LEAF_TINGE_SAT_SHIFT);
          l = Math.max(0.0, l - this.config.LEAF_TINGE_LIGHT_SHIFT);
        }
      }

      this._color.setHSL(h, s, l);
      this.leafColors.push(this._color.r, this._color.g, this._color.b);

      const leafRand = rand();
      const wobbleX = (rand() - 0.5) * 0.12;
      const wobbleY = (rand() - 0.5) * 0.12;
      const swayPhase = rand() * Math.PI * 2.0;

      this.leafRandoms.push(leafRand);
      this.leafWobbleX.push(wobbleX);
      this.leafWobbleY.push(wobbleY);
      this.leafSwayPhase.push(swayPhase);
    }
  }

  _buildMeshes(leafTexture, barkTexture) {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.group.remove(child);
    }

    // --- BARK ---
    if (this.branchMatrices.length > 0) {
      const barkGeo = new THREE.CylinderGeometry(1, 1, 1, this.config.BARK_SEGMENTS, 1);
      const barkMat = new THREE.ShaderMaterial({
        uniforms: {
          barkTexture: { value: barkTexture },
          barkColor: { value: new THREE.Color(...this.config.BARK_COLOR) },
          leafTintColor: { value: new THREE.Color(...this.config.BARK_DISTANT_TINT) },
          sunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
          sunColor: { value: new THREE.Color(1.0, 0.98, 0.9) },
          ambientLight: { value: new THREE.Color(0.5, 0.52, 0.48) },
          leafFadeStart: { value: this.config.LOD_FADE_START },
          maxLeafDistance: { value: this.config.LOD_MAX_DISTANCE },
          rootSpreadMin: { value: this.config.ROOT_SPREAD_MIN },
          rootSpreadMax: { value: this.config.ROOT_SPREAD_MAX },
          rootHeightMin: { value: this.config.ROOT_HEIGHT_MIN },
          rootHeightMax: { value: this.config.ROOT_HEIGHT_MAX },
          rootBumpsMin: { value: this.config.ROOT_BUMPS_MIN },
          rootBumpsMax: { value: this.config.ROOT_BUMPS_MAX },
        },
        vertexShader: /* glsl */ `
          // Our world is 6 km across → positions well above mediump's safe
          // range. iOS/Metal silently drops vertices without this.
          precision highp float;
          precision highp int;
          uniform float leafFadeStart;
          uniform float maxLeafDistance;
          uniform float rootSpreadMin;
          uniform float rootSpreadMax;
          uniform float rootHeightMin;
          uniform float rootHeightMax;
          uniform float rootBumpsMin;
          uniform float rootBumpsMax;
          attribute float instanceTreeBaseY;

          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          varying float vLeafTint;
          varying vec2 vUv;
          varying float vTreeRand;

          void main() {
            vec3 pos = position;
            vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
            vec4 instanceCenter = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);

            float treeRand1 = fract(sin(instanceCenter.x * 12.9898 + instanceCenter.z * 78.233) * 43758.5453);
            float treeRand2 = fract(sin(instanceCenter.x * 63.7264 + instanceCenter.z * 10.873) * 43758.5453);
            float treeRand3 = fract(sin(instanceCenter.x * 36.1734 + instanceCenter.z * 91.147) * 43758.5453);

            float rootSpread = mix(rootSpreadMin, rootSpreadMax, treeRand1);
            float rootHeight = mix(rootHeightMin, rootHeightMax, treeRand2);
            float rootBumps = floor(mix(rootBumpsMin, rootBumpsMax + 1.0, treeRand3));

            // Adapted for terrain placement: compare Y relative to this tree's base.
            float localY = worldPos.y - instanceTreeBaseY;
            if (localY < rootHeight) {
              float rootFactor = 1.0 - (localY / rootHeight);
              rootFactor = rootFactor * rootFactor;

              vec2 outwardDir = worldPos.xz - instanceCenter.xz;
              float outwardLen = length(outwardDir);
              if (outwardLen > 0.001) {
                outwardDir /= outwardLen;
              } else {
                outwardDir = vec2(1.0, 0.0);
              }

              float angle = atan(worldPos.z - instanceCenter.z, worldPos.x - instanceCenter.x);
              float treeSeed = fract(instanceCenter.x * 12.9898 + instanceCenter.z * 78.233) * 6.28;
              float bumpiness = 1.0 + 0.7 * sin(angle * rootBumps + treeSeed);

              float spreadAmount = rootFactor * rootSpread * bumpiness * outwardLen * 3.0;
              worldPos.xz += outwardDir * spreadAmount;
              worldPos.y -= rootFactor * 0.15 * (localY > 0.0 ? 1.0 : 0.0);
            }

            vWorldPosition = worldPos.xyz;

            vec3 toVertex = worldPos.xyz - instanceCenter.xyz;
            vec3 approxNormal = normalize(vec3(toVertex.x, 0.0, toVertex.z));
            if (abs(normal.y) > 0.9) {
              approxNormal = vec3(0.0, sign(normal.y), 0.0);
            }
            vNormal = approxNormal;

            float dist = length(cameraPosition - vWorldPosition);
            float safeFadeStart = min(leafFadeStart, maxLeafDistance - 1.0);
            vLeafTint = smoothstep(safeFadeStart, maxLeafDistance, dist);

            float uvAngle = atan(worldPos.z - instanceCenter.z, worldPos.x - instanceCenter.x);
            vUv = vec2(uvAngle * 1.5, worldPos.y * 0.5);
            vTreeRand = treeRand1;

            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform sampler2D barkTexture;
          uniform vec3 barkColor;
          uniform vec3 leafTintColor;

          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          varying float vLeafTint;
          varying vec2 vUv;
          varying float vTreeRand;

          void main() {
            vec3 N = normalize(vNormal);
            vec3 L = normalize(vec3(0.5, 1.0, 0.3));
            float NdotL = max(dot(N, L), 0.0);

            vec2 wrappedUV = fract(vUv);
            vec3 texColor = texture2D(barkTexture, wrappedUV).rgb;

            // Per-tree variation: wider brightness band + per-channel hue
            // skew so different individuals read as different bark types
            // (silver birch / oak / pine etc) without textures swap.
            float brightness = 0.65 + vTreeRand * 0.7;
            vec3 baseColor = mix(barkColor, texColor, 0.7) * 1.8 * brightness;
            float skew = (vTreeRand - 0.5);
            baseColor *= vec3(1.0 + skew * 0.25, 1.0 + skew * skew * 0.18, 1.0 - skew * 0.25);

            baseColor = mix(baseColor, leafTintColor, vLeafTint * 0.7);

            vec3 litColor = baseColor * (0.3 + NdotL * 0.7);

            gl_FragColor = vec4(litColor, 1.0);
          }
        `,
      });

      const barkMesh = new THREE.InstancedMesh(barkGeo, barkMat, this.branchMatrices.length);
      barkMesh.frustumCulled = true;
      barkMesh.castShadow = false;
      barkMesh.receiveShadow = false;

      for (let i = 0; i < this.branchMatrices.length; i++) {
        barkMesh.setMatrixAt(i, this.branchMatrices[i]);
      }
      barkMesh.instanceMatrix.needsUpdate = true;

      // Per-branch tree-base Y, so the root-spread shader can work on terrain.
      const treeBaseYArray = new Float32Array(this.branchTreeBaseY);
      barkGeo.setAttribute('instanceTreeBaseY', new THREE.InstancedBufferAttribute(treeBaseYArray, 1));

      // On WebGPU, swap the WebGL ShaderMaterial for a TSL NodeMaterial.
      // (We still constructed the WebGL mat above — it's immediately disposed
      // here. Small one-time waste; keeps the port non-invasive and leaves
      // the proven WebGL path intact for the default case.)
      if (this.useWebGPU) {
        barkMat.dispose();
        const nodeMat = createBarkNodeMaterial(barkTexture, this.config, barkGeo);
        barkMesh.material = nodeMat;
        this.barkMat = nodeMat;
      } else {
        this.barkMat = barkMat;
      }
      this.group.add(barkMesh);
      this.meshes.bark = barkMesh;
    }

    // --- LEAVES ---
    if (this.leafMatrices.length > 0) {
      const leafGeo = this._leafGeo;

      const leafMat = new THREE.ShaderMaterial({
        uniforms: {
          leafTexture: { value: leafTexture },
          sunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
          sunColor: { value: new THREE.Color(1.0, 0.98, 0.9) },
          ambientLight: { value: new THREE.Color(0.65, 0.7, 0.6) },
          time: { value: 0.0 },
          maxLeafDistance: { value: this.config.LOD_MAX_DISTANCE },
          leafFadeStart: { value: this.config.LOD_FADE_START },
        },
        vertexShader: /* glsl */ `
          precision highp float;
          precision highp int;
          attribute vec3 instanceColorAttr;
          attribute float instanceRandom;
          attribute float instanceWobbleX;
          attribute float instanceWobbleY;
          attribute float instanceSwayPhase;
          uniform float time;
          uniform float maxLeafDistance;
          uniform float leafFadeStart;

          varying vec2 vUv;
          varying vec3 vColor;
          varying vec3 vWorldPosition;
          varying vec3 vNormal;
          varying float vRandom;

          void main() {
            vec3 instancePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            float dist = length(cameraPosition - instancePos);

            if (dist > maxLeafDistance) {
              // Place well outside NDC clip space. Some mobile GPUs (Apple
              // Metal in particular) don't reliably cull zero-area triangles
              // placed at the clip-space origin — they can rasterize as black
              // pixels covering the center of the screen. Clipping via
              // out-of-range NDC is 100% portable.
              gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
              vUv = vec2(0.0);
              vColor = vec3(0.0);
              vRandom = 0.0;
              vWorldPosition = vec3(0.0);
              vNormal = vec3(0.0, 1.0, 0.0);
              return;
            }

            float safeFadeStart = min(leafFadeStart, maxLeafDistance - 1.0);
            float lodScale = 1.0 - smoothstep(safeFadeStart, maxLeafDistance, dist) * 0.5;

            vUv = uv;
            vColor = instanceColorAttr;
            vRandom = instanceRandom;

            vec3 pos = position * lodScale;

            float edgeDist = max(abs(pos.x), abs(pos.y)) * 2.0;
            pos.x += instanceWobbleX * edgeDist;
            pos.y += instanceWobbleY * edgeDist;
            pos.x += pos.y * 0.08 * instanceWobbleX;
            pos *= 0.94 + instanceRandom * 0.12;

            if (dist < ${this.config.LOD_SWAY_DISTANCE.toFixed(1)}) {
              float swayFactor = clamp(1.0 - (dist - ${this.config.LOD_SWAY_FADE_START.toFixed(1)}) / ${(this.config.LOD_SWAY_DISTANCE - this.config.LOD_SWAY_FADE_START).toFixed(1)}, 0.0, 1.0);
              float s = sin(time * 1.2 + instanceSwayPhase);
              pos.x += s * 0.08 * swayFactor;
              pos.z += s * 0.05 * swayFactor;
            }

            vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
            vWorldPosition = worldPos.xyz;
            vNormal = normalize((instanceMatrix * vec4(normal, 0.0)).xyz);

            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform sampler2D leafTexture;
          uniform vec3 sunDirection;
          uniform vec3 sunColor;
          uniform vec3 ambientLight;

          varying vec2 vUv;
          varying vec3 vColor;
          varying vec3 vWorldPosition;
          varying vec3 vNormal;
          varying float vRandom;

          void main() {
            vec4 texColor = texture2D(leafTexture, vUv);
            if (texColor.a < 0.5) discard;

            vec3 N = normalize(vNormal);
            vec3 L = normalize(sunDirection);
            vec3 V = normalize(cameraPosition - vWorldPosition);
            if (!gl_FrontFacing) N = -N;

            float NdotL = max(dot(N, L), 0.0);

            float leafShadow = smoothstep(0.0, 1.0, dot(N, L) * 0.5 + 0.5);
            float diffuse = NdotL * 0.8 * leafShadow;
            float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.1;
            float sss = pow(max(dot(-N, L), 0.0), 2.0) * 0.35;

            vec3 baseColor = vColor * texColor.rgb;
            baseColor *= 0.92 + vRandom * 0.16;

            float ao = exp(-vWorldPosition.y * 0.1);
            baseColor *= 0.85 + 0.15 * ao;

            vec3 litColor = baseColor * (ambientLight + sunColor * (diffuse + sss)) + fresnel * vec3(0.7, 0.8, 0.6);

            gl_FragColor = vec4(litColor, 1.0);
          }
        `,
        side: THREE.DoubleSide,
      });

      const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, this.leafMatrices.length);
      leafMesh.frustumCulled = true;
      leafMesh.castShadow = false;
      leafMesh.receiveShadow = false;

      for (let i = 0; i < this.leafMatrices.length; i++) {
        leafMesh.setMatrixAt(i, this.leafMatrices[i]);
      }
      leafMesh.instanceMatrix.needsUpdate = true;

      const colorArray = new Float32Array(this.leafColors);
      leafMesh.geometry.setAttribute('instanceColorAttr', new THREE.InstancedBufferAttribute(colorArray, 3));

      // WebGPU caps at 8 vertex buffers. Position+normal+uv+instanceMatrix
      // already claim 4–5 slots; adding 5 more float attributes tripped the
      // limit ("Vertex buffer count (9) exceeds the maximum"). On WebGPU we
      // pack random + swayPhase into a single vec2 and drop the wobble pair
      // (static edge jitter — cosmetic only at flight altitude). The WebGL
      // path keeps the original 5 individual attributes for exact parity.
      if (this.useWebGPU) {
        const packed = new Float32Array(this.leafRandoms.length * 2);
        for (let i = 0; i < this.leafRandoms.length; i++) {
          packed[i * 2]     = this.leafRandoms[i];
          packed[i * 2 + 1] = this.leafSwayPhase[i];
        }
        leafMesh.geometry.setAttribute(
          'instanceRandSway',
          new THREE.InstancedBufferAttribute(packed, 2),
        );
      } else {
        const randomArray = new Float32Array(this.leafRandoms);
        leafMesh.geometry.setAttribute('instanceRandom', new THREE.InstancedBufferAttribute(randomArray, 1));

        const wobbleXArray = new Float32Array(this.leafWobbleX);
        leafMesh.geometry.setAttribute('instanceWobbleX', new THREE.InstancedBufferAttribute(wobbleXArray, 1));

        const wobbleYArray = new Float32Array(this.leafWobbleY);
        leafMesh.geometry.setAttribute('instanceWobbleY', new THREE.InstancedBufferAttribute(wobbleYArray, 1));

        const swayPhaseArray = new Float32Array(this.leafSwayPhase);
        leafMesh.geometry.setAttribute('instanceSwayPhase', new THREE.InstancedBufferAttribute(swayPhaseArray, 1));
      }

      if (this.useWebGPU) {
        leafMat.dispose();
        const nodeMat = createLeafNodeMaterial(leafTexture, this.config, leafMesh.geometry);
        leafMesh.material = nodeMat;
        this.leafMat = nodeMat;
      } else {
        this.leafMat = leafMat;
      }
      this.group.add(leafMesh);
      this.meshes.leaves = leafMesh;
    }
  }

  /** Advance the leaf-sway time uniform. Call from the game loop.
   * No-op on WebGPU (v1 NodeMaterial port doesn't sway yet — T014 follow-up). */
  update(elapsedSeconds) {
    if (this.leafMat && this.leafMat.uniforms && this.leafMat.uniforms.time) {
      this.leafMat.uniforms.time.value = elapsedSeconds;
    }
  }

  dispose() {
    for (const mesh of Object.values(this.meshes)) {
      if (mesh) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  }
}
