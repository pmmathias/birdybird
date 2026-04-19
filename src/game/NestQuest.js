import * as THREE from 'three';
import { Nest } from './Nest.js';
import { StickTree } from './StickTree.js';
import { Worm } from './Worm.js';
import { RingBurst } from './RingBurst.js';
import { getTerrainHeight } from '../world/Terrain.js';
import {
  WATER_LEVEL, WORLD_HALF,
  NEST_QUEST_START_SECONDS, NEST_WIN_DISTANCE,
  STICK_TREE_COUNT, STICK_COLLECT_RADIUS, STICKS_REQUIRED,
  WORM_COUNT, WORM_COLLECT_RADIUS, WORM_MAX_ALTITUDE_DIFF, WORMS_REQUIRED,
} from '../constants.js';

const HIGHSCORE_KEY = 'birdybird.nestquest.highscore';

/**
 * The core gameplay loop: find a stick + a worm + fly back to the nest.
 * Score = remaining seconds + ring-bonus-count (rings collected on the side).
 */
export class NestQuest {
  constructor(scene, world, flightState) {
    this.scene = scene;
    this.world = world;
    this.flightState = flightState;

    this.timer = NEST_QUEST_START_SECONDS;
    this.sticks = 0;
    this.worms = 0;
    this.rings = 0;                        // optional side score
    this.questComplete = false;            // all required items gathered
    this.won = false;                      // returned to nest after complete
    this.gameOver = false;                 // timer ran out or win
    this.finalScore = 0;
    this.highscore = parseInt(localStorage.getItem(HIGHSCORE_KEY), 10) || 0;

    this._started = false;
    this._elapsedT = 0;
    this._gracePeriod = 0;

    this.bursts = [];

    // Callbacks wired from main.js
    this.onStickCollected = null;
    this.onWormCollected = null;
    this.onQuestComplete = null;
    this.onWin = null;
    this.onGameOver = null;

    // Nest at spawn position
    const nestPos = flightState.position.clone();
    nestPos.y = Math.max(getTerrainHeight(nestPos.x, nestPos.z, world.arcs), WATER_LEVEL);
    this.nest = new Nest(scene, nestPos);

    // Track whether the bird has left the nest — so re-entering counts
    this._leftNest = false;

    this._spawnStickTrees();
    this._spawnWorms();
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._gracePeriod = 2.0;
  }

  get started() { return this._started; }

  _spawnStickTrees() {
    this.stickTrees = [];
    const placed = [];
    const maxR = WORLD_HALF * 0.6;
    const minR = 250;
    const minDist = 120; // min distance between trees to avoid clumping

    let attempts = 0;
    while (this.stickTrees.length < STICK_TREE_COUNT && attempts < 500) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      // Not over water, not too close to siblings
      const groundY = getTerrainHeight(x, z, this.world.arcs);
      if (groundY < WATER_LEVEL + 3) continue;
      let tooClose = false;
      for (const p of placed) {
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < minDist ** 2) { tooClose = true; break; }
      }
      if (tooClose) continue;

