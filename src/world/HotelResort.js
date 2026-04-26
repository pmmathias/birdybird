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

// Per-resort palettes — wall + roof + accent sign colour. Picked once per
// resort so all its buildings share a coherent style.
const PALETTES = [
  { wall: 0xf0ead8, roof: 0xcc8855, sign: 0x1155aa, rotation: 'sandy' },     // sand + brick
  { wall: 0xfaf6f0, roof: 0x336699, sign: 0xff6622, rotation: 'greek' },     // white + santorini blue
  { wall: 0xe8d4a8, roof: 0x884422, sign: 0x44aa44, rotation: 'spanish' },   // tan + tile red
  { wall: 0xffeedd, roof: 0xaa5533, sign: 0x88bb44, rotation: 'pink' },      // pink + terra cotta
  { wall: 0xddccaa, roof: 0x553322, sign: 0xff8844, rotation: 'colonial' },  // dune + dark wood
];

function createHotelBuilding(group, x, y, z, width, depth, floors, palette) {
  const floorH = 4;
  const totalH = floors * floorH;

  const wallMat = makeMat(palette.wall);
  const bld = makeBox(width, totalH, depth, wallMat);
  bld.position.set(x, y + totalH / 2, z);
  group.add(bld);

  const roofMat = makeMat(palette.roof);
  const roof = makeBox(width + 1, 0.5, depth + 1, roofMat);
  roof.position.set(x, y + totalH + 0.25, z);
  group.add(roof);

  const winMat = makeMat(0x4477aa);
  const winFront = makeBox(width * 0.85, totalH * 0.8, 0.2, winMat);
  winFront.position.set(x, y + totalH * 0.45, z - depth / 2 - 0.1);
  group.add(winFront);
  const winBack = winFront.clone();
  winBack.position.set(x, y + totalH * 0.45, z + depth / 2 + 0.1);
  group.add(winBack);

  const signMat = makeMat(palette.sign, { emissive: palette.sign, emissiveIntensity: 0.3 });
  const sign = makeBox(width * 0.6, 2, 0.3, signMat);
  sign.position.set(x, y + totalH + 2, z - depth / 2 - 0.5);
  group.add(sign);
}

/** Cylindrical tower hotel with conical roof. */
function createTowerHotel(group, x, y, z, radius, height, palette) {
  const wallMat = makeMat(palette.wall);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.05, height, 14),
    wallMat,
  );
  tower.position.set(x, y + height / 2, z);
  group.add(tower);

  // Conical roof
  const roofMat = makeMat(palette.roof);
  const roofH = Math.max(3, radius * 0.7);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 1.1, roofH, 14),
    roofMat,
  );
  roof.position.set(x, y + height + roofH / 2, z);
  group.add(roof);

  // Two horizontal window bands
  const winMat = makeMat(0x4477aa);
  for (const t of [0.35, 0.7]) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.08, radius + 0.08, height * 0.12, 14),
      winMat,
    );
    band.position.set(x, y + height * t, z);
    group.add(band);
  }

  // Top sign / antenna
  const signMat = makeMat(palette.sign, { emissive: palette.sign, emissiveIntensity: 0.3 });
  const antenna = makeBox(0.4, 4, 0.4, signMat);
  antenna.position.set(x, y + height + roofH + 2, z);
  group.add(antenna);
}

/** Stepped/terraced hotel — each level smaller than the one below
 *  (Mediterranean / Mexican resort look). */
