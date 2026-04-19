import * as THREE from 'three';
import { randomRange } from '../utils/math.js';
import {
  WORLD_SIZE, WORLD_HALF, CHUNK_COUNT, CHUNK_SIZE,
  ARC_COUNT, ARC_MIN_RADIUS, ARC_MAX_RADIUS,
  ARC_MIN_HEIGHT, ARC_MAX_HEIGHT,
  VALLEY_ARC_RATIO, VALLEY_MIN_DEPTH, VALLEY_MAX_DEPTH, VALLEY_MAX_RADIUS,
  TERRAIN_SEGMENTS, GRASS_TEXTURE_REPEAT,
} from '../constants.js';

/**
 * Generate random parabolic arcs that define the terrain height.
 * Each arc: { cx, cz, radius, height }
 * height(x, z) = SUM [ h * max(0, 1 - ((x-cx)^2 + (z-cz)^2) / r^2) ]
 */
export function generateArcs(count = ARC_COUNT, seed = null) {
  const arcs = [];
  const valleyCount = Math.floor(count * VALLEY_ARC_RATIO);
  const hillCount = count - valleyCount;

  // Positive arcs (hills/mountains)
  for (let i = 0; i < hillCount; i++) {
    arcs.push({
      cx: randomRange(-WORLD_HALF, WORLD_HALF),
      cz: randomRange(-WORLD_HALF, WORLD_HALF),
      radius: randomRange(ARC_MIN_RADIUS, ARC_MAX_RADIUS),
      height: randomRange(ARC_MIN_HEIGHT, ARC_MAX_HEIGHT),
    });
  }

  // Landmark peaks (tall mountains for dramatic scenery)
  const landmarkCount = 10 + Math.floor(Math.random() * 6);
  for (let i = 0; i < landmarkCount; i++) {
    arcs.push({
      cx: randomRange(-WORLD_HALF * 0.7, WORLD_HALF * 0.7),
      cz: randomRange(-WORLD_HALF * 0.7, WORLD_HALF * 0.7),
      radius: randomRange(80, 250),
      height: randomRange(100, 220),
    });
  }

  // Negative arcs (valleys/canyons/lake beds)
  for (let i = 0; i < valleyCount; i++) {
    arcs.push({
      cx: randomRange(-WORLD_HALF, WORLD_HALF),
      cz: randomRange(-WORLD_HALF, WORLD_HALF),
      radius: randomRange(ARC_MIN_RADIUS, VALLEY_MAX_RADIUS),
      height: randomRange(VALLEY_MAX_DEPTH, VALLEY_MIN_DEPTH), // negative!
    });
  }

  // Underwater canyon arcs — carve deep trenches into the seabed
  // Placed in the ocean zone (outer ring of the world)
  const canyonCount = 60;
  for (let i = 0; i < canyonCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = WORLD_HALF * (0.55 + Math.random() * 0.35);
    arcs.push({
      cx: Math.cos(angle) * dist,
      cz: Math.sin(angle) * dist,
      radius: randomRange(40, 180),
      height: randomRange(-80, -25), // much deeper canyons
    });
  }

  return arcs;
}

/**
 * Sample terrain height at world coordinates (x, z) from raw arcs (slow, O(n)).
 */
function getTerrainHeightRaw(x, z, arcs) {
  let h = 0;
  for (const arc of arcs) {
    const dx = x - arc.cx;
    const dz = z - arc.cz;
    const distSq = dx * dx + dz * dz;
    const rSq = arc.radius * arc.radius;
    const contribution = 1 - distSq / rSq;
    if (contribution > 0) {
      h += arc.height * contribution;
    }
  }

  // Radial island falloff — terrain sinks below water at world edges
  const distFromCenter = Math.sqrt(x * x + z * z);
  const innerRadius = WORLD_HALF * 0.55;
  const outerRadius = WORLD_HALF * 0.9;
  if (distFromCenter > innerRadius) {
    const t = Math.min((distFromCenter - innerRadius) / (outerRadius - innerRadius), 1);
    const falloff = 1 - t * t; // smooth quadratic falloff
    h = h * falloff - (1 - falloff) * 30; // push below water at edges
  }

  return h;
}

