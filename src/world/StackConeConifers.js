import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getTerrainHeight } from './Terrain.js';
import { WORLD_HALF, WATER_LEVEL } from '../constants.js';

/**
 * Stylised "stack-cone" conifers — dirt-cheap to render and instantly
 * recognisable as fir trees. Each instance is two InstancedMesh entries:
 *
 *   - one trunk (CylinderGeometry, ~12 triangles)
 *   - one foliage (3 cones merged into a single BufferGeometry, ~24 triangles)
 *
 * So N conifers = exactly TWO draw calls + ~36 N triangles. With N=200 we
 * pay ~7 K triangles + 2 calls — negligible vs the L-system forest.
 *
 * Per-instance colour is set on the foliage InstancedMesh so high-altitude
 * (snowy) trees come out white-blue and lower trees come out forest-green
 * without any extra geometry / draw calls.
 */

// --- Snow line config (mirrors terrain shader rockEnd) ---
export const SNOW_LINE = 110;
export const ALPINE_ZONE_LOW = 60;    // conifer placement starts here
export const ALPINE_ZONE_HIGH = 145;  // … and stops here (above = bare peaks)

const TRUNK_COLOR = new THREE.Color(0x4a3018);

// Build geometries once, share across all conifers.
const _trunkBaseGeo = (() => {
  const g = new THREE.CylinderGeometry(0.12, 0.18, 1, 6, 1);
  g.translate(0, 0.5, 0);  // base at origin so per-instance Y = ground
  return g;
})();

// Three stacked cones forming a Christmas-tree silhouette. All baked
// into one geometry so a single draw call handles the foliage.
const _foliageBaseGeo = (() => {
  // Cones use unit-height = 1; per-instance scale stretches the whole
  // tree. Vertical layout (in unit-space, total height ≈ 1):
  //   trunk top at y=0.30 (so the bottom cone overlaps the trunk a bit)
  //   cone1 base 0.28, height 0.40 (widest)
  //   cone2 base 0.55, height 0.35
  //   cone3 base 0.78, height 0.30 (tip)
  const cone1 = new THREE.ConeGeometry(0.55, 0.50, 8, 1);
  cone1.translate(0, 0.28 + 0.25, 0);
  const cone2 = new THREE.ConeGeometry(0.42, 0.42, 8, 1);
  cone2.translate(0, 0.55 + 0.21, 0);
  const cone3 = new THREE.ConeGeometry(0.28, 0.36, 8, 1);
  cone3.translate(0, 0.78 + 0.18, 0);
  const merged = mergeGeometries([cone1, cone2, cone3]);
  merged.computeVertexNormals();
  return merged;
})();

/**
 * Build a Group containing the trunk + foliage InstancedMeshes for a
 * batch of conifer positions. Each position spawns one tree.
 *
 * @param {Array<{x:number, z:number}>} positions
 * @param {Array} arcs - terrain arcs for height lookup
 * @returns {THREE.Group}
 */
export function buildStackConeConifers(positions, arcs) {
  const group = new THREE.Group();
  group.name = 'conifer-forest';
  if (!positions || positions.length === 0) return group;

  // Filter by elevation + record height so per-instance scale + colour
  // can vary with altitude.
  const placed = [];
  for (const p of positions) {
    const y = getTerrainHeight(p.x, p.z, arcs);
    if (y < ALPINE_ZONE_LOW || y > ALPINE_ZONE_HIGH) continue;
    placed.push({ x: p.x, y, z: p.z });
  }
  if (placed.length === 0) return group;

  // Two foliage meshes: one for snowy (above snow line), one for green
  // (below). Avoids relying on instanceColor (had reproduction issues
  // with InstancedMesh + Lambert) — each material has its base colour
  // fixed, every instance picks up a hue offset via the modelMatrix
  // alone. Trunks share one mesh.

  // Pre-bucket positions by altitude
  const greenIdx = [];
  const snowyIdx = [];
  for (let i = 0; i < placed.length; i++) {
    if (placed[i].y > SNOW_LINE - 8) snowyIdx.push(i);
    else greenIdx.push(i);
  }

  // MeshBasicMaterial: no lighting dependency. Mario-style trees look
  // good as flat-shaded silhouettes anyway, and we side-step a
  // Three.js InstancedMesh + Lambert oddity that was rendering all
  // conifers near-black regardless of base colour.
  const trunkMat   = new THREE.MeshBasicMaterial({ color: TRUNK_COLOR });
  const greenMat   = new THREE.MeshBasicMaterial({ color: 0x2d6a3a });
  const snowyMat   = new THREE.MeshBasicMaterial({ color: 0xe8eef5 });

  const trunkMesh = new THREE.InstancedMesh(_trunkBaseGeo, trunkMat, placed.length);
  trunkMesh.name = 'conifer-trunks';
  trunkMesh.castShadow = trunkMesh.receiveShadow = false;
  trunkMesh.frustumCulled = false;

  const greenMesh = new THREE.InstancedMesh(_foliageBaseGeo, greenMat, greenIdx.length || 1);
  greenMesh.name = 'conifer-foliage-green';
  greenMesh.castShadow = greenMesh.receiveShadow = false;
  greenMesh.frustumCulled = false;
  greenMesh.count = greenIdx.length;

  const snowyMesh = new THREE.InstancedMesh(_foliageBaseGeo, snowyMat, snowyIdx.length || 1);
  snowyMesh.name = 'conifer-foliage-snowy';
  snowyMesh.castShadow = snowyMesh.receiveShadow = false;
  snowyMesh.frustumCulled = false;
  snowyMesh.count = snowyIdx.length;

  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const Y_AXIS = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    const height = 8 + Math.random() * 6;
    pos.set(p.x, p.y, p.z);
    quat.setFromAxisAngle(Y_AXIS, Math.random() * Math.PI * 2);
    sc.set(height, height, height);
    matrix.compose(pos, quat, sc);
    trunkMesh.setMatrixAt(i, matrix);
  }
  for (let j = 0; j < greenIdx.length; j++) {
    trunkMesh.getMatrixAt(greenIdx[j], matrix);
    greenMesh.setMatrixAt(j, matrix);
  }
  for (let j = 0; j < snowyIdx.length; j++) {
    trunkMesh.getMatrixAt(snowyIdx[j], matrix);
    snowyMesh.setMatrixAt(j, matrix);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  greenMesh.instanceMatrix.needsUpdate = true;
  snowyMesh.instanceMatrix.needsUpdate = true;

  trunkMesh.computeBoundingSphere();
  greenMesh.computeBoundingSphere();
  snowyMesh.computeBoundingSphere();
  group.add(trunkMesh);
  if (greenIdx.length) group.add(greenMesh);
  if (snowyIdx.length) group.add(snowyMesh);

  console.log(`Stack-cone conifers: ${greenIdx.length} green + ${snowyIdx.length} snowy`);
  return group;
}

/**
 * Sample alpine-elevation positions for conifer placement. Independent
 * of the broadleaf forest cluster sampler so we can guarantee coverage
 * of the snow-line band.
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