function createTerracedHotel(group, x, y, z, baseW, baseD, levels, palette) {
  const wallMat = makeMat(palette.wall);
  const roofMat = makeMat(palette.roof);
  const floorH = 3.5;

  for (let i = 0; i < levels; i++) {
    const shrink = 1 - i * 0.18;
    const w = baseW * shrink;
    const d = baseD * shrink;
    // Stagger the level toward the back so the front is a stepped face
    const zOffset = (i * baseD * 0.1);
    const yBase = y + i * floorH;
    const box = makeBox(w, floorH, d, wallMat);
    box.position.set(x, yBase + floorH / 2, z + zOffset);
    group.add(box);
    // Each step gets a thin roof slab so the silhouette is crisp
    const roofSlab = makeBox(w + 0.4, 0.25, d + 0.4, roofMat);
    roofSlab.position.set(x, yBase + floorH + 0.125, z + zOffset);
    group.add(roofSlab);
  }

  // Sign on the front (lowest, widest level)
  const signMat = makeMat(palette.sign, { emissive: palette.sign, emissiveIntensity: 0.3 });
  const sign = makeBox(baseW * 0.5, 1.6, 0.3, signMat);
  sign.position.set(x, y + floorH + 1, z - baseD / 2 - 0.2);
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

// Curved, tapered frond built from a plane: wide at base, pointy at tip,
// drooping in -Y. Lives in local frame with base at origin, +X pointing
// outward from the trunk.
function createPalmFrondGeometry(length, baseWidth, droopFactor) {
  const geo = new THREE.PlaneGeometry(length, baseWidth, 14, 2);
  geo.rotateX(-Math.PI / 2);     // plane into XZ, width in Z, normal +Y
  geo.translate(length / 2, 0, 0); // base at x=0, tip at x=length
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = Math.max(0, Math.min(1, x / length));
    // Taper width: narrow at the base (petiole), broad middle, pointy tip —
    // gives a classic palm leaflet silhouette.
    const taper = Math.sin(Math.pow(t, 0.85) * Math.PI); // 0 at base, 0 at tip, ~1 mid
    const widthScale = 0.2 + taper * 0.9;
    pos.setZ(i, pos.getZ(i) * widthScale);
    // Droop: cubic so base stays flat, tip curves down
    const droop = -Math.pow(t, 1.9) * length * droopFactor;
    pos.setY(i, pos.getY(i) + droop);
    // Subtle leaflet ripple for feathered look
    const feather = Math.sin(t * Math.PI * 9) * baseWidth * 0.07 * (1 - t * 0.4);
    pos.setY(i, pos.getY(i) + feather);
  }
  geo.computeVertexNormals();
  return geo;
}

function createPalmTree(group, x, y, z, height = 8) {
  // Scale trunk + crown with height so a 20m palm doesn't have a 0.3m trunk
  // (which looked like a pencil next to 15m forest trees).
  const scale = height / 8;

  // Per-palm color jitter so a cluster doesn't look like clones.
  // Lumine values are bumped so palms read as bright tropical green even
  // when the sun is low.
  const frondColor = new THREE.Color().setHSL(
    0.27 + Math.random() * 0.05,
    0.55 + Math.random() * 0.2,
    0.38 + Math.random() * 0.1,
  );
  const trunkColor = new THREE.Color().setHSL(
    0.08 + Math.random() * 0.02,
    0.35 + Math.random() * 0.15,
    0.32 + Math.random() * 0.08,
  );

  // Trunk — 10 sides (smoother silhouette), tapered, gently curved
  const trunkMat = new THREE.MeshLambertMaterial({ color: trunkColor });
  const trunkGeo = new THREE.CylinderGeometry(0.16 * scale, 0.34 * scale, height, 10, 8);
  const bendDir = Math.random() * Math.PI * 2;
  const bendAmt = (0.04 + Math.random() * 0.05) * scale;
  const tp = trunkGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const ty = tp.getY(i);
    const t = (ty + height / 2) / height; // 0 bottom, 1 top
    const offset = t * t * bendAmt * height;
    tp.setX(i, tp.getX(i) + Math.cos(bendDir) * offset);
    tp.setZ(i, tp.getZ(i) + Math.sin(bendDir) * offset);
    // Gentle ring pattern (scale-like bulging)
    const ring = Math.sin(ty * 3.5) * 0.012 * scale;
    const rx = tp.getX(i) - Math.cos(bendDir) * offset;
    const rz = tp.getZ(i) - Math.sin(bendDir) * offset;
    const rlen = Math.hypot(rx, rz) || 1;
    tp.setX(i, tp.getX(i) + (rx / rlen) * ring);
    tp.setZ(i, tp.getZ(i) + (rz / rlen) * ring);
  }
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, y + height / 2, z);
  group.add(trunk);

  // Crown apex — shifted by the trunk bend
  const crownX = x + Math.cos(bendDir) * bendAmt * height;
  const crownZ = z + Math.sin(bendDir) * bendAmt * height;
  const crownY = y + height;

  // Fronds — curved, drooping leaves (9 per palm)
  const frondMat = new THREE.MeshLambertMaterial({
    color: frondColor,
    side: THREE.DoubleSide,
  });
  const frondCount = 9;
  const frondLen = 4.0 * scale;
  const frondWidth = 1.15 * scale;
  const droopFactor = 0.42 + Math.random() * 0.15;
  const baseFrondGeo = createPalmFrondGeometry(frondLen, frondWidth, droopFactor);

  for (let i = 0; i < frondCount; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(crownX, crownY, crownZ);
    pivot.rotation.y = (i / frondCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    // Lift base before letting the droop take over
    pivot.rotation.z = 0.22 + Math.random() * 0.15;
    const frond = new THREE.Mesh(baseFrondGeo, frondMat);
    // Subtle per-frond roll and length variation
    frond.rotation.x = (Math.random() - 0.5) * 0.35;
    const lenJit = 0.85 + Math.random() * 0.3;
    frond.scale.set(lenJit, lenJit * 0.95, lenJit);
    pivot.add(frond);
    group.add(pivot);
  }

  // Brown sheath hiding the frond bases
  const hubMat = new THREE.MeshLambertMaterial({ color: 0x4a3518 });
  const hub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38 * scale, 0), hubMat);
  hub.position.set(crownX, crownY - 0.05 * scale, crownZ);
  group.add(hub);

  // Coconut cluster for larger palms
  if (scale > 1.3 && Math.random() < 0.7) {
    const coconutMat = new THREE.MeshLambertMaterial({ color: 0x3a2210 });
    const coconutCount = 3 + Math.floor(Math.random() * 3);
    const clusterAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < coconutCount; i++) {
      const a = clusterAngle + (i - coconutCount / 2) * 0.5;
      const r = 0.3 * scale;
      const c = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.17 * scale, 0),
        coconutMat,
      );
      c.position.set(
        crownX + Math.cos(a) * r,
        crownY - 0.25 * scale,
        crownZ + Math.sin(a) * r,
      );
      group.add(c);
    }
  }
}

