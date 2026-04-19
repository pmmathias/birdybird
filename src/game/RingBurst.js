import * as THREE from 'three';

const PARTICLE_COUNT = 18;
const LIFETIME = 0.8;

/**
 * Short-lived sparkle burst at a ring-collect point. Uses a single
 * Points object per burst — cheap, batched, auto-disposes after LIFETIME.
 */
export class RingBurst {
  constructor(scene, position, color = 0xffdd44) {
    this.scene = scene;
    this._age = 0;

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    this._velocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 14 + Math.random() * 10;
      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.cos(phi) * speed + 4; // lift
      const vz = Math.sin(phi) * Math.sin(theta) * speed;

      positions[i * 3 + 0] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      this._velocities[i * 3 + 0] = vx;
      this._velocities[i * 3 + 1] = vy;
      this._velocities[i * 3 + 2] = vz;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size: 2.2,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geom, mat);
    scene.add(this.points);
  }

  /** @returns {boolean} true if still alive, false if should be removed. */
  update(dt) {
    this._age += dt;
    if (this._age >= LIFETIME) return false;

    const geom = this.points.geometry;
    const pos = geom.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3 + 0] += this._velocities[i * 3 + 0] * dt;
      pos[i * 3 + 1] += this._velocities[i * 3 + 1] * dt;
      pos[i * 3 + 2] += this._velocities[i * 3 + 2] * dt;
      // gravity + drag
      this._velocities[i * 3 + 1] -= 20 * dt;
      this._velocities[i * 3 + 0] *= 1 - dt * 0.9;
      this._velocities[i * 3 + 2] *= 1 - dt * 0.9;
    }
    geom.attributes.position.needsUpdate = true;

    // Fade out in the second half
    const t = this._age / LIFETIME;
    this.points.material.opacity = Math.max(0, 1 - t * t);
    return true;
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
