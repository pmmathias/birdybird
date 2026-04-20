import * as THREE from 'three';
import { createTerrain } from './Terrain.js';
import { createWaterPlane } from './WaterPlane.js';
import { createCloudLayer } from './CloudPlane.js';
import { createForest } from './ForestPlacer.js';
import { createProceduralForest } from './ProceduralForest.js';
import { InstancedForest, createLeafTexture, createBarkTexture } from '../vendor/RedReddingtonForest.js';
import { getTerrainHeight } from './Terrain.js';
import { createLandmark } from './Landmarks.js';
import { createHouses } from './HousePlacer.js';
import { createHotelResorts } from './HotelResort.js';
import { UnderwaterWorld } from './Underwater.js';
import { Octree } from '../spatial/Octree.js';
import { FrustumCuller } from '../spatial/FrustumCuller.js';
import { createTerrainMaterial } from './TerrainShader.js';
import {
  GRASS_TEXTURE_REPEAT, WATER_LEVEL, FOG_NEAR, FOG_FAR,
  WORLD_HALF,
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

  // --- Forest ---
  // Mode selection (default = red-reddington L-system forest, MIT):
  //   ?forest=rr       (default) — red-reddington's shader-LOD instanced forest
  //   ?forest=proc     — our clean-room L-system PoC (older version)
  //   ?forest=sprite   — legacy canvas-sprite forest
  const forestMode = new URLSearchParams(location.search).get('forest') || 'rr';
  console.time('Forest');

  function buildRrForest() {
    const count = IS_MOBILE ? 1500 : 3500;
    const leafTex = createLeafTexture();
    const barkTex = createBarkTexture();
    const rr = new InstancedForest({
      treeCount: count,
      forestRadius: WORLD_HALF * 0.9,
      forestCenter: new THREE.Vector3(0, 0, 0),
      groundHeightFn: (x, z) => getTerrainHeight(x, z, arcs),
      groundFilterFn: (x, y, z) => y > WATER_LEVEL + 2 && y < 90,
      config: {
        // Bigger trees so they're not dwarfed by a 6km terrain
        TRUNK_LENGTH_MIN: 10,
        TRUNK_LENGTH_MAX: 18,
        TRUNK_RADIUS_MIN: 0.35,
        TRUNK_RADIUS_MAX: 0.7,
        LEAF_SIZE: 2.2,
        // Scale LOD distances to our flight-game view range
        LOD_FADE_START: 260,
        LOD_MAX_DISTANCE: 520,
        LOD_SWAY_DISTANCE: 120,
        LOD_SWAY_FADE_START: 70,
      },
    });
    const result = rr.generate(leafTex, barkTex);
    console.log(`  RedReddington forest: ${result.stats.trees} trees, ${result.stats.branches} branches, ${result.stats.leaves} leaves`);
    rr.group.name = 'rr-forest';
    return { group: rr.group, updater: rr };
  }

  let rrUpdater = null;
  let forest;
  if (forestMode === 'rr') {
    const built = buildRrForest();
    forest = built.group;
    rrUpdater = built.updater;
  } else if (forestMode === 'proc') {
    forest = createProceduralForest(arcs, { count: IS_MOBILE ? 700 : 1400 });
  } else {
    forest = createForest(arcs, housePositions);
  }
  scene.add(forest);
  console.timeEnd('Forest');

  /**
   * Rebuild the forest with biome-specific options.
   * Called on level-up so each biome has its own vegetation character.
   */
  function regenerateForest(biomeForestOptions = {}) {
    if (forest) {
      scene.remove(forest);
      forest.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material?.dispose?.();
        }
      });
    }
    if (forestMode === 'rr') {
      if (rrUpdater) rrUpdater.dispose();
      const built = buildRrForest();
      forest = built.group;
      rrUpdater = built.updater;
    } else if (forestMode === 'proc') {
      forest = createProceduralForest(arcs, {
        count: IS_MOBILE ? 700 : 1400,
        presets: biomeForestOptions.types || ['oak', 'pine', 'birch', 'bush'],
      });
    } else {
      forest = createForest(arcs, housePositions, biomeForestOptions);
    }
    scene.add(forest);
  }

  // --- Biome landmark (lighthouse, pyramid, iceberg, …) ---
  let landmark = createLandmark('Sunny Islands', arcs);
  if (landmark) scene.add(landmark);

  function regenerateLandmark(biome) {
    if (landmark) {
      scene.remove(landmark);
      landmark.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material?.dispose?.();
        }
      });
    }
    landmark = createLandmark(biome.name, arcs);
    if (landmark) scene.add(landmark);
  }

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

  let elapsed = 0;
  function update(dt, camera, birdAltitude) {
    elapsed += dt;
    water.update(dt);
    clouds.update(dt);
    frustumCuller.update(camera);
    if (underwater) underwater.update(dt, birdAltitude);
    if (rrUpdater) rrUpdater.update(elapsed);
  }

  return { update, arcs, terrainChunks: chunks, regenerateForest, regenerateLandmark };
}