/**
 * Create a full hotel resort complex.
 * @returns {THREE.Group}
 */
const RESORT_STYLES = ['classic', 'lshape', 'tower', 'terraced'];

function createResort(groundY) {
  const g = new THREE.Group();
  const y = groundY;
  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const style = RESORT_STYLES[Math.floor(Math.random() * RESORT_STYLES.length)];

  switch (style) {
    case 'classic':
      // Three rectangular boxes — the original silhouette.
      createHotelBuilding(g, 0, y, -15, 80, 25, 8, palette);
      createHotelBuilding(g, 55, y, -15, 40, 18, 5, palette);
      createHotelBuilding(g, -50, y, -10, 35, 15, 4, palette);
      break;

    case 'lshape':
      // Two long wings meeting in an L, plus a small annex out front.
      createHotelBuilding(g, -10, y, -18, 60, 22, 7, palette);
      createHotelBuilding(g, 32, y, 8, 22, 38, 7, palette);
      createHotelBuilding(g, -45, y, 5, 22, 14, 3, palette);
      break;

    case 'tower':
      // One round tower flanked by two low blocks — the iconic
      // "Las Vegas / Dubai marina" silhouette.
      createTowerHotel(g, 0, y, -12, 16, 38, palette);
      createHotelBuilding(g, -42, y, -5, 32, 18, 4, palette);
      createHotelBuilding(g, 42, y, -5, 32, 18, 4, palette);
      break;

    case 'terraced':
      // Stepped pyramid main building, plus one small annex.
      createTerracedHotel(g, 0, y, -10, 70, 36, 6, palette);
      createHotelBuilding(g, -50, y, 0, 28, 14, 3, palette);
      break;
  }

  // Pools — count + position varies a bit per resort
  const poolLayouts = [
    [{ x: -5, z: 20, w: 30, d: 15 }, { x: 30, z: 25, w: 12, d: 8 }],
    [{ x: 0, z: 22, w: 36, d: 18 }],
    [{ x: -15, z: 22, w: 22, d: 12 }, { x: 22, z: 18, w: 18, d: 10 }, { x: 35, z: 35, w: 10, d: 8 }],
  ];
  const pools = poolLayouts[Math.floor(Math.random() * poolLayouts.length)];
  for (const p of pools) createPool(g, p.x, y, p.z, p.w, p.d);

  // Palms (around pools) — quantity + heights vary
  const palmCount = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < palmCount; i++) {
    const px = randomRange(-45, 50);
    const pz = randomRange(8, 50);
    createPalmTree(g, px, y, pz, 14 + Math.random() * 9);
  }

  // Loungers — placed near the largest pool
  const loungerMat = makeMat(0xeeeecc);
  const loungerCount = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < loungerCount; i++) {
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
