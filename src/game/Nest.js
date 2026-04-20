import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * The home nest — player spawns here, must return here after gathering
 * a stick + a worm. Visible from far away thanks to a subtle upward light beam.
 *
 * The chick is loaded as a GLB model (Three.js's Parrot, scaled small and
 * tinted yellow) with a built-in wing-flap morph animation. Much cuter than
 * our previous procedural snowman.
 */
export class Nest {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();

    this.group = new THREE.Group();
    this.group.name = 'nest';
    this.group.position.copy(position);
    scene.add(this.group);

    this._chickMixer = null;
    this._chickAction = null;
    this._chickModel = null;
    // Baby stork — 75% of adult scale. BirdModel uses 0.04 for the player stork.
    this._chickBaseScale = 0.03;
    this._chickBaseY = 2.6;
    this._hopT = Math.random() * 2; // desynchronize hops across sessions

    this._build();
    this._loadChick();
  }

  _build() {
    // Outer twig bowl
    const bowl = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 2.2, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.95 })
    );
    bowl.rotation.x = Math.PI / 2;
    bowl.position.y = 1.5;
    this.group.add(bowl);

    // Second twig ring for depth
    const bowl2 = new THREE.Mesh(
      new THREE.TorusGeometry(4.8, 1.8, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x6a4020, roughness: 0.95 })
    );
    bowl2.rotation.x = Math.PI / 2;
    bowl2.position.y = 2.6;
    this.group.add(bowl2);

    // Inner moss floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 16),
      new THREE.MeshStandardMaterial({ color: 0x5a6a2a, roughness: 0.9, side: THREE.DoubleSide })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 1.8;
    this.group.add(floor);

    // Orientation beacon — upward light column, visible from altitude
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 0.3, 200, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x88ddff,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    beam.position.y = 103;
    this.group.add(beam);
    this.beam = beam;

    // Point light — makes the nest glow through night biomes
    const glow = new THREE.PointLight(0x88ddff, 2.0, 300, 1.3);
    glow.position.y = 8;
    this.group.add(glow);
  }

  _loadChick() {
    const loader = new GLTFLoader();
    loader.load(
      'models/Stork.glb',
      (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(this._chickBaseScale);
        model.position.set(0, this._chickBaseY, 0);
        // Upright standing pose. The BirdModel sets yaw via lookAt then does
        // rotateX(-0.95) in local frame. Using Euler rotation here we need the
        // opposite sign because Euler.XYZ applies X first in the parent frame.
        model.rotation.order = 'YXZ';
        model.rotation.y = Math.PI;
        model.rotation.x = -0.95;

        // Keep original Stork textures — no material override.
        // Only disable env-map dependency for consistent mobile look.
        model.traverse((o) => {
          if (o.isMesh && o.material) {
            o.material.envMap = null;
            if (o.material.metalness !== undefined) o.material.metalness = 0;
            o.material.needsUpdate = true;
          }
        });

        this._chickModel = model;
        this.group.add(model);

        // Freeze the wings at a folded-in pose — a chick in the nest shouldn't flap.
        // We create the mixer but leave action stopped at time≈0.95 (wings tucked).
        if (gltf.animations && gltf.animations[0]) {
          this._chickMixer = new THREE.AnimationMixer(model);
          this._chickAction = this._chickMixer.clipAction(gltf.animations[0]);
          this._chickAction.play();
          this._chickAction.time = 0.95;
          this._chickAction.timeScale = 0; // paused
          this._chickMixer.update(0);
        }
      },
      undefined,
      (err) => console.warn('Nest: chick GLB load failed', err)
    );
  }

  update(dt, t) {
    if (this._chickMixer) this._chickMixer.update(dt);

    if (this._chickModel) {
      this._hopT += dt;
      // Hop cycle: ~0.55s airborne (parabolic), then ~0.8s idle. Repeats.
      const period = 1.35;
      const air = 0.55;
      const phase = this._hopT % period;
      let yOff = 0;
      let squash = 1;
      let stretch = 1;
      if (phase < air) {
        const p = phase / air; // 0→1
        yOff = Math.sin(p * Math.PI) * 1.2; // peak ≈1.2m above base
        stretch = 1 + Math.sin(p * Math.PI) * 0.08;
      } else {
        const p = (phase - air) / (period - air); // 0→1 on ground
        if (p < 0.18) {
          const q = 1 - p / 0.18;
          squash = 1 - q * 0.18; // brief squash on landing
          stretch = 1 + q * 0.05;
        }
      }
      this._chickModel.position.y = this._chickBaseY + yOff;
      this._chickModel.scale.set(
        this._chickBaseScale * squash,
        this._chickBaseScale * stretch,
        this._chickBaseScale * squash,
      );
      // Occasional head-turn
      this._chickModel.rotation.y = Math.PI + Math.sin(t * 0.6) * 0.2;
    }

    if (this.beam) {
      this.beam.material.opacity = 0.14 + Math.sin(t * 1.1) * 0.05;
    }
  }

  /** Quick 'chirp' animation — briefly speeds up the wing-flap cycle. */
  openBeak(durationMs = 500) {
    if (!this._chickAction) return;
    const origTimeScale = this._chickAction.timeScale;
    this._chickAction.timeScale = 2.5;
    setTimeout(() => {
      if (this._chickAction) this._chickAction.timeScale = origTimeScale;
    }, durationMs);
  }

  /**
   * Win celebration: wings flap properly, a wiggly worm appears at the chick's
   * beak and gets devoured, two chirps, the chick bounces in place.
   */
  celebrate() {
    if (this._chickAction) {
      this._chickAction.timeScale = 3.0;
      setTimeout(() => { if (this._chickAction) this._chickAction.timeScale = 0; }, 2800);
    }

    // Wriggly worm appears in front of the beak, then shrinks into nothing
    // (chick "swallows" it). Position is in nest-local space.
    const wormGeom = new THREE.CapsuleGeometry(0.22, 0.9, 5, 8);
    const wormMat = new THREE.MeshStandardMaterial({
      color: 0xee6699,
      emissive: 0xff5599,
      emissiveIntensity: 1.4,
      roughness: 0.5,
    });
    const worm = new THREE.Mesh(wormGeom, wormMat);
    worm.rotation.z = Math.PI / 2;
    const startZ = 1.2;   // in front of chick
    const endZ = 0.1;     // at chick's beak
    worm.position.set(0, this._chickBaseY + 0.3, startZ);
    this.group.add(worm);

    const wormStart = performance.now();
    const WORM_DURATION = 1400;
    const animWorm = () => {
      const p = (performance.now() - wormStart) / WORM_DURATION;
      if (p >= 1) {
        this.group.remove(worm);
        worm.geometry.dispose();
        worm.material.dispose();
        return;
      }
      if (p < 0.6) {
        // worm floats toward beak with a wiggle
        const q = p / 0.6;
        worm.position.z = startZ + (endZ - startZ) * q;
        worm.rotation.y = Math.sin(p * 20) * 0.3;
      } else {
        // shrink away (eaten)
        const q = (p - 0.6) / 0.4;
        worm.scale.setScalar(1 - q);
      }
      requestAnimationFrame(animWorm);
    };
    animWorm();

    // Two triumphant chirps
    setTimeout(() => this.openBeak(300), 150);
    setTimeout(() => this.openBeak(300), 520);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material?.dispose?.();
      }
    });
  }
}
