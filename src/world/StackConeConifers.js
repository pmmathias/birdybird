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
  const W = 512;
  const H = 1024;
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

  // 1. Trunk — visible only at the bottom; foliage skirt covers the rest
  const trunkTop = H - 110;
  const trunkBot = H - 8;
  const trunkW = 28;
  const trunkX = W / 2 - trunkW / 2;
  const trunkGrd = ctx.createLinearGradient(trunkX, 0, trunkX + trunkW, 0);
  trunkGrd.addColorStop(0, '#231408');
  trunkGrd.addColorStop(0.4, '#5b3a1a');
  trunkGrd.addColorStop(0.7, '#3a2410');
  trunkGrd.addColorStop(1, '#180c04');
  ctx.fillStyle = trunkGrd;
  ctx.fillRect(trunkX, trunkTop, trunkW, trunkBot - trunkTop);

  const apexY = 30;
  const baseY = H - 70;
  const baseHalfWidth = W * 0.46;

  // No solid silhouette underneath — the gaps between needle strokes
  // need to stay transparent so the background shows through (Mathias's
  // "alpha halt" feedback). Only the strokes themselves are opaque;
  // alphaTest:0.5 discards everything else cleanly.
  //
  // Mass of needle strokes covering a triangular silhouette area. Each
  // stroke has an outward + downward direction proportional to its
  // distance from the trunk (drooping branch tips). Density is bumped
  // because we no longer have a fill to lean on for tree-shape reading.
  const needleCount = 14000;
  for (let n = 0; n < needleCount; n++) {
    const t = rand();
    const y = apexY + t * (baseY - apexY);
    const half = baseHalfWidth * (0.05 + Math.pow(t, 1.08) * 0.95);
    // Density falls off near the silhouette edge so the tree's outline
    // looks naturally feathery (sparse needles fading to transparency)
    // instead of a hard silhouette boundary. Bias = rand^1.0 → linear
    // toward centre, bias = rand^2 → pushed toward centre. Mix gives a
    // dense core + soft edges.
    const xBias = (rand() < 0.6) ? (rand() ** 0.7) : (rand() ** 2.0);
    const xSign = rand() < 0.5 ? -1 : 1;
    // Slight asymmetry so the silhouette isn't perfectly mirrored
    const wobble = Math.sin(y * 0.04 + seed) * 4;
    const x = W / 2 + wobble + xSign * xBias * half * 0.96;
    if (Math.abs(x - W / 2 - wobble) > half) continue;

    // Direction: outward + slightly downward. Outermost needles tilt
    // down harder (drooping tips). Use the actual signed offset so
    // strokes always point away from the trunk axis.
    const offset = x - W / 2 - wobble;
    const dirOutward = offset / Math.max(1, half);
    const ang = Math.atan2(0.5 + Math.abs(dirOutward) * 0.55, dirOutward * 1.6);
    const angJitter = (rand() - 0.5) * 0.55;
    const len = 4 + rand() * 7;
    const tipX = x + Math.cos(ang + angJitter) * len;
    const tipY = y + Math.sin(ang + angJitter) * len;

    let stroke;
    if (snowy) {
      const r = rand();
      if (r < 0.55)        stroke = `hsla(${205 + rand() * 25}, 12%, ${82 + rand() * 12}%, 0.92)`;   // bright snow
      else if (r < 0.85)   stroke = `hsla(${198 + rand() * 22}, 10%, ${50 + rand() * 14}%, 0.9)`;    // mid grey-blue
      else                 stroke = `hsla(${130 + rand() * 28}, 50%, ${12 + rand() * 8}%, 0.92)`;    // very dark green peeking through
    } else {
      // Even darker fir palette — proper deep-forest dark green.
      const r = rand();
      if (r < 0.55)        stroke = `hsla(${108 + rand() * 14}, 60%, ${10 + rand() * 7}%, 0.95)`;    // dominant mid (very dark)
      else if (r < 0.82)   stroke = `hsla(${88 + rand() * 24}, 55%, ${20 + rand() * 8}%, 0.9)`;     // muted highlight
      else                 stroke = `hsla(${118 + rand() * 12}, 65%, ${5 + rand() * 5}%, 0.92)`;     // near-black shadow
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.3 + rand() * 0.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  }

  // 4. Snow caps on horizontal-ish surfaces (snowy variant only)
  if (snowy) {
    const capCount = 240;
    for (let i = 0; i < capCount; i++) {
      const t = 0.05 + rand() * 0.92;
      const y = apexY + t * (baseY - apexY);
      const half = baseHalfWidth * (0.05 + Math.pow(t, 1.08) * 0.95);
      const x = W / 2 + (rand() * 2 - 1) * half * 0.92;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + rand() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + rand() * 5, 1.5 + rand() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  // Mipmaps RE-ENABLED to kill the under-sampling aliasing on distant
  // trees. The "trees vanish at distance" issue caused by mip-shrunk
  // alpha is solved at the material level (alphaToCoverage + adjusted
  // alphaTest, see below) — this combination gets us crisp close-up
  // detail AND smooth far-distance sampling without flicker.
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  return tex;
}

// Crossed-billboard geometry: SIX planes at 0°, 30°, 60°, 90°, 120°, 150°
// around the vertical axis → 12 visible silhouette faces from any
// horizontal angle, so the tree reads as a continuous 3D volume even
// when the camera circles it. Cost: 12 triangles per tree.
const _crossedBillboardGeo = (() => {
  const planes = [];
  for (let i = 0; i < 6; i++) {
    const p = new THREE.PlaneGeometry(1, 2, 1, 1);
    p.translate(0, 1.0, 0);                 // base at y=0, top at y=2
    p.rotateY((i / 6) * Math.PI);            // 0, 30, 60, 90, 120, 150
    planes.push(p);
  }
  return mergeGeometries(planes);
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

  // Three texture variants per biome (different seeds) so neighbouring
  // trees in a cluster don't look like identical clones. Each variant
  // gets its own InstancedMesh; trees are randomly assigned at build.
  const greenTextures = [1, 7, 13].map((seed) => generateConiferTexture({ snowy: false, seed }));
  const snowyTextures = [2, 9, 19].map((seed) => generateConiferTexture({ snowy: true,  seed }));
  // alphaToCoverage gives MSAA-resolved soft edges on alpha-tested
  // geometry — solves the dual problem of "discrete cutout aliases at
  // distance" and "mip-shrunk alpha disappears". MSAA samples per
  // pixel resolve to per-subpixel coverage, so distant tree silhouettes
  // soften smoothly instead of flickering.
  // alphaTest is bumped from 0.3 → 0.5 to compensate for mipmap-
  // averaged alpha; with A2C the threshold is interpreted as coverage
  // probability, not a hard cutoff.
  const matOpts = {
    transparent: true,
    alphaTest: 0.5,
    alphaToCoverage: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    fog: true,
  };
  const greenMats = greenTextures.map((map) => new THREE.MeshBasicMaterial({ ...matOpts, map }));
  const snowyMats = snowyTextures.map((map) => new THREE.MeshBasicMaterial({ ...matOpts, map }));

  /** Build instances from `slots` distributed across N variant materials. */
  function buildMeshes(slots, mats, prefix) {
    if (slots.length === 0) return [];
    // Bucket each slot to a random texture variant
    const buckets = mats.map(() => []);
    for (const s of slots) buckets[Math.floor(Math.random() * mats.length)].push(s);
    const meshes = [];
    for (let v = 0; v < mats.length; v++) {
      const list = buckets[v];
      if (list.length === 0) continue;
      const mesh = new THREE.InstancedMesh(_crossedBillboardGeo, mats[v], list.length);
      mesh.name = `${prefix}-v${v}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      const matrix = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const sc = new THREE.Vector3();
      const TILT_AXIS = new THREE.Vector3();
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        // Wide independent variance per tree:
        //   height 5-32 m (saplings up to monumental old firs)
        //   width  0.30-0.95 × height (slim cypress-y up to wide pyramidal)
        //   slight random lean (up to ~6°) so the forest doesn't look
        //   military-perfectly-straight
        const h = 5 + Math.random() * 27;
        const widthRatio = 0.30 + Math.random() * 0.65;
        const w = h * widthRatio;
        pos.set(s.x, s.y - 0.5, s.z);
        // Combine yaw rotation with a small random tilt around a
        // horizontal axis for natural variety.
        const yaw = Math.random() * Math.PI * 2;
        const tiltAng = (Math.random() - 0.5) * 0.20;       // ±~6°
        const tiltDir = Math.random() * Math.PI * 2;
        TILT_AXIS.set(Math.cos(tiltDir), 0, Math.sin(tiltDir));
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const tiltQuat = new THREE.Quaternion().setFromAxisAngle(TILT_AXIS, tiltAng);
        quat.copy(yawQuat).multiply(tiltQuat);
        sc.set(w, h, w);
        matrix.compose(pos, quat, sc);
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      meshes.push(mesh);
    }
    return meshes;
  }

  const greenMeshes = buildMeshes(greenSlots, greenMats, 'conifer-green');
  const snowyMeshes = buildMeshes(snowySlots, snowyMats, 'conifer-snowy');
  for (const m of greenMeshes) group.add(m);
  for (const m of snowyMeshes) group.add(m);

  console.log(`Conifers (crossed-billboard): ${greenSlots.length} green + ${snowySlots.length} snowy across ${greenMats.length + snowyMats.length} variants`);
  return group;
}

/**
 * Sample alpine-elevation positions for conifer placement, clustered
 * into actual forests rather than evenly scattered. Each cluster is
 * a tight Gaussian spread around a centre on a high-altitude pocket.
 */
export function sampleConiferPositions(arcs, count) {
  const positions = [];
  const sampleRadius = WORLD_HALF * 0.85;

  // Pick cluster centres on alpine ground first. ~70 trees per cluster
  // so the player encounters proper fir forests on mountain slopes
  // rather than thin patches.
  const treesPerCluster = 70;
  const clusterCount = Math.max(3, Math.round(count / treesPerCluster));
  const centres = [];
  let attempts = 0;
  while (centres.length < clusterCount && attempts < clusterCount * 60) {
    attempts++;
    const x = (Math.random() * 2 - 1) * sampleRadius;
    const z = (Math.random() * 2 - 1) * sampleRadius;
    const y = getTerrainHeight(x, z, arcs);
    if (y < ALPINE_ZONE_LOW || y > ALPINE_ZONE_HIGH) continue;
    if (y < WATER_LEVEL + 4) continue;
    // Spread centres so clusters don't merge into one big forest
    let tooClose = false;
    for (const c of centres) {
      if (Math.hypot(c.x - x, c.z - z) < 220) { tooClose = true; break; }
    }
    if (tooClose) continue;
    centres.push({ x, z });
  }
  if (centres.length === 0) return positions;

  // Scatter trees inside each cluster with a Gaussian-ish radius.
  for (let i = 0; i < count; i++) {
    const c = centres[i % centres.length];
    // Box-Muller for Gaussian-ish spread; ~50 m 1-sigma → tight cluster
    const u1 = Math.random() || 0.0001;
    const u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1)) * 50;
    const angle = u2 * Math.PI * 2;
    const x = c.x + Math.cos(angle) * r;
    const z = c.z + Math.sin(angle) * r;
    // Drop trees that wandered out of the alpine band (e.g. into a
    // valley below) — buildStackConeConifers also filters but this
    // saves a few wasted instances.
    const y = getTerrainHeight(x, z, arcs);
    if (y < ALPINE_ZONE_LOW - 10 || y > ALPINE_ZONE_HIGH + 10) continue;
    positions.push({ x, z });
  }
  return positions;
}