      const pos = new THREE.Vector3(x, groundY, z);
      this.stickTrees.push(new StickTree(this.scene, pos));
      placed.push({ x, z });
    }
  }

  _spawnWorms() {
    this.worms_list = [];
    const maxR = WORLD_HALF * 0.55;
    const minR = 180;

    let attempts = 0;
    while (this.worms_list.length < WORM_COUNT && attempts < 500) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const groundY = getTerrainHeight(x, z, this.world.arcs);
      if (groundY < WATER_LEVEL + 1) continue; // no worms in water

      const pos = new THREE.Vector3(x, groundY, z);
      this.worms_list.push(new Worm(this.scene, pos));
    }
  }

  /** External hook: Ring Rush collects a ring → counts as side-score. */
  registerRingPickup() {
    this.rings++;
  }

  update(dt) {
    if (this.gameOver) return;

    this._elapsedT += dt;
    this.nest.update(dt, this._elapsedT);

    for (const t of this.stickTrees) t.update(dt, this._elapsedT);
    for (const w of this.worms_list) w.update(dt, this._elapsedT);

    // Bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      if (!this.bursts[i].update(dt)) {
        this.bursts[i].dispose();
        this.bursts.splice(i, 1);
      }
    }

    if (!this._started) return;

    if (this._gracePeriod > 0) {
      this._gracePeriod -= dt;
    } else {
      this.timer -= dt;
    }

    const birdPos = this.flightState.position;

    // Leaving the nest unlocks the return condition
    const distFromNest = birdPos.distanceTo(this.nest.position);
    if (!this._leftNest && distFromNest > NEST_WIN_DISTANCE * 2) {
      this._leftNest = true;
    }

    // Stick pickup
    if (this.sticks < STICKS_REQUIRED) {
      for (const tree of this.stickTrees) {
        if (tree.harvested) continue;
        if (birdPos.distanceTo(tree.position.clone().setY(tree.position.y + 12)) < STICK_COLLECT_RADIUS + 8) {
          tree.harvest();
          this.sticks++;
          this.bursts.push(new RingBurst(this.scene, tree.position.clone().setY(tree.position.y + 12), 0xff6633));
          if (navigator.vibrate) navigator.vibrate(35);
          if (this.onStickCollected) this.onStickCollected();
          if (this.sticks >= STICKS_REQUIRED && this.worms >= WORMS_REQUIRED) this._onQuestComplete();
        }
      }
    }

    // Worm pickup — only when flying low enough
    if (this.worms < WORMS_REQUIRED) {
      for (let i = this.worms_list.length - 1; i >= 0; i--) {
        const worm = this.worms_list[i];
        if (worm.collected) continue;
        const horizDist = Math.hypot(birdPos.x - worm.position.x, birdPos.z - worm.position.z);
        const vertDist = Math.abs(birdPos.y - worm.position.y);
        if (horizDist < WORM_COLLECT_RADIUS && vertDist < WORM_MAX_ALTITUDE_DIFF) {
          worm.collected = true;
          this.scene.remove(worm.group);
          this.bursts.push(new RingBurst(this.scene, worm.position.clone().setY(worm.position.y + 2), 0xff66aa));
          this.worms++;
          if (navigator.vibrate) navigator.vibrate(35);
          if (this.onWormCollected) this.onWormCollected();
          if (this.sticks >= STICKS_REQUIRED && this.worms >= WORMS_REQUIRED) this._onQuestComplete();
        }
      }
    }

    // Win condition: quest complete + back at nest + has left nest first
    if (this.questComplete && !this.won && this._leftNest && distFromNest < NEST_WIN_DISTANCE) {
      this._onWin();
    }

    // Loss: timer hits 0
    if (this.timer <= 0 && !this.won) {
      this.timer = 0;
      this._onGameOver(false);
    }
  }

  _onQuestComplete() {
    this.questComplete = true;
    if (navigator.vibrate) navigator.vibrate([60, 80, 60, 80, 120]);
    if (this.onQuestComplete) this.onQuestComplete();
  }

  _onWin() {
    this.won = true;
    const remaining = Math.ceil(this.timer);
    this.finalScore = remaining + this.rings * 10;
    if (this.finalScore > this.highscore) {
      this.highscore = this.finalScore;
      localStorage.setItem(HIGHSCORE_KEY, String(this.highscore));
    }
    this._onGameOver(true);
  }

  _onGameOver(won) {
    this.gameOver = true;
    if (navigator.vibrate) navigator.vibrate(won ? [50, 50, 50, 50, 200] : [100]);
    if (this.onGameOver) this.onGameOver(won);
  }

  restart() {
    // Clear worms still in scene
    for (const w of this.worms_list) w.dispose();
    // Dispose stick trees
    for (const t of this.stickTrees) t.dispose();
    // Dispose bursts
    for (const b of this.bursts) b.dispose();
    this.bursts = [];

    this.timer = NEST_QUEST_START_SECONDS;
    this.sticks = 0;
    this.worms = 0;
    this.rings = 0;
    this.questComplete = false;
    this.won = false;
    this.gameOver = false;
    this.finalScore = 0;
    this._started = true;
    this._gracePeriod = 2.0;
    this._leftNest = false;
    this._elapsedT = 0;

    this._spawnStickTrees();
    this._spawnWorms();
  }
}