/**
 * Build a cached heightmap grid for fast O(1) lookups.
 * @param {Array} arcs
 * @param {number} resolution - grid resolution (default 1024x1024)
 * @returns {{ get: (x, z) => number }}
 */
export function buildHeightmapCache(arcs, resolution = 512) {
  console.time('Heightmap cache');
  const data = new Float32Array(resolution * resolution);
  const cellSize = WORLD_SIZE / resolution;

  for (let iz = 0; iz < resolution; iz++) {
    const wz = -WORLD_HALF + (iz + 0.5) * cellSize;
    for (let ix = 0; ix < resolution; ix++) {
      const wx = -WORLD_HALF + (ix + 0.5) * cellSize;
      data[iz * resolution + ix] = getTerrainHeightRaw(wx, wz, arcs);
    }
  }
  console.timeEnd('Heightmap cache');

  // Bilinear interpolation lookup
  function get(x, z) {
    const fx = (x + WORLD_HALF) / cellSize - 0.5;
    const fz = (z + WORLD_HALF) / cellSize - 0.5;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;

    const ix0 = Math.max(0, Math.min(ix, resolution - 1));
    const ix1 = Math.max(0, Math.min(ix + 1, resolution - 1));
    const iz0 = Math.max(0, Math.min(iz, resolution - 1));
    const iz1 = Math.max(0, Math.min(iz + 1, resolution - 1));

    const h00 = data[iz0 * resolution + ix0];
    const h10 = data[iz0 * resolution + ix1];
    const h01 = data[iz1 * resolution + ix0];
    const h11 = data[iz1 * resolution + ix1];

    return (h00 * (1 - tx) + h10 * tx) * (1 - tz)
         + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  return { get, data, resolution };
}

/**
 * Sample terrain height at world coordinates (x, z).
 * Uses heightmap cache if available, falls back to raw arc calculation.
 */
let _heightCache = null;
export function setHeightCache(cache) { _heightCache = cache; }

export function getTerrainHeight(x, z, arcs) {
  if (_heightCache) return _heightCache.get(x, z);
  return getTerrainHeightRaw(x, z, arcs);
}

/**
 * Create a single terrain chunk mesh.
 * @param {number} chunkX - chunk index X (0..CHUNK_COUNT-1)
 * @param {number} chunkZ - chunk index Z (0..CHUNK_COUNT-1)
 * @param {Array} arcs - parabolic arcs
 * @param {THREE.Material} material - shared terrain material
 * @returns {THREE.Mesh}
 */
export function createTerrainChunk(chunkX, chunkZ, arcs, material) {
  const segsPerChunk = Math.floor(TERRAIN_SEGMENTS / CHUNK_COUNT);
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segsPerChunk, segsPerChunk);

  // Rotate to XZ plane
  geometry.rotateX(-Math.PI / 2);

  // World offset for this chunk
  const offsetX = -WORLD_HALF + chunkX * CHUNK_SIZE + CHUNK_SIZE / 2;
  const offsetZ = -WORLD_HALF + chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2;

  // Displace vertices
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const localX = pos.getX(i);
    const localZ = pos.getZ(i);
    const worldX = localX + offsetX;
    const worldZ = localZ + offsetZ;
    const height = getTerrainHeight(worldX, worldZ, arcs);
    pos.setY(i, height);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // Adjust UVs for seamless tiling across chunks
  const uv = geometry.attributes.uv;
  const tilesPerChunk = GRASS_TEXTURE_REPEAT / CHUNK_COUNT;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i); // 0..1 within chunk
    const v = uv.getY(i);
    uv.setXY(
      i,
      (chunkX + u) * tilesPerChunk,
      (chunkZ + v) * tilesPerChunk,
    );
  }
  uv.needsUpdate = true;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(offsetX, 0, offsetZ);

  // Store chunk coords for culling
  mesh.userData.chunkX = chunkX;
  mesh.userData.chunkZ = chunkZ;

  return mesh;
}

