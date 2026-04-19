import * as THREE from 'three';
import { getTerrainHeight } from './Terrain.js';
import { WATER_LEVEL } from '../constants.js';

/**
 * Build a biome-signature monument — one striking structure per world,
 * placed a few hundred meters in front of the spawn point so the player
 * sees it on arrival and can fly around or through it.
 */
export function createLandmark(biomeName, arcs) {
  const group = new THREE.Group();
  group.name = 'landmark';

  const x = 0, z = 350;
  const terrainY = getTerrainHeight(x, z, arcs);
  const baseY = Math.max(terrainY, WATER_LEVEL);

  switch (biomeName) {
    case 'Sunny Islands':  _buildLighthouse(group); break;
    case 'Golden Hour':    _buildTemple(group); break;
    case 'Arctic Dawn':    _buildIceberg(group); break;
    case 'Desert Noon':    _buildPyramid(group); break;
    case 'Stormy Dusk':    _buildRuins(group); break;
    case 'Night Sky':      _buildCrystal(group); break;
    default:               return null;
  }

  group.position.set(x, baseY, z);
  return group;
}

// --- Lighthouse — Sunny Islands ---
function _buildLighthouse(group) {
  const white = new THREE.MeshLambertMaterial({ color: 0xf8f8f0 });
  const red   = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
  const dark  = new THREE.MeshLambertMaterial({ color: 0x333333 });

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 55, 16), white);
  tower.position.y = 27.5;
  group.add(tower);

  // Three red stripes around the tower
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 8.8, 4.5, 16), red);
    stripe.position.y = 8 + i * 18;
    group.add(stripe);
  }

  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 7, 7, 16), dark);
  cabin.position.y = 59;
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 10, 12), dark);
  roof.position.y = 67;
  group.add(roof);

  // Bright lamp at the top
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xffff88, emissive: 0xffee44, emissiveIntensity: 1.8 })
  );
  lamp.position.y = 59;
  group.add(lamp);
}

// --- Ancient Temple — Golden Hour ---
function _buildTemple(group) {
  const stone = new THREE.MeshLambertMaterial({ color: 0xe5d0a0 });
  const column = new THREE.MeshLambertMaterial({ color: 0xeedfb0 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xaa5d3a });

  const base = new THREE.Mesh(new THREE.BoxGeometry(44, 6, 44), stone);
  base.position.y = 3;
  group.add(base);

  const platform = new THREE.Mesh(new THREE.BoxGeometry(38, 4, 38), column);
  platform.position.y = 8;
  group.add(platform);

  const colGeo = new THREE.CylinderGeometry(1.8, 1.8, 26, 12);
  const positions = [
    [-15, -15], [-5, -15], [5, -15], [15, -15],
    [-15, 15], [-5, 15], [5, 15], [15, 15],
    [-15, -5], [-15, 5], [15, -5], [15, 5],
  ];
  for (const [px, pz] of positions) {
    const col = new THREE.Mesh(colGeo, column);
    col.position.set(px, 23, pz);
    group.add(col);
  }

  const roof = new THREE.Mesh(new THREE.ConeGeometry(30, 14, 4), roofMat);
  roof.position.y = 43;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
}

// --- Iceberg — Arctic Dawn ---
function _buildIceberg(group) {
  const ice = new THREE.MeshStandardMaterial({
    color: 0xd8eef5, roughness: 0.35, metalness: 0.1,
    transparent: true, opacity: 0.92,
  });
  const darkIce = new THREE.MeshStandardMaterial({
    color: 0xa5c8d8, roughness: 0.4, metalness: 0.05,
  });

  const main = new THREE.Mesh(new THREE.ConeGeometry(28, 75, 6), ice);
  main.position.y = 37;
  group.add(main);

  for (let i = 0; i < 4; i++) {
    const r = 10 + Math.random() * 8;
    const h = 20 + Math.random() * 25;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), darkIce);
    const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
    peak.position.set(Math.cos(angle) * 22, h / 2, Math.sin(angle) * 22);
    peak.rotation.y = Math.random() * Math.PI;
    group.add(peak);
  }
}

// --- Pyramid — Desert Noon ---
function _buildPyramid(group) {
  const sand = new THREE.MeshLambertMaterial({ color: 0xd6a766 });
  const cap  = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });

  const pyramid = new THREE.Mesh(new THREE.ConeGeometry(48, 75, 4), sand);
  pyramid.position.y = 37.5;
  pyramid.rotation.y = Math.PI / 4;
  group.add(pyramid);

  const topCap = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 4), cap);
  topCap.position.y = 73;
  topCap.rotation.y = Math.PI / 4;
  group.add(topCap);
}

// --- Broken Ruins — Stormy Dusk ---
function _buildRuins(group) {
  const stoneColors = [0x3c4048, 0x4a4d53, 0x363a40];

  // Six weathered, broken columns at varying heights and tilts
  const columnGeos = [
    new THREE.CylinderGeometry(2, 2.5, 35, 10),
    new THREE.CylinderGeometry(2, 2.3, 22, 10),
    new THREE.CylinderGeometry(2, 2.4, 18, 10),
    new THREE.CylinderGeometry(2, 2.5, 40, 10),
    new THREE.CylinderGeometry(2, 2.3, 12, 10),
    new THREE.CylinderGeometry(2, 2.4, 28, 10),
  ];
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: stoneColors[i % 3] });
    const col = new THREE.Mesh(columnGeos[i], mat);
    const angle = (i / 6) * Math.PI * 2;
    const r = 14 + (i % 2) * 6;
    const h = columnGeos[i].parameters.height;
    col.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
    col.rotation.z = (Math.random() - 0.5) * 0.25;
    col.rotation.x = (Math.random() - 0.5) * 0.15;
    group.add(col);
  }

  const altar = new THREE.Mesh(
    new THREE.BoxGeometry(12, 4, 12),
    new THREE.MeshLambertMaterial({ color: 0x25272b })
  );
  altar.position.y = 2;
  group.add(altar);

  // Broken archway
  const archBase = new THREE.Mesh(
    new THREE.BoxGeometry(3, 25, 3),
    new THREE.MeshLambertMaterial({ color: 0x35383f })
  );
  archBase.position.set(-6, 12.5, 0);
  group.add(archBase);
  const archTop = new THREE.Mesh(
    new THREE.BoxGeometry(15, 3, 3),
    new THREE.MeshLambertMaterial({ color: 0x35383f })
  );
  archTop.position.set(-2, 25, 0);
  archTop.rotation.z = 0.2;
  group.add(archTop);
}

// --- Glowing Crystal — Night Sky ---
function _buildCrystal(group) {
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x5588ff, emissive: 0x3366dd, emissiveIntensity: 1.4,
    roughness: 0.15, metalness: 0.2,
    transparent: true, opacity: 0.85,
  });

  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(18), crystalMat);
  crystal.scale.y = 2.8;
  crystal.position.y = 45;
  group.add(crystal);

  // Small floating satellite shards
  for (let i = 0; i < 5; i++) {
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(3 + Math.random() * 2),
      crystalMat
    );
    const angle = (i / 5) * Math.PI * 2;
    shard.position.set(Math.cos(angle) * 22, 30 + Math.random() * 20, Math.sin(angle) * 22);
    shard.scale.y = 1.5;
    group.add(shard);
  }

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 22, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0x1a0f33 })
  );
  base.position.y = 4;
  group.add(base);

  // Point light brings the crystal to life in the dark biome
  const light = new THREE.PointLight(0x88aaff, 3.0, 250, 1.5);
  light.position.y = 45;
  group.add(light);
}
