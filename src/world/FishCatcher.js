import * as THREE from 'three';
import { WATER_LEVEL } from '../constants.js';
import { t } from '../i18n.js';

/**
 * Fish-catching mechanic: dive into water at the right angle to catch fish.
 * Shows a visual splash + catch notification.
 */
export class FishCatcher {
  constructor(scene) {
    this._scene = scene;
    this._catchCount = 0;
    this._cooldown = 0;
    this._lastAboveWater = true;

    // Splash effect
    this._splashGroup = new THREE.Group();
    scene.add(this._splashGroup);

    // Catch notification DOM element
    this._notif = document.createElement('div');
    this._notif.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      color:#ffdd44; font:bold 28px sans-serif; pointer-events:none;
      z-index:200; text-shadow:2px 2px 4px rgba(0,0,0,0.6);
      opacity:0; transition:opacity 0.3s, transform 0.3s;
    `;
    document.body.appendChild(this._notif);

    // Score display
    this._score = document.createElement('div');
    this._score.style.cssText = `
      position:fixed; top:16px; right:16px;
      color:rgba(255,255,255,0.7); font:bold 16px sans-serif;
      pointer-events:none; z-index:200;
      text-shadow:1px 1px 2px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(this._score);
  }

  /**
   * @param {import('../flight/FlightState.js').FlightState} state
   * @param {number} dt
   */
  update(state, dt) {
    if (this._cooldown > 0) this._cooldown -= dt;

    const aboveWater = state.altitude > WATER_LEVEL;
    const justEnteredWater = this._lastAboveWater && !aboveWater;
    this._lastAboveWater = aboveWater;

    // Detect dive-catch: bird enters water from above with enough speed and steep angle
    if (justEnteredWater && this._cooldown <= 0) {
      const speed = state.speed;
      const diveAngle = -state.velocity.y / Math.max(speed, 0.1); // 0=horizontal, 1=straight down

      // Need decent speed (>10 m/s) and steep dive (>30° = diveAngle > 0.5)
      if (speed > 10 && diveAngle > 0.5) {
        this._catchFish(state, diveAngle);
      } else if (speed > 5) {
        this._splash(state); // just a splash, no catch
      }
    }

    // Update score display
    if (this._catchCount > 0) {
      this._score.textContent = `🐟 × ${this._catchCount}`;
    }
  }

  _catchFish(state, diveAngle) {
    this._catchCount++;
    this._cooldown = 2.0; // 2s cooldown between catches

    // Bigger splash
    this._splash(state);

    // Catch notification
    const messages = [
      `🐟 ${t('fish.catch1')}`,
      `🐟 ${t('fish.catch2')}`,
      `🐟 ${t('fish.catch3')}`,
      `🐟 ${t('fish.catch4')}`,
    ];
    this._notif.textContent = messages[Math.floor(Math.random() * messages.length)];
    this._notif.style.opacity = '1';
    this._notif.style.transform = 'translate(-50%, -50%) scale(1.2)';
    setTimeout(() => {
      this._notif.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 100);
    setTimeout(() => {
      this._notif.style.opacity = '0';
    }, 1500);
  }

  _splash(state) {
    // Create temporary splash sprites
    const count = 12;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        color: 0xaaccee,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(
        state.position.x + (Math.random() - 0.5) * 3,
        WATER_LEVEL + 0.5,
        state.position.z + (Math.random() - 0.5) * 3,
      );
      const s = 0.5 + Math.random();
      sprite.scale.set(s, s, 1);

      this._splashGroup.add(sprite);

      const vy = 3 + Math.random() * 5;
      const vx = (Math.random() - 0.5) * 4;
      const vz = (Math.random() - 0.5) * 4;
      let life = 0.6 + Math.random() * 0.4;

      const animate = () => {
        life -= 0.016;
        if (life <= 0) {
          this._splashGroup.remove(sprite);
          mat.dispose();
          return;
        }
        sprite.position.x += vx * 0.016;
        sprite.position.y += vy * 0.016;
        sprite.position.y -= 9.81 * 0.016 * 0.5;
        sprite.material.opacity = life * 0.6;
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  }
}
