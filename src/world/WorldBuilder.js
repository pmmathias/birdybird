import * as THREE from 'three';
import { createTerrain } from './Terrain.js';
import { createWaterPlane } from './WaterPlane.js';
import { createCloudLayer } from './CloudPlane.js';
import { createForest } from './ForestPlacer.js';
import { createHouses } from './HousePlacer.js';
import { createHotelResorts } from './HotelResort.js';
import { UnderwaterWorld } from './Underwater.js';
import { Octree } from '../spatial/Octree.js';
import { FrustumCuller } from '../spatial/FrustumCuller.js';
import { createTerrainMaterial } from './TerrainShader.js';
import {
  GRASS_TEXTURE_REPEAT, WATER_LEVEL, FOG_NEAR, FOG_FAR,
} from '../constants.js';

// Detect mobile for reduced scene complexity
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || navigator.maxTouchPoints > 1 || 'ontouchstart' in window;

function loadTex(url) {
  const tex = new THREE.TextureLoader().load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Orchestrates creation of all world elements.
 */
export function buildWorld(scene, renderer) {
  // Find sun direction from directional light
  let sunDir = new THREE.Vector3(0.4, 0.6, 0.2).normalize();
  scene.traverse((obj) => {
    if (obj.isDirectionalLight) {
      sunDir = obj.position.clone().normalize();
    }
  });

  // Fog color from scene
  const fogColor = scene.fog ? scene.fog.color : new THREE.Color(0xb0d0e8);

  // --- Load 4 terrain textures (Poly Haven, CC0) ---
  const textures = {
    sandTex: loadTex('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/sandy_gravel/sandy_gravel_diff_1k.jpg'),
    grassTex: loadTex('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/leafy_grass/leafy_grass_diff_1k.jpg'),
    rockTex: loadTex('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rock_boulder_cracked/rock_boulder_cracked_diff_1k.jpg'),
    snowTex: loadTex('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/snow_field_aerial/snow_field_aerial_col_1k.jpg'),
    forestTex: loadTex('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_ground_04/forest_ground_04_diff_1k.jpg'),
    gravelTex: loadTex('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gravel_floor/gravel_floor_diff_1k.jpg'),
  };

  // --- Terrain material (custom shader with height-based blending) ---
  const terrainMaterial = createTerrainMaterial(textures, {
    waterLevel: WATER_LEVEL,
    sandEnd: WATER_LEVEL + 8,
    grassEnd: 35,
    rockEnd: 95,
    sunDirection: sunDir,
    fogColor,
    fogNear: FOG_NEAR,
    fogFar: FOG_FAR,
  });

  // --- Terrain ---
  console.time('Terrain');
  const { chunks, arcs, group: terrainGroup } = createTerrain(terrainMaterial);
  scene.add(terrainGroup);
  console.timeEnd('Terrain');

  // --- Water ---
  let sun = null;
  scene.traverse((obj) => { if (obj.isDirectionalLight) sun = obj; });
  const water = createWaterPlane(sun, renderer);
  scene.add(water.mesh);

  // --- Clouds ---
  const clouds = createCloudLayer();
  scene.add(clouds.group);

  // --- Houses FIRST (so we can exclude trees near buildings) ---
  console.time('Houses');
  const { group: houses, positions: housePositions } = createHouses(arcs);
  scene.add(houses);
  // Log building counts
  let totalBuildings = 0;
  houses.traverse(obj => {
    if (obj.isInstancedMesh) {
      console.log(`  ${obj.name}: ${obj.count} instances`);
      totalBuildings += obj.count;
    }
  });
  console.log(`Total buildings: ${totalBuildings}`);
  console.timeEnd('Houses');

  // --- Hotel Resorts (desktop only — too many meshes for mobile) ---
  if (!IS_MOBILE) {
    const resorts = createHotelResorts(arcs);
    scene.add(resorts);
  }

  // --- Forest (placed AFTER houses, excludes tree positions near buildings) ---
  console.time('Forest');
  const forest = createForest(arcs, housePositions);
  scene.add(forest);
  console.timeEnd('Forest');

  // --- Underwater world (reduced on mobile) ---
  const underwater = IS_MOBILE ? null : new UnderwaterWorld(scene, arcs);

  // --- Octree + Frustum Culler ---
  console.time('Octree');
  const octree = new Octree();
  terrainGroup.updateMatrixWorld(true);
  for (const chunk of chunks) {
    octree.insertMesh(chunk);
  }
  const frustumCuller = new FrustumCuller(octree, chunks);
  console.timeEnd('Octree');

  function update(dt, camera, birdAltitude) {
    water.update(dt);
    clouds.update(dt);
    frustumCuller.update(camera);
    if (underwater) underwater.update(dt, birdAltitude);
  }

  return { update, arcs, terrainChunks: chunks };
}
