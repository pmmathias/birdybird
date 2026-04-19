import * as THREE from 'three';
import { fbm } from '../utils/noise.js';
import { randomRange } from '../utils/math.js';
import { getTerrainHeight } from './Terrain.js';
import {
  createTreeGeometry, generateTreeCanvas,
  generatePineCanvas, generateBirchCanvas, generateBushCanvas,
} from './TreeCluster.js';
import {
  WORLD_HALF, WATER_LEVEL,
  TREE_CLUSTER_COUNT, TREES_PER_CLUSTER_MIN, TREES_PER_CLUSTER_MAX,
  TREE_MIN_HEIGHT, TREE_MAX_HEIGHT,
} from '../constants.js';

/**
 * Tree type definitions with height-based probability.
 */
const TREE_TYPES = [
  {
    name: 'oak',
    genCanvas: generateTreeCanvas,
    geoArgs: [1, 0.8],    // unit height, width ratio
    heightRange: [0, 60],
    heightScale: [10, 18],
    widthFactor: 0.8,
  },
  {
    name: 'pine',
    genCanvas: generatePineCanvas,
    geoArgs: [1, 0.5],
    heightRange: [15, 100],  // pines grow high!
    heightScale: [12, 22],
    widthFactor: 0.5,
  },
  {
    name: 'birch',
    genCanvas: generateBirchCanvas,
    geoArgs: [1, 0.65],
    heightRange: [10, 55],
    heightScale: [10, 16],
    widthFactor: 0.65,
  },
  {
    name: 'bush',
    genCanvas: () => generateBushCanvas(256, 256),
    geoArgs: [1, 1.5],    // short and wide
    heightRange: [0, 40],
    heightScale: [3, 6],
    widthFactor: 1.5,
  },
];

/**
 * Get which tree types are valid at a given elevation.
 */
function getValidTypes(elevation) {
  return TREE_TYPES.filter(
    (t) => elevation >= t.heightRange[0] && elevation <= t.heightRange[1]
  );
}

/**
 * Place tree clusters across the terrain using noise-based distribution.
 * Uses multiple InstancedMesh for different tree types.
 */
export function createForest(arcs, housePositions = []) {
  // Prepare materials and geometries per type
  // Color palettes for each tree type
  const treeColors = {
    oak: { trunk: 0x5a3a1a, crown: 0x2a6b1e },
    pine: { trunk: 0x3a2008, crown: 0x1a4a18 },
    birch: { trunk: 0xe8e0d0, crown: 0x5aaa3a },
    bush: { trunk: 0x4a3a1a, crown: 0x2a6a1a },
  };

  const typeData = TREE_TYPES.map((type) => {
    const colors = treeColors[type.name] || treeColors.oak;
    const geo = createTreeGeometry(type.geoArgs[0], type.geoArgs[1], type.name);

    // Two materials: trunk (index 0 = cylinder) and crown (rest)
    // For InstancedMesh we use a single material — blend trunk color into crown
    const mat = new THREE.MeshLambertMaterial({ color: colors.crown });

    return { type, geo, mat, transforms: [] };
  });

  // Scatter trees (reduced on mobile)
  const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || navigator.maxTouchPoints > 1 || 'ontouchstart' in window;
  const clusterLimit = IS_MOBILE ? Math.floor(TREE_CLUSTER_COUNT * 0.25) : TREE_CLUSTER_COUNT;
  for (let c = 0; c < clusterLimit; c++) {
    const clusterX = randomRange(-WORLD_HALF * 0.9, WORLD_HALF * 0.9);
    const clusterZ = randomRange(-WORLD_HALF * 0.9, WORLD_HALF * 0.9);
    const centerHeight = getTerrainHeight(clusterX, clusterZ, arcs);
    if (centerHeight < WATER_LEVEL + 3) continue;

    const treeCount = Math.floor(randomRange(TREES_PER_CLUSTER_MIN, TREES_PER_CLUSTER_MAX));
    const clusterRadius = 20 + Math.random() * 40;

    for (let t = 0; t < treeCount; t++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * clusterRadius;
      const tx = clusterX + Math.cos(angle) * dist;
      const tz = clusterZ + Math.sin(angle) * dist;

      if (Math.abs(tx) > WORLD_HALF * 0.95 || Math.abs(tz) > WORLD_HALF * 0.95) continue;

      const terrainY = getTerrainHeight(tx, tz, arcs);
      if (terrainY < WATER_LEVEL + 3) continue;

      const density = fbm(tx * 0.01, tz * 0.01, 3);
      if (density < -0.2) continue;

      // Skip trees too close to buildings
      let nearHouse = false;
      for (const h of housePositions) {
        const dx = tx - h.x, dz = tz - h.z;
        if (dx * dx + dz * dz < (h.r + 5) * (h.r + 5)) { nearHouse = true; break; }
      }
      if (nearHouse) continue;

      // Pick a random valid tree type for this elevation
      const validTypes = getValidTypes(terrainY);
      if (validTypes.length === 0) continue;
      const chosenType = validTypes[Math.floor(Math.random() * validTypes.length)];
      const data = typeData.find((d) => d.type.name === chosenType.name);

      const height = randomRange(chosenType.heightScale[0], chosenType.heightScale[1]);
      const width = height * chosenType.widthFactor + Math.random() * 2;

      data.transforms.push({ x: tx, y: terrainY, z: tz, height, width });
    }
  }

  // Create InstancedMesh per type and group them
  const group = new THREE.Group();
  group.name = 'forest';

  for (const data of typeData) {
    if (data.transforms.length === 0) continue;

    const mesh = new THREE.InstancedMesh(data.geo, data.mat, data.transforms.length);
    mesh.name = `trees-${data.type.name}`;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < data.transforms.length; i++) {
      const t = data.transforms[i];
      dummy.position.set(t.x, t.y, t.z);
      dummy.scale.set(t.width, t.height, t.width);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  return group;
}
