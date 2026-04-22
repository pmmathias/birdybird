import * as THREE from 'three';
import { createTerrain } from './Terrain.js';
import { createWaterPlane } from './WaterPlane.js';
import { createCloudLayer } from './CloudPlane.js';
import { InstancedForest, createLeafTexture, createBarkTexture } from '../vendor/RedReddingtonForest.js';
import { getTerrainHeight } from './Terrain.js';
import { createLandmark } from './Landmarks.js';
import { createHouses } from './HousePlacer.js';
import { createHotelResorts } from './HotelResort.js';
import { UnderwaterWorld } from './Underwater.js';
import { Octree } from '../spatial/Octree.js';
import { FrustumCuller } from '../spatial/FrustumCuller.js';
import { createTerrainMaterial } from './TerrainShader.js';
import { createTerrainMaterialNode } from './TerrainShaderNode.js';
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
export async function buildWorld(scene, renderer) {
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
  // TSL NodeMaterial on WebGPU, GLSL ShaderMaterial on WebGL
  const terrainParams = {
    waterLevel: WATER_LEVEL,
    sandEnd: WATER_LEVEL + 8,
    grassEnd: 35,
    rockEnd: 95,
    sunDirection: sunDir,
    fogColor,
    fogNear: FOG_NEAR,
    fogFar: FOG_FAR,
  };
  const terrainMaterial = renderer.isWebGPURenderer
    ? createTerrainMaterialNode(textures, terrainParams)
    : createTerrainMaterial(textures, terrainParams);

  // --- Terrain ---
  console.time('Terrain');
  const { chunks, arcs, group: terrainGroup } = createTerrain(terrainMaterial);
  scene.add(terrainGroup);
  console.timeEnd('Terrain');

  // --- Water ---
  let sun = null;
  scene.traverse((obj) => { if (obj.isDirectionalLight) sun = obj; });
  const water = await createWaterPlane(sun, renderer);
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

  // --- Forest (red-reddington's L-system instanced forest, MIT) ---
  console.time('Forest');

  // URL overrides for tuning: ?trees=N&clusters=K
  const urlParams = new URLSearchParams(location.search);
  const countOverride = parseInt(urlParams.get('trees'), 10);
  const clustersOverride = parseInt(urlParams.get('clusters'), 10);

  /**
   * Sample cluster-based tree positions: pick K cluster centers (biased toward
   * land, away from water), then scatter trees inside each cluster with a
   * Gaussian-ish radius. This reads as "small forests" rather than evenly-
   * spaced trees.
   */
  function sampleClusterPositions(treeCount, clusterCount) {
    const positions = [];
    const sampleRadius = WORLD_HALF * 0.9;
    const centers = [];

    // Guarantee a cluster near the bird's spawn (origin) so the player always
    // sees trees right after calibration — otherwise on mobile + low LOD
    // the world looks empty until you fly 500m.
    for (const seed of [{ x: 120, z: 80 }, { x: -140, z: 60 }, { x: 60, z: -130 }]) {
      const y = getTerrainHeight(seed.x, seed.z, arcs);
      if (y > WATER_LEVEL + 4 && y < 80) centers.push(seed);
    }

    let attempts = 0;
    while (centers.length < clusterCount && attempts < clusterCount * 30) {
      attempts++;
      const x = (Math.random() * 2 - 1) * sampleRadius;
      const z = (Math.random() * 2 - 1) * sampleRadius;
      const y = getTerrainHeight(x, z, arcs);
      if (y < WATER_LEVEL + 4 || y > 80) continue;
      // Keep some min distance between clusters so they don't merge
      let tooClose = false;
      for (const c of centers) {
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < 140) { tooClose = true; break; }
      }
      if (tooClose) continue;
      centers.push({ x, z });
    }

    for (let i = 0; i < treeCount; i++) {
      const c = centers[i % centers.length];
      // Box-Muller for Gaussian-ish spread — tight core, some stragglers
      const u1 = Math.random() || 0.0001;
      const u2 = Math.random();
      const mag = Math.sqrt(-2 * Math.log(u1)) * 42; // ~42m 1-sigma → tighter
      const angle = u2 * Math.PI * 2;
      positions.push({
        x: c.x + Math.cos(angle) * mag,
        z: c.z + Math.sin(angle) * mag,
      });
    }
    return { positions, centers };
  }

  function buildRrForest() {
    const count = countOverride || (IS_MOBILE ? 600 : 2000);
    const clusterCount = clustersOverride || Math.max(8, Math.round(count / 100));
    const leafTex = createLeafTexture();
    const barkTex = createBarkTexture();
    const { positions, centers } = sampleClusterPositions(count, clusterCount);

    const rr = new InstancedForest({
      treeCount: positions.length,
      treePositions: positions,
      useWebGPU: !!renderer.isWebGPURenderer,
      groundHeightFn: (x, z) => getTerrainHeight(x, z, arcs),
      groundFilterFn: (x, y, z) => y > WATER_LEVEL + 2 && y < 90,
      config: {
        TRUNK_LENGTH_MIN: 10,
        TRUNK_LENGTH_MAX: 18,
        TRUNK_RADIUS_MIN: 0.35,
        TRUNK_RADIUS_MAX: 0.7,
        LEAF_SIZE: 2.6,
        LEAF_DENSITY: 2,
        // Much bigger LOD range — our flight altitudes regularly exceed the
        // old 440m cull. At typical 100–300m altitude the player could see
        // zero trees because every cluster was beyond the cull boundary.
        LOD_FADE_START: 600,
        LOD_MAX_DISTANCE: 1400,
        LOD_SWAY_DISTANCE: 140,
        LOD_SWAY_FADE_START: 80,
      },
    });
    const result = rr.generate(leafTex, barkTex);
    console.log(`  RedReddington forest: ${result.stats.trees} trees in ${centers.length} clusters, ${result.stats.branches} branches, ${result.stats.leaves} leaves`);
    rr.group.name = 'rr-forest';

    // World-spanning bounding sphere so Three.js doesn't wrongly cull the
    // forest when the camera is aimed away from world origin (default
    // bounding is just the unit-cylinder geometry).
    const worldSphere = new THREE.Sphere(new THREE.Vector3(0, 40, 0), WORLD_HALF * 1.5);
    if (rr.meshes.bark) {
      rr.meshes.bark.geometry.boundingSphere = worldSphere.clone();
      rr.meshes.bark.frustumCulled = true;
    }
    if (rr.meshes.leaves) {
      rr.meshes.leaves.geometry.boundingSphere = worldSphere.clone();
      rr.meshes.leaves.frustumCulled = true;
    }

    return { group: rr.group, updater: rr };
  }

  let rrUpdater = null;
  let forest;
  {
    const built = buildRrForest();
    forest = built.group;
    rrUpdater = built.updater;
  }
  scene.add(forest);
  console.timeEnd('Forest');

  /**
   * Rebuild the forest with biome-specific options.
   * Called on level-up so each biome has its own vegetation character.
   */
  function regenerateForest() {
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
    if (rrUpdater) rrUpdater.dispose();
    const built = buildRrForest();
    forest = built.group;
    rrUpdater = built.updater;
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
