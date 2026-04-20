import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { getTerrainHeight } from './Terrain.js';
import { WORLD_HALF, WATER_LEVEL } from '../constants.js';

/**
 * Clean-room proof-of-concept: procedural L-system forest with instanced rendering.
 *
 * Architecture inspired by red-reddington's discourse.threejs.org post
 * (https://discourse.threejs.org/t/procedural-instanced-forest-high-performance-real-trees/88610)
 * — his code is NOT used here. We describe the same idea (L-system branching +
 * instanced draw + merged-geometry-per-species) and write it ourselves.
 *
 * Per tree species we produce:
 *   - one merged BufferGeometry for all bark cylinders
 *   - one merged BufferGeometry for all leaf quads
 * Each species = 2 draw calls total, regardless of instance count.
 */

/** Deterministic pseudo-random via seed. */
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Recursively grow a tree. Pushes branch segment definitions and leaf positions
 * into the accumulators. Each segment is a truncated cone described by its
 * two endpoints and radii.
 */
function growBranches(rnd, params, ctx, segments, leafPoints) {
  const { depth, maxDepth, position, direction, length, radius } = ctx;
  const tip = position.clone().addScaledVector(direction, length);
  segments.push({
    start: position.clone(),
    end: tip,
    r0: radius,
    r1: radius * params.radiusTaper,
  });

  if (depth >= maxDepth) {
    // Terminal — cluster of leaves at tip (multiple quads fan out → fuller look)
    const cluster = params.terminalCluster ?? 5;
    for (let i = 0; i < cluster; i++) {
      const off = new THREE.Vector3(
        rnd() - 0.5, (rnd() - 0.5) * 0.7, rnd() - 0.5,
      ).multiplyScalar(params.leafSize * 1.1);
      leafPoints.push({
        pos: tip.clone().add(off),
        size: params.leafSize * (0.9 + rnd() * 0.4),
      });
    }
    return;
  }

  // Scatter foliage along the branch too
  if (params.sideFoliage && depth >= maxDepth - 1) {
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const t = 0.35 + rnd() * 0.65;
      const side = position.clone().lerp(tip, t);
      const off = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(radius * 3);
      leafPoints.push({ pos: side.add(off), size: params.leafSize * (0.7 + rnd() * 0.5) });
    }
  }

  const nBranches = params.branchCount[0]
    + Math.floor(rnd() * (params.branchCount[1] - params.branchCount[0] + 1));

  for (let i = 0; i < nBranches; i++) {
    const newDir = direction.clone();
    // Tilt away from trunk axis
    const tilt = params.branchAngle * (0.7 + rnd() * 0.6);
    const yaw = (i / nBranches) * Math.PI * 2 + rnd() * 0.8;
    const perp = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    newDir.applyAxisAngle(perp, tilt).normalize();

    growBranches(rnd, params, {
      depth: depth + 1,
      maxDepth,
      position: tip,
      direction: newDir,
      length: length * (params.lengthTaper * (0.85 + rnd() * 0.3)),
      radius: radius * params.radiusTaper,
    }, segments, leafPoints);
  }
}

/**
 * Build a cone-section geometry (not a full cylinder — two different radii)
 * oriented along an arbitrary world-space axis. Returned in world-space so it
 * can be concatenated into a single merged mesh.
 */
function branchToGeometry(seg, radialSegments = 5) {
  const axis = seg.end.clone().sub(seg.start);
  const len = axis.length();
  if (len < 0.001) return null;

  // Base cone along +Y, then orient to axis.
  const cyl = new THREE.CylinderGeometry(seg.r1, seg.r0, len, radialSegments, 1, true);
  cyl.translate(0, len / 2, 0);

  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    axis.clone().normalize(),
  );
  cyl.applyQuaternion(quat);
  cyl.translate(seg.start.x, seg.start.y, seg.start.z);
  return cyl;
}

/**
 * Build a billboard-like leaf quad (double-sided) at a world position.
 */
function leafToGeometry(leaf) {
  const s = leaf.size;
  const g = new THREE.PlaneGeometry(s, s, 1, 1);
  // Randomize orientation for fuller look
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    Math.random() * 0.8 - 0.4,
    Math.random() * Math.PI * 2,
    Math.random() * 0.8 - 0.4,
  ));
  g.applyQuaternion(quat);
  g.translate(leaf.pos.x, leaf.pos.y, leaf.pos.z);
  return g;
}

