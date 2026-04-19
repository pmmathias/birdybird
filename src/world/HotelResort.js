import * as THREE from 'three';
import { randomRange } from '../utils/math.js';
import { getTerrainHeight } from './Terrain.js';
import { WORLD_HALF, WATER_LEVEL } from '../constants.js';

/**
 * Hotel resort complex inspired by hotelSim Dream World Hotels.
 * Simplified for bird's-eye view but recognizable with pools, slides, palms.
 */

function makeBox(w, h, d, mat) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

function makeMat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

function createHotelBuilding(group, x, y, z, width, depth, floors) {
  const floorH = 4;
  const totalH = floors * floorH;

  // Main building
  const wallMat = makeMat(0xf0ead8);
  const bld = makeBox(width, totalH, depth, wallMat);
  bld.position.set(x, y + totalH / 2, z);
  group.add(bld);

  // Roof
  const roofMat = makeMat(0xcc8855);
  const roof = makeBox(width + 1, 0.5, depth + 1, roofMat);
  roof.position.set(x, y + totalH + 0.25, z);
  group.add(roof);

  // Windows (single stripe per facade instead of per-floor)
  const winMat = makeMat(0x4477aa);
  const winFront = makeBox(width * 0.85, totalH * 0.8, 0.2, winMat);
  winFront.position.set(x, y + totalH * 0.45, z - depth / 2 - 0.1);
  group.add(winFront);
  const winBack = winFront.clone();
  winBack.position.set(x, y + totalH * 0.45, z + depth / 2 + 0.1);
  group.add(winBack);

  // Sign
  const signMat = makeMat(0x1155aa, { emissive: 0x1155aa, emissiveIntensity: 0.3 });
  const sign = makeBox(width * 0.6, 2, 0.3, signMat);
  sign.position.set(x, y + totalH + 2, z - depth / 2 - 0.5);
  group.add(sign);
}

function createPool(group, x, y, z, w, d) {
  // Pool basin (blue recessed box)
  const poolMat = makeMat(0x2288cc, { transparent: true, opacity: 0.7 });
  const pool = makeBox(w, 1.5, d, poolMat);
  pool.position.set(x, y - 0.5, z);
  group.add(pool);

  // Pool edge (white rim)
  const edgeMat = makeMat(0xeeeeee);
  const edgeW = 0.5;
  const edges = [
    makeBox(w + edgeW * 2, 0.3, edgeW, edgeMat),   // front
    makeBox(w + edgeW * 2, 0.3, edgeW, edgeMat),   // back
    makeBox(edgeW, 0.3, d, edgeMat),                // left
    makeBox(edgeW, 0.3, d, edgeMat),                // right
  ];
  edges[0].position.set(x, y + 0.15, z - d / 2 - edgeW / 2);
  edges[1].position.set(x, y + 0.15, z + d / 2 + edgeW / 2);
  edges[2].position.set(x - w / 2 - edgeW / 2, y + 0.15, z);
  edges[3].position.set(x + w / 2 + edgeW / 2, y + 0.15, z);
  edges.forEach(e => group.add(e));
}

function createWaterSlide(group, x, y, z, height, color) {
  // Tower
  const towerMat = makeMat(0xdddddd);
  const tower = makeBox(3, height, 3, towerMat);
  tower.position.set(x, y + height / 2, z);
  group.add(tower);

  // Slide tube (curved cylinder approximation)
  const slideMat = makeMat(color);
  const slideGeo = new THREE.CylinderGeometry(0.8, 0.8, height * 1.3, 8);
  slideGeo.rotateZ(0.4); // tilt
  const slide = new THREE.Mesh(slideGeo, slideMat);
  slide.position.set(x + 3, y + height * 0.5, z);
  group.add(slide);
}

function createPalmTree(group, x, y, z, height = 8) {
  // Trunk
  const trunkMat = makeMat(0x8B6914);
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, height, 6);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, y + height / 2, z);
  group.add(trunk);

  // Crown (green sphere)
  const crownMat = makeMat(0x228B22);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(2.5, 6, 4), crownMat);
  crown.position.set(x, y + height + 1, z);
  crown.scale.set(1, 0.6, 1);
  group.add(crown);
}

/**
 * Create a full hotel resort complex.
 * @returns {THREE.Group}
 */
function createResort(groundY) {
  const g = new THREE.Group();
  const y = groundY;

  // Main hotel (8 floors — tall and visible from air)
  createHotelBuilding(g, 0, y, -15, 80, 25, 8);

  // Annex building (5 floors)
  createHotelBuilding(g, 55, y, -15, 40, 18, 5);

  // Second annex
  createHotelBuilding(g, -50, y, -10, 35, 15, 4);

  // Pools
  createPool(g, -5, y, 20, 30, 15);
  createPool(g, 30, y, 25, 12, 8);

  // Water slides
  createWaterSlide(g, 15, y, 40, 12, 0x2288ff);
  createWaterSlide(g, -20, y, 38, 9, 0xff4444);
  createWaterSlide(g, -35, y, 35, 6, 0x44dd88);

  // Palm trees around pool (fewer for performance)
  for (let i = 0; i < 6; i++) {
    const px = randomRange(-40, 50);
    const pz = randomRange(10, 50);
    createPalmTree(g, px, y, pz, 6 + Math.random() * 5);
  }

  // Loungers (fewer for performance)
  const loungerMat = makeMat(0xeeeecc);
  for (let i = 0; i < 8; i++) {
    const l = makeBox(0.8, 0.3, 2, loungerMat);
    l.position.set(randomRange(-30, 40), y + 0.15, randomRange(35, 48));
    l.rotation.y = Math.random() * 0.3;
    g.add(l);
  }

  return g;
}

/**
 * Place hotel resorts near beaches on the island.
 * @param {Array} arcs - terrain arcs
 * @returns {THREE.Group}
 */
export function createHotelResorts(arcs) {
  const group = new THREE.Group();
  group.name = 'hotel-resorts';

  // Find good beach locations: near water, flat, facing ocean
  const resortCount = 15;
  const placed = [];

  for (let attempts = 0; attempts < 500 && placed.length < resortCount; attempts++) {
    const angle = Math.random() * Math.PI * 2;
    // Place across island — coast and inland valleys
    const dist = WORLD_HALF * (0.15 + Math.random() * 0.45);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const h = getTerrainHeight(x, z, arcs);

    // Must be on land, not too high (flat areas)
    if (h < WATER_LEVEL + 2 || h > WATER_LEVEL + 40) continue;

    // Check slope
    const h2 = getTerrainHeight(x + 5, z, arcs);
    const h3 = getTerrainHeight(x, z + 5, arcs);
    const slope = Math.sqrt(((h2 - h) / 5) ** 2 + ((h3 - h) / 5) ** 2);
    if (slope > 0.15) continue;

    // Check distance to other resorts
    let tooClose = false;
    for (const p of placed) {
      if (Math.sqrt((x - p.x) ** 2 + (z - p.z) ** 2) < 100) { tooClose = true; break; }
    }
    if (tooClose) continue;

    // Place resort facing ocean (rotated so pools face water)
    const resort = createResort(h);
    resort.position.set(x, 0, z);
    resort.rotation.y = angle + Math.PI; // face toward ocean
    group.add(resort);
    placed.push({ x, z });
  }

  console.log(`Hotel resorts placed: ${placed.length}`);
  return group;
}
