import * as THREE from 'three';
import { Pickup } from './Pickup.js';
import { RingBurst } from './RingBurst.js';
import { getTerrainHeight } from '../world/Terrain.js';
import { WATER_LEVEL } from '../constants.js';

/**
 * Sparser-than-Ring-Rush mixed-pickup spawner used by Nest Quest. Drops
 * clocks (+30 s timer) and speed-boost arrows (30 s of 2× speed) at
 * random points within a radius around the bird, respawns the whole
 * batch when fully cleared.
 */

const PICKUP_COUNT   = 26;    // 13 clocks + 13 speed arrows per batch
const COLLECT_RADIUS = 8;
const SPAWN_RADIUS   = 800;
const MIN_HEIGHT     = 18;
const MAX_HEIGHT     = 95;

export class PickupSpawner {
  constructor(scene, world, flightState) {
    this.scene = scene;
    this.world = world;
    this.flightState = flightState;
    this.pickups = [];
    this.bursts = [];
    this._elapsedT = 0;

    /** Set by main.js — fired on each pickup. */
    this.onClockPickup = null;
    this.onSpeedPickup = null;

    this._spawn();
  }

  _spawn() {
    // Build a balanced type list (half clocks, half speed arrows) and
    // Fisher-Yates shuffle it so the first few rings the player flies
    // past are still random — but the global count stays exactly 1:1.
    const halfCount = Math.floor(PICKUP_COUNT / 2);
    const types = [
      ...Array(halfCount).fill('clock'),
      ...Array(PICKUP_COUNT - halfCount).fill('speed'),
    ];
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }

    const origin = this.flightState.position.clone();
    for (let i = 0; i < PICKUP_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = SPAWN_RADIUS * (0.2 + Math.random() * 0.8);
      const x = origin.x + Math.cos(angle) * dist;
      const z = origin.z + Math.sin(angle) * dist;
      const terrainY = getTerrainHeight(x, z, this.world.arcs);
      const floor = Math.max(terrainY, WATER_LEVEL);
      const y = floor + MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT);

      const p = new Pickup(types[i], new THREE.Vector3(x, y, z));
      this.scene.add(p.mesh);
      this.pickups.push(p);
    }
  }

  update(dt) {
    this._elapsedT += dt;

    for (const p of this.pickups) p.update(dt, this._elapsedT);

    const birdPos = this.flightState.position;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (birdPos.distanceTo(p.mesh.position) < COLLECT_RADIUS) {
        const burstColor = p.type === 'clock' ? 0xffe060 : 0x60d4ff;
        this.bursts.push(new RingBurst(this.scene, p.mesh.position.clone(), burstColor));
        if (p.type === 'clock' && this.onClockPickup) this.onClockPickup();
        if (p.type === 'speed' && this.onSpeedPickup) this.onSpeedPickup();
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      if (!this.bursts[i].update(dt)) {
        this.bursts[i].dispose();
        this.bursts.splice(i, 1);
      }
    }

    if (this.pickups.length === 0) this._spawn();
  }
}
