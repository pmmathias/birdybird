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
  constructor(scene, world, flightState, options = {}) {
    this.scene = scene;
    this.world = world;
    this.flightState = flightState;

    this.level = options.startLevel || 1;
    this.sticksRequired = STICKS_REQUIRED + (this.level - 1);
    this.wormsRequired = WORMS_REQUIRED + (this.level - 1);

    this.timer = NEST_QUEST_START_SECONDS;
    this.sticks = 0;
    this.worms = 0;
    this.rings = 0;                        // optional side score
    this.questComplete = false;            // all required items gathered
    this.won = false;                      // returned to nest after complete
    this.gameOver = false;                 // timer ran out or win
    this.finalScore = 0;
    // accumulates across levels in a run; restorable across the
    // level→reload boundary via `startTotalScore` option
    this.totalScore = options.startTotalScore || 0;
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
    this.onChirp = null; // fired occasionally when player is within earshot of the nest
    this.onLevelUp = null; // fired when a new level starts (level number)

    this._chirpCooldown = 4; // first chirp ~4s after start

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

  /** Stratified angular sampling — divides 2π into `count` sectors and
   *  picks one position per sector (with jitter). Guarantees worms +
   *  trees spread evenly around the player rather than clumping in
   *  one half of the map. Skips spawn if it lands in water; up to
   *  6 retries within the same sector before giving up on it. */
  _stratifiedSpawn(count, minR, maxR, minLandHeight) {
    const placed = [];
    const sectorAngle = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const sectorBase = i * sectorAngle;
      let pos = null;
      for (let tries = 0; tries < 6; tries++) {
        const angle = sectorBase + Math.random() * sectorAngle;
        const r = minR + Math.random() * (maxR - minR);
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const groundY = getTerrainHeight(x, z, this.world.arcs);
        if (groundY < WATER_LEVEL + minLandHeight) continue;
        pos = new THREE.Vector3(x, groundY, z);
        break;
      }
      if (pos) placed.push(pos);
    }
    return placed;
  }

  _spawnStickTrees() {
    this.stickTrees = [];
    const positions = this._stratifiedSpawn(
      STICK_TREE_COUNT,
      250, WORLD_HALF * 0.6, 3,
    );
    for (const pos of positions) {
      this.stickTrees.push(new StickTree(this.scene, pos));
    }
  }

  _spawnWorms() {
    this.worms_list = [];
    const positions = this._stratifiedSpawn(
      WORM_COUNT,
      180, WORLD_HALF * 0.55, 1,
    );
    for (const pos of positions) {
      this.worms_list.push(new Worm(this.scene, pos));
    }
  }

  /** External hook: a clock pickup → +30 s on the timer. */
  registerClockPickup() {
    this.rings++;
    this.timer += 30;
    if (this.onRingRecharge) this.onRingRecharge(30);
  }

  /** External hook: a speed-arrow pickup → cumulative speed boost.
   *  Each arrow adds +1 to the stack (cap 4 → 5× max) and refreshes
   *  the 30 s timer. So 1 arrow = 2×, 2 arrows = 3×, 3 = 4×, 4+ = 5×. */
  registerSpeedPickup() {
    const BOOST_DURATION = 30;
    const MAX_STACK = 4;
    const fs = this.flightState;
    fs.speedBoostStack = Math.min((fs.speedBoostStack || 0) + 1, MAX_STACK);
    fs.speedBoostT = BOOST_DURATION;
    if (this.onSpeedBoost) this.onSpeedBoost(BOOST_DURATION, fs.speedBoostStack + 1);
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

    // Ambient chirp from the nest — gets louder as you approach, silent far away.
    this._chirpCooldown -= dt;
    if (this._chirpCooldown <= 0) {
      if (this.onChirp) {
        const dist = this.flightState.position.distanceTo(this.nest.position);
        const maxAudible = 1400;
        if (dist < maxAudible) {
          const volumeScale = 1 - dist / maxAudible;
          this.onChirp(volumeScale * volumeScale); // squared → falls off quicker
        }
      }
      this._chirpCooldown = 2.5 + Math.random() * 2.5;
    }

    const birdPos = this.flightState.position;

    // Leaving the nest unlocks the return condition
    const distFromNest = birdPos.distanceTo(this.nest.position);
    if (!this._leftNest && distFromNest > NEST_WIN_DISTANCE * 2) {
      this._leftNest = true;
    }

    // Stick pickup
    if (this.sticks < this.sticksRequired) {
      for (const tree of this.stickTrees) {
        if (tree.harvested) continue;
        if (birdPos.distanceTo(tree.position.clone().setY(tree.position.y + 12)) < STICK_COLLECT_RADIUS + 8) {
          tree.harvest();
          this.sticks++;
          this.bursts.push(new RingBurst(this.scene, tree.position.clone().setY(tree.position.y + 12), 0xff6633));
          if (navigator.vibrate) navigator.vibrate(35);
          if (this.onStickCollected) this.onStickCollected();
          if (this.sticks >= this.sticksRequired && this.worms >= this.wormsRequired) this._onQuestComplete();
        }
      }
    }

    // Worm pickup — only when flying low enough
    if (this.worms < this.wormsRequired) {
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
          if (this.sticks >= this.sticksRequired && this.worms >= this.wormsRequired) this._onQuestComplete();
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
    // Rings no longer add side-score — they recharge the timer (+30 s
     // per pickup), and remaining time IS the score. So the formula is:
     // remaining time + per-level base bonus, no separate ring multiplier.
    const levelScore = remaining + this.level * 50;
    this.finalScore = levelScore;
    this.totalScore += levelScore;
    if (this.totalScore > this.highscore) {
      this.highscore = this.totalScore;
      localStorage.setItem(HIGHSCORE_KEY, String(this.highscore));
    }
    // Trigger chick celebration animation (wings flap, worm appears, chirps)
    this.nest.celebrate();
    // Gold sparkle bursts around the nest
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const angle = (i / 5) * Math.PI * 2;
        const pos = this.nest.position.clone();
        pos.x += Math.cos(angle) * 3;
        pos.z += Math.sin(angle) * 3;
        pos.y += 5;
        this.bursts.push(new RingBurst(this.scene, pos, 0xffdd44));
      }, i * 180);
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

    this.level = 1;
    this.sticksRequired = STICKS_REQUIRED;
    this.wormsRequired = WORMS_REQUIRED;
    this.totalScore = 0;
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

  /**
   * Advance to the next level: +1 stick, +1 worm, fresh timer,
   * new spawns. Caller (main.js) handles biome change separately.
   */
  nextLevel() {
    this.level++;
    this.sticksRequired = STICKS_REQUIRED + (this.level - 1);
    this.wormsRequired = WORMS_REQUIRED + (this.level - 1);

    for (const w of this.worms_list) w.dispose();
    for (const t of this.stickTrees) t.dispose();
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

    this._spawnStickTrees();
    this._spawnWorms();
    if (this.onLevelUp) this.onLevelUp(this.level);
  }
}
