import * as THREE from 'three';
import { createTerrain } from './Terrain.js';
import { createWaterPlane } from './WaterPlane.js';
import { createCloudLayer } from './CloudPlane.js';
import { InstancedForest, createLeafTexture, createBarkTexture } from '../vendor/RedReddingtonForest.js';
import { getTerrainHeight } from './Terrain.js';
import { createLandmark } from './Landmarks.js';
import { createHouses } from './HousePlacer.js';
import { createHotelResorts } from './HotelResort.js';
import { buildStackConeConifers, sampleConiferPositions } from './StackConeConifers.js';
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

  // --- Load 6 terrain textures (Poly Haven, CC0) ---
  // Bundled locally under public/textures/ground/ so they precache for offline
  // and load same-origin (no third-party CDN round-trip on first paint).
  const textures = {
    sandTex: loadTex('textures/ground/sandy_gravel_diff_1k.jpg'),
    grassTex: loadTex('textures/ground/leafy_grass_diff_1k.jpg'),
    rockTex: loadTex('textures/ground/rock_boulder_cracked_diff_1k.jpg'),
    snowTex: loadTex('textures/ground/snow_field_aerial_col_1k.jpg'),
    forestTex: loadTex('textures/ground/forest_ground_04_diff_1k.jpg'),
    gravelTex: loadTex('textures/ground/gravel_floor_diff_1k.jpg'),
  };

  // --- Terrain material (custom shader with height-based blending) ---
  // TSL NodeMaterial on WebGPU, GLSL ShaderMaterial on WebGL
  const terrainParams = {
    waterLevel: WATER_LEVEL,
    sandEnd: WATER_LEVEL + 8,
    grassEnd: 35,
    rockEnd: 110,    // snow line raised so the conifer band has space
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
  // Scene-detail multiplier — controls broadleaf forest density,
  // conifer density, and (later) cloud / sprite densities. Default
  // mid = current tuning. Low for older GPUs / no-GPU laptops; high
  // for desktop with discrete GPU.
  const detailParam = urlParams.get('detail');
  const detailMul = detailParam === 'low'  ? 0.40
                  : detailParam === 'high' ? 1.75
                  :                          1.00;

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
      if (y > WATER_LEVEL + 4 && y < 110) centers.push(seed);
    }

    // Try to seed at least one alpine cluster (>70 m) so conifers
    // actually appear on screen. Sweep the world for a high-altitude
    // pocket; first hit wins.
    let alpineSeeded = false;
    for (let s = 0; s < 80 && !alpineSeeded; s++) {
      const x = (Math.random() * 2 - 1) * sampleRadius;
      const z = (Math.random() * 2 - 1) * sampleRadius;
      const y = getTerrainHeight(x, z, arcs);
      if (y > 75 && y < 110) {
        centers.push({ x, z });
        alpineSeeded = true;
      }
    }

    let attempts = 0;
    while (centers.length < clusterCount && attempts < clusterCount * 30) {
      attempts++;
      const x = (Math.random() * 2 - 1) * sampleRadius;
      const z = (Math.random() * 2 - 1) * sampleRadius;
      const y = getTerrainHeight(x, z, arcs);
      // Allow trees all the way up to 110 m so the snow-line conifer
      // band (90-100 m) actually gets populated.
      if (y < WATER_LEVEL + 4 || y > 110) continue;
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
    const baseCount = IS_MOBILE ? 600 : 2000;
    const count = countOverride || Math.round(baseCount * detailMul);
    // Cluster count tuning explored in perf-bench: fewer clusters (8) helped
    // air-over-land (+72%) but hurt inside-forest (-56%) because dense-view
    // scenarios benefit most from fine-grained frustum culling. 20 clusters
    // is the best overall compromise for both WebGL2 and WebGPU.
    const clusterCount = clustersOverride || Math.max(8, Math.round(count / 100));
    const leafTex = createLeafTexture();
    const barkTex = createBarkTexture();
    const { positions, centers } = sampleClusterPositions(count, clusterCount);

    const rr = new InstancedForest({
      treeCount: positions.length,
      treePositions: positions,
      useWebGPU: !!renderer.isWebGPURenderer,
      groundHeightFn: (x, z) => getTerrainHeight(x, z, arcs),
      groundFilterFn: (x, y, z) => y > WATER_LEVEL + 2 && y < 115,
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

    // Split the single monolithic bark/leaf InstancedMeshes into per-cluster
    // sub-meshes with tight bounding spheres. Before this split, the forest
    // was one mesh with a world-spanning bounding sphere → Three.js frustum
    // culling never kicked in and the vertex shader ran for ~1M instances
    // every frame, even when the camera looked at an empty quadrant. With
    // per-cluster bounding, only visible clusters draw (≈3× FPS on WebGPU
    // in perf-bench).
    const splitGroup = splitForestByClusters(rr.meshes.bark, rr.meshes.leaves, centers);
    splitGroup.name = 'rr-forest';
    return { group: splitGroup, updater: rr };
  }

  // Post-process: rebuild the forest as N per-cluster InstancedMeshes. Each
  // sub-mesh owns only its cluster's instances and gets a tight boundingSphere
  // so three.js frustum culling can skip whole clusters on oblique views.
  //
  // Non-instance vertex attributes (position/normal/uv) are SHARED across all
  // sub-meshes — only the InstancedBufferAttributes (instanceMatrix + any
  // per-instance attrs like instanceTreeBaseY, instanceColorAttr, etc) are
  // sliced per cluster. Material is shared too. Memory cost is ~20 extra
  // geometry wrappers + 20 extra instance-attribute buffers, but each is
  // 1/20th the size of the monolithic version.
  //
  // T027: each cluster also carries a low-LOD bark twin built from a 4-segment
  // cylinder (vs the 8-segment original). Per-frame `updateForestLOD(camera)`
  // toggles visibility between hi/lo bark + hides leaves outright beyond
  // LEAF_HIDE_DIST. Big triangle savings on far clusters, no visual hit
  // because at >400 m the cylinder facet count is below the eye's resolution.
  const LOD_NEAR_DIST   = 500;   // < this: high-poly bark
  // World spans ±3000m and clusters can be hundreds of metres from each
  // other, so leaves stay on across the whole island. Frustum culling
  // skips off-screen clusters; the per-leaf shader LOD shrinks distant
  // leaves to half-area; we no longer hide the leaf cluster entirely.
  const LOW_BARK_SEGS   = 4;     // vs 8 for high
  const LOW_BARK_GEO    = new THREE.CylinderGeometry(1, 1, 1, LOW_BARK_SEGS, 1);
  const _camTmp = new THREE.Vector3();

  function splitForestByClusters(barkMesh, leafMesh, centers) {
    const group = new THREE.Group();
    if (!barkMesh && !leafMesh) return group;
    // Per-frame LOD-switch state: cluster id → { center, hi, lo, leaf }
    group.userData.lodClusters = [];

    // For each source instance, find the closest cluster center (by XZ).
    const assignToClusters = (src) => {
      const buckets = centers.map(() => []);
      const mat = new THREE.Matrix4();
      for (let i = 0; i < src.count; i++) {
        src.getMatrixAt(i, mat);
        const x = mat.elements[12];
        const z = mat.elements[14];
        let best = 0;
        let bestD = Infinity;
        for (let c = 0; c < centers.length; c++) {
          const dx = x - centers[c].x;
          const dz = z - centers[c].z;
          const d = dx * dx + dz * dz;
          if (d < bestD) { bestD = d; best = c; }
        }
        buckets[best].push(i);
      }
      return buckets;
    };

    /** Build one InstancedMesh sub-cluster from a slice of source instances.
     *  `geometryOverride` (optional) lets callers swap in a different shared
     *  base geometry (the LOD-low cylinder) while still copying the same
     *  per-instance attributes. */
    const buildSub = (src, kind, c, ids, sharedAttrs, sharedIndex, instanceAttrNames, perInstanceRadius, geometryOverride) => {
      const subGeo = new THREE.BufferGeometry();
      const baseAttrs = geometryOverride ? geometryOverride.attributes : sharedAttrs;
      const baseIndex = geometryOverride ? geometryOverride.index : sharedIndex;
      for (const name in baseAttrs) subGeo.setAttribute(name, baseAttrs[name]);
      if (baseIndex) subGeo.setIndex(baseIndex);

      // Slice per-instance attributes down to this cluster's ids.
      for (const name of instanceAttrNames) {
        const srcAttr = src.geometry.attributes[name];
        const size = srcAttr.itemSize;
        const arr = new Float32Array(ids.length * size);
        for (let j = 0; j < ids.length; j++) {
          const srcIdx = ids[j] * size;
          for (let k = 0; k < size; k++) arr[j * size + k] = srcAttr.array[srcIdx + k];
        }
        subGeo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
      }

      subGeo.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(0, perInstanceRadius * 0.5, 0),
        perInstanceRadius,
      );

      const sub = new THREE.InstancedMesh(subGeo, src.material, ids.length);
      sub.name = `rr-${kind}-c${c}`;
      sub.frustumCulled = true;
      sub.castShadow = false;
      sub.receiveShadow = false;
      const mat = new THREE.Matrix4();
      for (let j = 0; j < ids.length; j++) {
        src.getMatrixAt(ids[j], mat);
        sub.setMatrixAt(j, mat);
      }
      sub.instanceMatrix.needsUpdate = true;
      sub.computeBoundingSphere();
      return sub;
    };

    const splitOne = (src, kind) => {
      const buckets = assignToClusters(src);
      const instanceAttrNames = [];
      const sharedAttrs = {};
      for (const name in src.geometry.attributes) {
        if (src.geometry.attributes[name].isInstancedBufferAttribute) {
          instanceAttrNames.push(name);
        } else {
          sharedAttrs[name] = src.geometry.attributes[name];
        }
      }
      const sharedIndex = src.geometry.index;
      const perInstanceRadius = kind === 'bark' ? 20 : 3;

      for (let c = 0; c < centers.length; c++) {
        const ids = buckets[c];
        if (ids.length === 0) continue;

        const hi = buildSub(src, kind, c, ids, sharedAttrs, sharedIndex, instanceAttrNames, perInstanceRadius);
        group.add(hi);

        // For bark only: also build a low-LOD twin sharing the same
        // per-instance attribute slice but a 4-segment cylinder.
        let lo = null;
        if (kind === 'bark') {
          lo = buildSub(src, 'bark-lo', c, ids, sharedAttrs, sharedIndex, instanceAttrNames, perInstanceRadius, LOW_BARK_GEO);
          lo.visible = false;  // hi visible by default
          group.add(lo);
        }

        // Compute actual spatial extent of the cluster so the per-frame
        // LOD test uses (camera→cluster-edge) instead of (camera→center).
        // With few clusters spanning >1 km each, the centre-only test
        // hid leaves on trees right next to the bird because the cluster
        // centre was hundreds of metres away.
        let maxOff2 = 0;
        const tmpMat = new THREE.Matrix4();
        for (const id of ids) {
          src.getMatrixAt(id, tmpMat);
          const dx = tmpMat.elements[12] - centers[c].x;
          const dz = tmpMat.elements[14] - centers[c].z;
          const d2 = dx * dx + dz * dz;
          if (d2 > maxOff2) maxOff2 = d2;
        }
        const clusterRadius = Math.sqrt(maxOff2);

        // Track per-cluster LOD state. Leaves and bark-lo are stored on
        // the same record so the per-frame loop has everything it needs.
        let entry = group.userData.lodClusters[c];
        if (!entry) entry = group.userData.lodClusters[c] = { center: centers[c], radius: clusterRadius };
        // Take the larger of the radii so leaves + bark agree.
        if (clusterRadius > entry.radius) entry.radius = clusterRadius;
        if (kind === 'bark')      { entry.hi = hi; entry.lo = lo; }
        else if (kind === 'leaf') { entry.leaf = hi; }
      }
      // Original monolithic geometry no longer needed.
      src.geometry.dispose();
    };

    if (barkMesh) splitOne(barkMesh, 'bark');
    if (leafMesh) splitOne(leafMesh, 'leaf');
    // Compact userData.lodClusters (drop empty centers)
    group.userData.lodClusters = group.userData.lodClusters.filter(Boolean);
    console.log(`  Forest split into ${group.children.length} cluster sub-meshes (with LOD twins)`);
    return group;
  }

  /** Per-frame LOD update — toggles each cluster's hi/lo bark + leaf
   *  visibility based on distance from camera to the cluster's nearest
   *  edge (not its centre). With wide clusters this matters: the bird
   *  can be inside one tree while the cluster centre is 600 m away. */
  function updateForestLOD(camera) {
    if (!forest || !forest.userData.lodClusters) return;
    camera.getWorldPosition(_camTmp);
    for (const cluster of forest.userData.lodClusters) {
      const dx = _camTmp.x - cluster.center.x;
      const dz = _camTmp.z - cluster.center.z;
      const distToCenter = Math.sqrt(dx * dx + dz * dz);
      const dist = Math.max(0, distToCenter - (cluster.radius || 0));
      const near = dist < LOD_NEAR_DIST;
      // Hi-poly bark for near clusters, lo-poly for the rest. Both
      // bark and leaves stay visible at all distances — frustum culling
      // already drops off-screen clusters and per-leaf shader LOD
      // shrinks far leaves to half-area.
      if (cluster.hi) cluster.hi.visible = near;
      if (cluster.lo) cluster.lo.visible = !near;
      if (cluster.leaf) cluster.leaf.visible = true;
    }
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

  // --- Stack-cone conifers (alpine zone, snow-frosted band) ---
  // Independent of the L-system forest so we get cheap, clearly-shaped
  // fir trees. Two draw calls total regardless of conifer count.
  console.time('Conifers');
  const coniferCount = Math.round(900 * detailMul);
  const coniferPositions = sampleConiferPositions(arcs, coniferCount);
  const conifers = buildStackConeConifers(coniferPositions, arcs);
  scene.add(conifers);
  console.timeEnd('Conifers');

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
  // Underwater world is heavy to construct (~2400 sprites + textures).
  // Lazy-init: only spin it up when the bird first nears the water
  // surface. Players who never dive pay zero cost beyond a null check.
  // ?nounderwater=1 keeps it permanently disabled (perf-bench helper).
  const _disableUW = new URLSearchParams(location.search).has('nounderwater');
  let underwater = null;
  function ensureUnderwater() {
    if (underwater || IS_MOBILE || _disableUW) return underwater;
    console.time('Underwater (lazy)');
    underwater = new UnderwaterWorld(scene, arcs);
    // Constructor attaches its group to the scene; detach immediately
    // so it's only paid for during actual dives (Underwater.update
    // re-attaches when birdAltitude < WATER_LEVEL).
    if (underwater.group.parent) scene.remove(underwater.group);
    console.timeEnd('Underwater (lazy)');
    return underwater;
  }

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
    water.update(dt, birdAltitude);
    clouds.update(dt);
    frustumCuller.update(camera);
    // Trigger lazy underwater init slightly above water level so the
    // construction hitch happens before the splash, not at it.
    if (birdAltitude !== undefined && birdAltitude < WATER_LEVEL + 30) {
      ensureUnderwater();
    }
    if (underwater) underwater.update(dt, birdAltitude);
    if (rrUpdater) rrUpdater.update(elapsed);
    updateForestLOD(camera);
  }

  return { update, arcs, terrainChunks: chunks, regenerateForest, regenerateLandmark };
}
