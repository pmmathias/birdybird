import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getTerrainHeight } from './Terrain.js';
import { WORLD_HALF, WATER_LEVEL } from '../constants.js';

/**
 * Realistic-looking conifers via crossed-billboard planes textured with
 * a procedurally drawn fir-tree silhouette (needles + trunk + alpha
 * cutout). Two intersecting planes per tree gives a believable 3D
 * silhouette from any horizontal viewing angle while staying ridiculously
 * cheap: 4 triangles per tree, all instances batched into ONE InstancedMesh
 * per material variant (green, snowy).
 *
 * Why this beats both the L-system attempt and the stack-cone version:
 *   - L-system + plane-leaves: gave sparse "stick saplings", couldn't
 *     reach the dense needle look without thousands of leaves per tree.
 *   - Stack-cone: read as Mario-plastic Christmas trees — fine for
 *     stylised graphics, wrong vibe for this sim.
 *   - Crossed-billboard with procedural canvas texture: industry standard
 *     for distant tree foliage in real-time games. Looks like a real tree
 *     in chase-cam silhouette, costs almost nothing per instance.
 */

// --- Snow line config (mirrors terrain shader rockEnd) ---
export const SNOW_LINE = 110;
export const ALPINE_ZONE_LOW = 60;
export const ALPINE_ZONE_HIGH = 145;

/**
 * Procedurally draw a fir-tree silhouette on a canvas. Trunk at the
 * bottom, narrowing-triangular needle mass above it, slight asymmetry
 * + per-needle hue/light jitter for realism. Returns a CanvasTexture
 * with alpha cutout suitable for alphaTest sampling.
 *
 * @param {object} opts
 * @param {boolean} [opts.snowy=false]  Apply white-blue snow tint.
 * @param {number}  [opts.seed=0]       Pseudo-random offset for variation.
 * @returns {THREE.CanvasTexture}
 */
