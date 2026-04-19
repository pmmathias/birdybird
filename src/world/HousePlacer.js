import * as THREE from 'three';
import { randomRange } from '../utils/math.js';
import { fbm } from '../utils/noise.js';
import { getTerrainHeight } from './Terrain.js';
import { WORLD_HALF, WATER_LEVEL } from '../constants.js';

const CLUSTER_COUNT = 400;
const HOUSES_PER_CLUSTER_MIN = 6;
const HOUSES_PER_CLUSTER_MAX = 25;
const MAX_ELEVATION = 70;
const MAX_SLOPE = 0.25;

// Building dimension presets
const BUILDING_TYPES = {
  house:    { w: [6, 10], h: [5, 8], d: [7, 12], roofH: [3, 5] },
  barn:     { w: [10, 14], h: [6, 8], d: [14, 18], roofH: [4, 5] },
  tower:    { w: [4, 5], h: [12, 18], d: [4, 5], roofH: [4, 5] },
  hotel:    { w: [15, 25], h: [12, 22], d: [12, 20], roofH: [2, 2] },
  highrise: { w: [10, 18], h: [35, 70], d: [10, 18], roofH: [1, 1] },
};

function getSlope(x, z, arcs) {
  const d = 2;
  const h0 = getTerrainHeight(x, z, arcs);
  const hx = getTerrainHeight(x + d, z, arcs);
  const hz = getTerrainHeight(x, z + d, arcs);
  return Math.sqrt(((hx - h0) / d) ** 2 + ((hz - h0) / d) ** 2);
}

/**
 * Load wall and roof textures for buildings.
 */
function loadBuildingTextures() {
  const loader = new THREE.TextureLoader();

  function tex(url) {
    const t = loader.load(url);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  return {
    brickTex: tex('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brick_wall_006/brick_wall_006_diff_1k.jpg'),
    concreteTex: tex('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_wall_008/concrete_wall_008_diff_1k.jpg'),
    roofTex: tex('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/roof_tiles/roof_tiles_diff_1k.jpg'),
  };
}

/**
 * Place varied buildings across the terrain.
 */
export function createHouses(arcs) {
  const { brickTex, concreteTex, roofTex } = loadBuildingTextures();

  const brickMat = new THREE.MeshLambertMaterial({ map: brickTex });
  const concreteMat = new THREE.MeshLambertMaterial({ map: concreteTex });
  const roofMat = new THREE.MeshLambertMaterial({ map: roofTex });

  const group = new THREE.Group();
  group.name = 'buildings';

  // Collect all building transforms
  const transforms = [];

  for (let c = 0; c < CLUSTER_COUNT; c++) {
    const cx = randomRange(-WORLD_HALF * 0.75, WORLD_HALF * 0.75);
    const cz = randomRange(-WORLD_HALF * 0.75, WORLD_HALF * 0.75);
    const centerH = getTerrainHeight(cx, cz, arcs);

    if (centerH < WATER_LEVEL + 3 || centerH > MAX_ELEVATION) continue;
    if (getSlope(cx, cz, arcs) > MAX_SLOPE) continue;

    const treeDensity = fbm(cx * 0.01, cz * 0.01, 3);
    if (treeDensity > 0.5) continue;

    const isUrban = treeDensity < -0.1;
    const clusterRadius = isUrban ? 30 + Math.random() * 20 : 15 + Math.random() * 15;
    const count = isUrban
      ? Math.floor(randomRange(HOUSES_PER_CLUSTER_MAX * 0.7, HOUSES_PER_CLUSTER_MAX))
      : Math.floor(randomRange(HOUSES_PER_CLUSTER_MIN, HOUSES_PER_CLUSTER_MAX));

    for (let i = 0; i < count; i++) {
      const hx = cx + randomRange(-clusterRadius, clusterRadius);
      const hz = cz + randomRange(-clusterRadius, clusterRadius);
      const hh = getTerrainHeight(hx, hz, arcs);

      if (hh < WATER_LEVEL + 3 || hh > MAX_ELEVATION) continue;
      if (getSlope(hx, hz, arcs) > MAX_SLOPE) continue;

      const r = Math.random();
      let type;
      if (isUrban) {
        if (r < 0.25) type = 'house';
        else if (r < 0.35) type = 'barn';
        else if (r < 0.50) type = 'tower';
        else if (r < 0.75) type = 'hotel';
        else type = 'highrise';
      } else {
        if (r < 0.55) type = 'house';
        else if (r < 0.75) type = 'barn';
        else if (r < 0.85) type = 'tower';
        else if (r < 0.95) type = 'hotel';
        else type = 'highrise';
      }

      // Check minimum distance to existing buildings
      const minDist = 12; // no overlap
      let tooClose = false;
      for (const t of transforms) {
        const dx = hx - t.x, dz = hz - t.z;
        if (dx * dx + dz * dz < minDist * minDist) { tooClose = true; break; }
      }
      if (tooClose) continue;

      const def = BUILDING_TYPES[type];
      const bw = randomRange(def.w[0], def.w[1]);
      const bh = randomRange(def.h[0], def.h[1]);
      const bd = randomRange(def.d[0], def.d[1]);
      const rh = randomRange(def.roofH[0], def.roofH[1]);

      transforms.push({
        x: hx, y: hh + 0.2, z: hz,
        rot: Math.random() * Math.PI * 2,
        bw, bh, bd, rh, type,
      });
    }
  }

  // Split transforms: traditional (brick) vs modern (concrete)
  const modernTypes = new Set(['hotel', 'highrise']);
  const traditionalT = transforms.filter(t => !modernTypes.has(t.type));
  const modernT = transforms.filter(t => modernTypes.has(t.type));

  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.ConeGeometry(1, 1, 4);
  roofGeo.rotateY(Math.PI / 4);

  function buildInstances(list, wallMaterial, name) {
    if (list.length === 0) return;
    const walls = new THREE.InstancedMesh(wallGeo, wallMaterial, list.length);
    walls.name = `${name}-walls`;
    const roofs = new THREE.InstancedMesh(roofGeo, roofMat, list.length);
    roofs.name = `${name}-roofs`;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      dummy.position.set(t.x, t.y + t.bh / 2, t.z);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.set(t.bw, t.bh, t.bd);
      dummy.updateMatrix();
      walls.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, t.y + t.bh + t.rh / 2, t.z);
      dummy.scale.set(t.bw * 0.75, t.rh, t.bd * 0.75);
      dummy.updateMatrix();
      roofs.setMatrixAt(i, dummy.matrix);
    }

    walls.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    walls.frustumCulled = false;
    roofs.frustumCulled = false;
    group.add(walls);
    group.add(roofs);
  }

  buildInstances(traditionalT, brickMat, 'traditional');
  buildInstances(modernT, concreteMat, 'modern');

  // Export positions for tree exclusion
  const positions = transforms.map(t => ({ x: t.x, z: t.z, r: Math.max(t.bw, t.bd) * 0.7 }));

  return { group, positions };
}
