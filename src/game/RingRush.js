import * as THREE from 'three';
import { Ring } from './Ring.js';
import { RingBurst } from './RingBurst.js';
import { getTerrainHeight } from '../world/Terrain.js';
import {
  WATER_LEVEL,
  RING_COUNT, RING_COLLECT_RADIUS,
  RING_RUSH_START_SECONDS, RING_BONUS_SECONDS,
  RING_SPAWN_RADIUS, RING_MIN_HEIGHT, RING_MAX_HEIGHT,
  RINGS_PER_LEVEL,
} from '../constants.js';

const HIGHSCORE_KEY = 'birdybird.ringrush.highscore';

export class RingRush {
  constructor(scene, world, flightState, options = {}) {
    this.scene = scene;
    this.world = world;
    this.flightState = flightState;

    // Debug overrides
    this._ringsPerLevel = options.ringsPerLevel || RINGS_PER_LEVEL;

    this.rings = [];
    this.bursts = [];
    this.timer = RING_RUSH_START_SECONDS;
    this.score = 0;
    this.level = options.startLevel || 1;
    this.ringsThisLevel = 0;
    this.highscore = parseInt(localStorage.getItem(HIGHSCORE_KEY), 10) || 0;
    this.gameOver = false;
    this._started = false;
    this._elapsedT = 0;
    this._gracePeriod = 0;

    // External-hook callbacks (set by main.js after construction)
    this.onRingCollected = null;   // fired on every collect — used e.g. to trigger flock
    this.onLevelUp = null;         // fired when ringsThisLevel hits RINGS_PER_LEVEL

    this._spawnRings();
  }

  /** Begin the timer + collision loop (call after calibration wizard finishes). */
  start() {
    if (this._started) return;
    this._started = true;
    this._gracePeriod = 2.5;
  }

  /** Has the game actually started? (HUD uses this to hide before start.) */
  get started() {
    return this._started;
  }

  _spawnRings() {
    const origin = this.flightState.position.clone();
    for (let i = 0; i < RING_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = RING_SPAWN_RADIUS * (0.15 + Math.random() * 0.85);
      const x = origin.x + Math.cos(angle) * dist;
      const z = origin.z + Math.sin(angle) * dist;
      const terrainY = getTerrainHeight(x, z, this.world.arcs);
      const floor = Math.max(terrainY, WATER_LEVEL);
      const y = floor + RING_MIN_HEIGHT + Math.random() * (RING_MAX_HEIGHT - RING_MIN_HEIGHT);
      const ring = new Ring(new THREE.Vector3(x, y, z));
      this.scene.add(ring.mesh);
      this.rings.push(ring);
    }
  }

  _clearRings() {
    for (const ring of this.rings) this.scene.remove(ring.mesh);
    this.rings.length = 0;
  }

  update(dt) {
    if (this.gameOver) return;

    this._elapsedT += dt;

    // Always animate rings so they look alive during menus/calibration
    for (const ring of this.rings) {
      ring.update(dt, this._elapsedT);
    }

    // Timer + collision only after start() has been called
    if (!this._started) return;

    if (this._gracePeriod > 0) {
      this._gracePeriod -= dt;
    } else {
      this.timer -= dt;
    }

    const birdPos = this.flightState.position;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      if (birdPos.distanceTo(ring.mesh.position) < RING_COLLECT_RADIUS) {
        // Spawn sparkle burst at the ring's position before removing
        this.bursts.push(new RingBurst(this.scene, ring.mesh.position));
        this._onRingCollected();
        this.scene.remove(ring.mesh);
        this.rings.splice(i, 1);
      }
    }

    // Advance & cull bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      if (!this.bursts[i].update(dt)) {
        this.bursts[i].dispose();
        this.bursts.splice(i, 1);
      }
    }

    if (this.rings.length === 0) this._spawnRings();

    if (this.timer <= 0) {
      this.timer = 0;
      this._onGameOver();
    }
  }

  _onRingCollected() {
    this.score++;
    this.ringsThisLevel++;
    // Reset timer fully to start — every ring buys you a fresh 100 seconds.
    this.timer = RING_RUSH_START_SECONDS;
    if (navigator.vibrate) navigator.vibrate(25);
    if (this.onRingCollected) this.onRingCollected();

    // Level-up check
    if (this.ringsThisLevel >= this._ringsPerLevel) {
      this.level++;
      this.ringsThisLevel = 0;
      if (this.onLevelUp) this.onLevelUp(this.level);
    }
  }

  _onGameOver() {
    this.gameOver = true;
    if (this.score > this.highscore) {
      this.highscore = this.score;
      localStorage.setItem(HIGHSCORE_KEY, String(this.highscore));
    }
  }

  restart() {
    this._clearRings();
    this.timer = RING_RUSH_START_SECONDS;
    this.score = 0;
    this.level = 1;
    this.ringsThisLevel = 0;
    this.gameOver = false;
    this._elapsedT = 0;
    this._gracePeriod = 2.5;
    this._started = true;
    this._spawnRings();
  }
}