function generateConiferTexture({ snowy = false, seed = 0 } = {}) {
  const W = 256;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Tiny seeded PRNG (mulberry32)
  let s = seed * 1234567 + 0x9e3779b9;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // 1. Trunk — visible at bottom only (top of trunk hidden by foliage)
  const trunkTop = H - 60;
  const trunkBot = H - 4;
  const trunkW = 14;
  const trunkX = W / 2 - trunkW / 2;
  const trunkGrd = ctx.createLinearGradient(trunkX, 0, trunkX + trunkW, 0);
  trunkGrd.addColorStop(0, '#2a1808');
  trunkGrd.addColorStop(0.5, '#5a3818');
  trunkGrd.addColorStop(1, '#2a1808');
  ctx.fillStyle = trunkGrd;
  ctx.fillRect(trunkX, trunkTop, trunkW, trunkBot - trunkTop);

  const apexY = 18;
  const baseY = H - 40;
  const baseHalfWidth = W * 0.45;

  // 2. Solid silhouette — a clean fir-tree outline filled with deep
  // green. Gives a continuous shape so the tree reads as a tree from
  // any distance (the previous "scattered clusters" approach left
  // alpha gaps that looked like a sparse leafy bush).
  ctx.fillStyle = snowy ? '#2c3a40' : '#1a3d1e';
  ctx.beginPath();
  const tierCount = 14;
  // Build outline: apex → down the left side via tier points → across
  // the bottom → up the right side.
  ctx.moveTo(W / 2, apexY);
  for (let i = 1; i <= tierCount; i++) {
    const t = i / tierCount;
    const y = apexY + t * (baseY - apexY);
    // Wavy outline: each tier sticks out slightly more than the one
    // above, with a small zigzag for "branch tip" silhouette.
    const half = baseHalfWidth * (0.08 + Math.pow(t, 1.1) * 0.92);
    const zig = (i % 2 === 0) ? -2 : 4;
    ctx.lineTo(W / 2 - half - zig, y);
  }
  ctx.lineTo(W / 2 - 25, baseY + 6);  // soft skirt at base
  ctx.lineTo(W / 2 + 25, baseY + 6);
  for (let i = tierCount; i >= 1; i--) {
    const t = i / tierCount;
    const y = apexY + t * (baseY - apexY);
    const half = baseHalfWidth * (0.08 + Math.pow(t, 1.1) * 0.92);
    const zig = (i % 2 === 0) ? -2 : 4;
    ctx.lineTo(W / 2 + half + zig, y);
  }
  ctx.closePath();
  ctx.fill();

  // 3. Branch detail layer — many short horizontal lines representing
  // individual fir branches. Drawn with darker green for the under-side
  // shadow + lighter green stipples on top for needle highlights.
  for (let i = 0; i < 220; i++) {
    const t = rand();
    const y = apexY + t * (baseY - apexY);
    const half = baseHalfWidth * (0.08 + Math.pow(t, 1.1) * 0.92);
    const side = rand() < 0.5 ? -1 : 1;
    const startX = W / 2 + side * (rand() * half * 0.3);
    const len = (half - Math.abs(startX - W / 2)) * (0.6 + rand() * 0.4);
    const endX = startX + side * len;

    // Underside shadow: darker thin curve sloping slightly downward
    ctx.strokeStyle = snowy ? 'rgba(40,55,70,0.55)' : 'rgba(8,22,10,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(startX, y + 1);
    ctx.lineTo(endX, y + 4 + rand() * 3);
    ctx.stroke();
  }

  // 4. Needle highlights — many tiny dots/strokes scattered across the
  // silhouette so the surface reads as bumpy needles rather than a
  // flat shape.
  for (let i = 0; i < 1100; i++) {
    const t = rand();
    const y = apexY + t * (baseY - apexY);
    const half = baseHalfWidth * (0.08 + Math.pow(t, 1.1) * 0.92);
    // Stay inside silhouette
    const x = W / 2 + (rand() * 2 - 1) * half * 0.95;
    let r, g, b, a;
    if (snowy) {
      // Snowy: alternating frosted-white and dark-green-shadow stipples
      if (rand() < 0.55) {
        r = 230 + rand() * 25;
        g = 235 + rand() * 20;
        b = 240 + rand() * 15;
        a = 0.85 + rand() * 0.15;
      } else {
        r = 30 + rand() * 25;
        g = 55 + rand() * 25;
        b = 40 + rand() * 20;
        a = 0.7;
      }
    } else {
      const tier = rand();
      if (tier < 0.45) {           // mid green needle
        r = 35 + rand() * 25;
        g = 75 + rand() * 35;
        b = 35 + rand() * 18;
        a = 0.85;
      } else if (tier < 0.75) {    // bright sun-lit needle
        r = 80 + rand() * 50;
        g = 140 + rand() * 50;
        b = 55 + rand() * 30;
        a = 0.9;
      } else {                      // very dark shadow needle
        r = 8 + rand() * 12;
        g = 28 + rand() * 18;
        b = 12 + rand() * 14;
        a = 0.9;
      }
    }
    ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
    // Tiny vertical stroke (1×3) — reads as a single needle from a
    // distance, much more "fir" than a round dot.
    ctx.fillRect(x | 0, y | 0, 1, 2 + Math.floor(rand() * 2));
  }

  // 5. Snow caps on the snowy variant — thicker bright accents on
  // horizontal-ish branch tops.
  if (snowy) {
    for (let i = 0; i < 90; i++) {
      const t = 0.05 + rand() * 0.92;
      const y = apexY + t * (baseY - apexY);
      const half = baseHalfWidth * (0.08 + Math.pow(t, 1.1) * 0.92);
      const x = W / 2 + (rand() * 2 - 1) * half * 0.9;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + rand() * 6, 1.8 + rand() * 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  return tex;
}

// Crossed-billboard geometry: two planes meeting at right angles, baked
// once and reused across all conifer instances. Plane base sits at y=0
// so per-instance Y = ground.
const _crossedBillboardGeo = (() => {
  // Plane A: facing +Z (so a viewer looking from +Z sees it face-on).
  // PlaneGeometry default lies in XY with normal +Z — perfect.
  const planeA = new THREE.PlaneGeometry(1, 2, 1, 1);
  planeA.translate(0, 1.0, 0);     // base at y=0, top at y=2

  // Plane B: rotated 90° around Y, perpendicular to A.
  const planeB = new THREE.PlaneGeometry(1, 2, 1, 1);
  planeB.translate(0, 1.0, 0);
  planeB.rotateY(Math.PI / 2);

  return mergeGeometries([planeA, planeB]);
})();

/**
 * Build a Group containing the conifer InstancedMeshes. Two meshes max:
 * one for green (below SNOW_LINE) and one for snowy (above).
 *
 * @param {Array<{x:number, z:number}>} positions
 * @param {Array} arcs - terrain arcs for height lookup
 * @returns {THREE.Group}
 */
export function buildStackConeConifers(positions, arcs) {
  const group = new THREE.Group();
  group.name = 'conifer-forest';
  if (!positions || positions.length === 0) return group;

  // Filter + bucket by altitude
  const greenSlots = [];
  const snowySlots = [];
  for (const p of positions) {
    const y = getTerrainHeight(p.x, p.z, arcs);
    if (y < ALPINE_ZONE_LOW || y > ALPINE_ZONE_HIGH) continue;
    const slot = { x: p.x, y, z: p.z };
    if (y > SNOW_LINE - 6) snowySlots.push(slot);
    else greenSlots.push(slot);
  }
  if (greenSlots.length === 0 && snowySlots.length === 0) return group;

  const greenTex = generateConiferTexture({ snowy: false, seed: 1 });
  const snowyTex = generateConiferTexture({ snowy: true,  seed: 2 });
  const greenMat = new THREE.MeshBasicMaterial({
    map: greenTex,
    transparent: false,    // alphaTest (cheaper than blending)
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    fog: true,
  });
  const snowyMat = new THREE.MeshBasicMaterial({
    map: snowyTex,
    transparent: false,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    fog: true,
  });

  function buildMesh(slots, mat, name) {
    if (slots.length === 0) return null;
    const mesh = new THREE.InstancedMesh(_crossedBillboardGeo, mat, slots.length);
    mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      // 9-15 m tall; width ~half height for a slim fir silhouette
      const h = 9 + Math.random() * 6;
      const w = h * 0.55;
      pos.set(s.x, s.y - 0.5, s.z);  // sink the base ½ m so the trunk
                                     // visually meets the terrain
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
      sc.set(w, h, w);                // independent X/Y scale: x = width
      matrix.compose(pos, quat, sc);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }

  const greenMesh = buildMesh(greenSlots, greenMat, 'conifer-foliage-green');
  const snowyMesh = buildMesh(snowySlots, snowyMat, 'conifer-foliage-snowy');
  if (greenMesh) group.add(greenMesh);
  if (snowyMesh) group.add(snowyMesh);

  console.log(`Conifers (crossed-billboard): ${greenSlots.length} green + ${snowySlots.length} snowy`);
  return group;
}

/**
 * Sample alpine-elevation positions for conifer placement.
 */
export function sampleConiferPositions(arcs, count) {
  const positions = [];
  const sampleRadius = WORLD_HALF * 0.85;
  let attempts = 0;
  while (positions.length < count && attempts < count * 30) {
    attempts++;
    const x = (Math.random() * 2 - 1) * sampleRadius;
    const z = (Math.random() * 2 - 1) * sampleRadius;
    const y = getTerrainHeight(x, z, arcs);
    if (y < ALPINE_ZONE_LOW || y > ALPINE_ZONE_HIGH) continue;
    if (y < WATER_LEVEL + 4) continue;
    positions.push({ x, z });
  }
  return positions;
}