/** Tree species presets — parameters drive the L-system growth. */
export const TREE_PRESETS = {
  oak: {
    trunkLength: 5.5, trunkRadius: 0.9, radiusTaper: 0.75, lengthTaper: 0.78,
    branchCount: [2, 3], branchAngle: 0.75, maxDepth: 4, leafSize: 1.8,
    sideFoliage: true, barkColor: 0x6a4a28, leafColor: 0x4a7a30, scaleRange: [0.7, 1.25],
  },
  pine: {
    trunkLength: 8, trunkRadius: 0.7, radiusTaper: 0.65, lengthTaper: 0.7,
    branchCount: [3, 5], branchAngle: 1.25, maxDepth: 3, leafSize: 1.4,
    sideFoliage: false, barkColor: 0x4a3018, leafColor: 0x356b38, scaleRange: [0.8, 1.4],
  },
  birch: {
    trunkLength: 6.5, trunkRadius: 0.5, radiusTaper: 0.7, lengthTaper: 0.75,
    branchCount: [2, 3], branchAngle: 0.55, maxDepth: 4, leafSize: 1.2,
    sideFoliage: true, barkColor: 0xd8d0c4, leafColor: 0x88aa50, scaleRange: [0.7, 1.1],
  },
  bush: {
    trunkLength: 1.4, trunkRadius: 0.35, radiusTaper: 0.78, lengthTaper: 0.8,
    branchCount: [3, 4], branchAngle: 1.1, maxDepth: 2, leafSize: 1.3,
    sideFoliage: true, barkColor: 0x5a3820, leafColor: 0x5a8030, scaleRange: [0.8, 1.3],
  },
};

/**
 * Build one prototype tree (merged bark + merged leaves) for a preset.
 * Returns { barkGeom, leafGeom }.
 */
export function buildTreePrototype(presetName, seed = 1) {
  const params = TREE_PRESETS[presetName];
  if (!params) throw new Error(`Unknown preset: ${presetName}`);
  const rnd = mulberry32(seed);

  const segments = [];
  const leafPoints = [];

  growBranches(rnd, params, {
    depth: 0,
    maxDepth: params.maxDepth,
    position: new THREE.Vector3(0, 0, 0),
    direction: new THREE.Vector3(0, 1, 0),
    length: params.trunkLength,
    radius: params.trunkRadius,
  }, segments, leafPoints);

  // Merge bark
  const barkGeoms = segments.map((s) => branchToGeometry(s)).filter(Boolean);
  const barkGeom = BufferGeometryUtils.mergeGeometries(barkGeoms, false);
  barkGeom.computeVertexNormals();
  for (const g of barkGeoms) g.dispose();

  // Merge leaves
  const leafGeoms = leafPoints.map((l) => leafToGeometry(l));
  const leafGeom = BufferGeometryUtils.mergeGeometries(leafGeoms, false);
  for (const g of leafGeoms) g.dispose();

  return { barkGeom, leafGeom, params };
}

/**
 * Create an instanced forest of a given preset, placed across the terrain.
 * Returns a Group containing 2 InstancedMeshes (bark + leaves).
 */
export function createProceduralForest(arcs, options = {}) {
  const presets = options.presets || ['oak', 'pine', 'birch', 'bush'];
  const totalTrees = options.count ?? 1400;
  const densityCurve = options.densityCurve || ((h) => (h > WATER_LEVEL + 2 && h < 90) ? 1 : 0);

  const group = new THREE.Group();
  group.name = 'proc-forest';

  // Build prototypes for each preset
  const prototypes = {};
  for (const name of presets) {
    prototypes[name] = buildTreePrototype(name, name.charCodeAt(0) + name.charCodeAt(name.length - 1));
  }

  // Decide how many per species
  const perSpecies = Math.ceil(totalTrees / presets.length);

  for (const speciesName of presets) {
    const { barkGeom, leafGeom, params } = prototypes[speciesName];

    const barkMat = new THREE.MeshStandardMaterial({
      color: params.barkColor,
      roughness: 0.95,
      metalness: 0,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: params.leafColor,
      emissive: params.leafColor,
      emissiveIntensity: 0.25,
      roughness: 0.75,
      metalness: 0,
      side: THREE.DoubleSide,
      flatShading: true,
    });

    const bark = new THREE.InstancedMesh(barkGeom, barkMat, perSpecies);
    const leaves = new THREE.InstancedMesh(leafGeom, leafMat, perSpecies);
    bark.castShadow = false;
    leaves.castShadow = false;

    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();

    let placed = 0;
    let attempts = 0;
    const maxAttempts = perSpecies * 8;
    const placeRadius = WORLD_HALF * 0.9;

    while (placed < perSpecies && attempts < maxAttempts) {
      attempts++;
      const x = (Math.random() * 2 - 1) * placeRadius;
      const z = (Math.random() * 2 - 1) * placeRadius;
      const y = getTerrainHeight(x, z, arcs);
      if (!densityCurve(y)) continue;
      if (y < WATER_LEVEL + 1) continue;

      const [smin, smax] = params.scaleRange;
      const s = smin + Math.random() * (smax - smin);
      pos.set(x, y, z);
      quat.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
      scl.set(s, s, s);
      matrix.compose(pos, quat, scl);
      bark.setMatrixAt(placed, matrix);
      leaves.setMatrixAt(placed, matrix);
      placed++;
    }
    bark.count = placed;
    leaves.count = placed;
    bark.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;

    bark.name = `proc-bark-${speciesName}`;
    leaves.name = `proc-leaves-${speciesName}`;
    group.add(bark);
    group.add(leaves);
    console.log(`  ProceduralForest: ${speciesName} × ${placed} trees (2 draw calls)`);
  }

  return group;
}