/**
 * Create all terrain chunks.
 * @returns {{ chunks: THREE.Mesh[], arcs: Array, group: THREE.Group }}
 */
/**
 * Save world data (arcs + heightmap) to localStorage for instant reload.
 */
function saveWorldCache(arcs, cacheData, resolution) {
  try {
    const arcsJson = JSON.stringify(arcs);
    // Convert Float32Array to base64
    const bytes = new Uint8Array(cacheData.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 4096) {
      binary += String.fromCharCode.apply(null, bytes.slice(i, i + 4096));
    }
    const b64 = btoa(binary);
    localStorage.setItem('world_arcs', arcsJson);
    localStorage.setItem('world_heightmap', b64);
    localStorage.setItem('world_resolution', String(resolution));
    localStorage.setItem('world_version', `${ARC_COUNT}_${WORLD_SIZE}_${ARC_MAX_RADIUS}_${ARC_MAX_HEIGHT}_v8`);
    console.log('World cached to localStorage');
  } catch (e) {
    console.warn('Could not cache world:', e.message);
  }
}

/**
 * Load world data from localStorage if parameters match.
 */
function loadWorldCache() {
  try {
    const version = `${ARC_COUNT}_${WORLD_SIZE}_${ARC_MAX_RADIUS}_${ARC_MAX_HEIGHT}_v8`;
    if (localStorage.getItem('world_version') !== version) return null;

    const arcsJson = localStorage.getItem('world_arcs');
    const b64 = localStorage.getItem('world_heightmap');
    const resolution = parseInt(localStorage.getItem('world_resolution'));
    if (!arcsJson || !b64 || !resolution) return null;

    console.time('Load cached world');
    const arcs = JSON.parse(arcsJson);

    // Decode base64 to Float32Array
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const data = new Float32Array(bytes.buffer);

    console.timeEnd('Load cached world');
    return { arcs, data, resolution };
  } catch (e) {
    console.warn('Cache load failed:', e.message);
    return null;
  }
}

export function createTerrain(material) {
  let arcs, cache;

  // Try loading from cache first
  const cached = loadWorldCache();
  if (cached) {
    console.log('Using cached world!');
    arcs = cached.arcs;
    // Rebuild cache object with bilinear lookup
    const res = cached.resolution;
    const data = cached.data;
    const cellSize = WORLD_SIZE / res;
    cache = {
      get(x, z) {
        const fx = (x + WORLD_HALF) / cellSize - 0.5;
        const fz = (z + WORLD_HALF) / cellSize - 0.5;
        const ix = Math.floor(fx);
        const iz = Math.floor(fz);
        const tx = fx - ix;
        const tz = fz - iz;
        const ix0 = Math.max(0, Math.min(ix, res - 1));
        const ix1 = Math.max(0, Math.min(ix + 1, res - 1));
        const iz0 = Math.max(0, Math.min(iz, res - 1));
        const iz1 = Math.max(0, Math.min(iz + 1, res - 1));
        const h00 = data[iz0 * res + ix0];
        const h10 = data[iz0 * res + ix1];
        const h01 = data[iz1 * res + ix0];
        const h11 = data[iz1 * res + ix1];
        return (h00 * (1 - tx) + h10 * tx) * (1 - tz)
             + (h01 * (1 - tx) + h11 * tx) * tz;
      },
      data, resolution: res,
    };
  } else {
    console.log('Generating new world...');
    arcs = generateArcs();
    cache = buildHeightmapCache(arcs);
    saveWorldCache(arcs, cache.data, cache.resolution);
  }

  setHeightCache(cache);

  const group = new THREE.Group();
  group.name = 'terrain';
  const chunks = [];

  console.time('Terrain chunks');
  for (let cx = 0; cx < CHUNK_COUNT; cx++) {
    for (let cz = 0; cz < CHUNK_COUNT; cz++) {
      const chunk = createTerrainChunk(cx, cz, arcs, material);
      group.add(chunk);
      chunks.push(chunk);
    }
  }
  console.timeEnd('Terrain chunks');

  return { chunks, arcs, group };
}
