import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Boid flock that flies in V-formation around the player bird.
 * Boids stay AHEAD and to the SIDES of the player (visible from chase cam).
 * Desktop only.
 */
export class Flock {
  constructor(scene, count = 24) {
    this._scene = scene;
    this._count = count;
    this._boids = [];
    this._model = null;
    this._loaded = false;

    this._load();
  }

  _load() {
    const loader = new GLTFLoader();
    loader.load('models/Stork.glb', (gltf) => {
      this._model = gltf.scene;
      this._animation = gltf.animations[0] || null;

      // Create boid instances
      for (let i = 0; i < this._count; i++) {
        const bird = this._model.clone();
        bird.scale.setScalar(0.03); // slightly smaller than player stork

        // Fix materials (no env map dependency)
        bird.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.envMap = null;
            if (child.material.metalness !== undefined) child.material.metalness = 0;
            if (child.material.roughness !== undefined) child.material.roughness = 0.8;
            child.material.needsUpdate = true;
          }
        });

        this._scene.add(bird);

        // Animation mixer per boid
        let mixer = null, action = null;
        if (this._animation) {
          mixer = new THREE.AnimationMixer(bird);
          action = mixer.clipAction(this._animation);
          action.play();
          // Offset animation phase so they don't all flap in sync
          action.time = Math.random() * 2;
          action.timeScale = 0.8 + Math.random() * 0.4;
        }

        // V-formation slot: leader is at FRONT, flock trails BEHIND and to sides
        const row = Math.floor(i / 2) + 1;  // 1, 1, 2, 2, 3, 3...
        const side = (i % 2 === 0) ? -1 : 1;

        this._boids.push({
          mesh: bird,
          mixer,
          action,
          // Formation offset: BEHIND leader, spreading sideways
          formationOffset: new THREE.Vector3(
            side * row * 3,          // spread sideways (tighter)
            (Math.random() - 0.5) * 1.5, // slight random altitude
            -row * 2.5,              // BEHIND player (negative = trailing)
          ),
          // Current smooth position
          pos: new THREE.Vector3(),
          // Individual variation
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.5 + Math.random() * 0.5,
          wobbleAmp: 0.3 + Math.random() * 0.3,
          initialized: false,
        });
      }

      // Start hidden — boids appear periodically
      for (const boid of this._boids) boid.mesh.visible = false;

      this._loaded = true;
      this._phase = 'away';    // 'arriving', 'flying', 'departing', 'away'
      this._phaseTimer = 5;    // first appearance after 5s
      this._flyDuration = 10;  // fly together for 10s
      this._awayDuration = 20; // gone for 20s (total cycle ~35s)

      console.log(`Flock loaded: ${this._count} boids (appear periodically)`);
    });
  }

  /**
   * Update flock with periodic appear/disappear cycle.
   */
  update(state, dt) {
    if (!this._loaded) return;

    this._phaseTimer -= dt;

    // Phase state machine
    if (this._phase === 'away' && this._phaseTimer <= 0) {
      // Time to appear! Spawn boids far behind and to the sides
      this._phase = 'arriving';
      this._phaseTimer = 3; // 3s to arrive into formation
      for (const boid of this._boids) {
        boid.mesh.visible = true;
        // Start far behind player
        const spawnOffset = boid.formationOffset.clone();
        spawnOffset.z -= 80; // way behind
        spawnOffset.x *= 3;  // spread wide
        spawnOffset.y += 10 + Math.random() * 10; // above
        boid.pos.copy(state.position).add(spawnOffset);
        boid.initialized = true;
      }
    } else if (this._phase === 'arriving' && this._phaseTimer <= 0) {
      this._phase = 'flying';
      this._phaseTimer = this._flyDuration;
    } else if (this._phase === 'flying' && this._phaseTimer <= 0) {
      this._phase = 'departing';
      this._phaseTimer = 3; // 3s to depart
    } else if (this._phase === 'departing' && this._phaseTimer <= 0) {
      this._phase = 'away';
      this._phaseTimer = this._awayDuration + Math.random() * 10; // some randomness
      for (const boid of this._boids) boid.mesh.visible = false;
      return;
    }

    if (this._phase === 'away') return;

    const playerPos = state.position;
    const forward = state.forward;
    const right = state.right;

    // During departure: formation drifts away
    const departFactor = this._phase === 'departing'
      ? (3 - this._phaseTimer) / 3 // 0→1 as departing progresses
      : 0;

    for (const boid of this._boids) {
      const offset = boid.formationOffset;

      // Target: formation position relative to leader
      const target = playerPos.clone()
        .addScaledVector(forward, offset.z)
        .addScaledVector(right, offset.x)
        .add(new THREE.Vector3(0, offset.y, 0));

      // During departure: drift upward and outward
      if (departFactor > 0) {
        target.y += departFactor * 30;
        target.x += Math.sign(offset.x) * departFactor * 40;
        target.z -= departFactor * 50;
      }

      // Organic wobble
      boid.wobble += boid.wobbleSpeed * dt;
      target.x += Math.sin(boid.wobble) * boid.wobbleAmp;
      target.y += Math.cos(boid.wobble * 1.3) * boid.wobbleAmp * 0.5;

      // Follow rate: arriving = slow (drifting in), flying = tight
      const rate = this._phase === 'arriving' ? 1.5 : 3.5;
      const followRate = 1 - Math.exp(-rate * dt);
      boid.pos.lerp(target, followRate);

      boid.mesh.position.copy(boid.pos);

      // Face forward
      const lookTarget = boid.pos.clone().add(forward);
      boid.mesh.lookAt(lookTarget);
      boid.mesh.rotateZ(-state.roll * 0.6);

      // Wing animation
      if (boid.mixer) {
        if (state.flapPhase > 0) {
          boid.action.timeScale = 1.2 + Math.random() * 0.3;
        } else if (state.wingSpread > 0.7) {
          boid.action.timeScale = 0.15;
        } else {
          boid.action.timeScale = 0.4;
        }
        boid.mixer.update(dt);
      }
    }
  }

  /**
   * Scatter boids outward (called during dive for dramatic effect).
   */
  scatter() {
    for (const boid of this._boids) {
      boid.wobbleAmp = 2 + Math.random() * 3;
      // Will naturally return to normal via wobble decay
      setTimeout(() => { boid.wobbleAmp = 0.3 + Math.random() * 0.3; }, 2000);
    }
  }
}
