import * as THREE from 'three';
import { WATER_LEVEL } from '../constants.js';

/** Generate a soft circular mist texture. */
function _createMistTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  gradient.addColorStop(0, 'rgba(220, 235, 255, 0.6)');
  gradient.addColorStop(0.3, 'rgba(220, 235, 255, 0.3)');
  gradient.addColorStop(0.7, 'rgba(220, 235, 255, 0.08)');
  gradient.addColorStop(1, 'rgba(220, 235, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Water spray particles when bird flies low over water.
 * Creates fine mist effect for wave-skimming immersion.
 */
export class WaterSpray {
  constructor(scene) {
    this._scene = scene;
    this._particles = [];
    this._group = new THREE.Group();
    this._group.name = 'water-spray';
    scene.add(this._group);

    this._mistTex = _createMistTexture();

    // Pool of fine spray particles
    for (let i = 0; i < 80; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this._mistTex,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this._group.add(sprite);
      this._particles.push({
        sprite,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0,
      });
    }

    this._spawnTimer = 0;
  }

  /**
   * @param {import('../flight/FlightState.js').FlightState} state
   * @param {number} dt
   */
  update(state, dt) {
    const heightAboveWater = state.altitude - WATER_LEVEL;

    // Only spray when flying low (0.5-4m) over water and moving fast enough
    if (heightAboveWater > 0.5 && heightAboveWater < 4 && state.speed > 8) {
      this._spawnTimer += dt;
      const spawnRate = 0.03; // every 30ms

      while (this._spawnTimer >= spawnRate) {
        this._spawnTimer -= spawnRate;
        this._spawnParticle(state, heightAboveWater);
      }
    }

    // Update existing particles
    for (const p of this._particles) {
      if (p.life <= 0) continue;

      p.life -= dt;
      p.sprite.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 5.0 * dt; // gravity pulls spray down

      const progress = 1 - p.life / p.maxLife;
      p.sprite.material.opacity = 0.25 * (1 - progress);
      const scale = 0.15 + progress * 0.6;
      p.sprite.scale.set(scale, scale, 1);

      if (p.life <= 0) {
        p.sprite.visible = false;
      }
    }
  }

  _spawnParticle(state, height) {
    // Find dead particle
    const p = this._particles.find((p) => p.life <= 0);
    if (!p) return;

    // Spawn behind and below bird
    const spread = 2.0;
    p.sprite.position.set(
      state.position.x + (Math.random() - 0.5) * spread,
      WATER_LEVEL + 0.2,
      state.position.z + (Math.random() - 0.5) * spread,
    );

    // Fine mist: gentle upward drift
    p.velocity.set(
      (Math.random() - 0.5) * 2,
      1 + Math.random() * 2,
      (Math.random() - 0.5) * 2,
    );

    p.maxLife = 0.3 + Math.random() * 0.4;
    p.life = p.maxLife;
    p.sprite.visible = true;
    p.sprite.material.opacity = 0.25;
    const s = 0.15 + Math.random() * 0.2;
    p.sprite.scale.set(s, s, 1);
  }
}
