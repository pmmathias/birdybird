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
    // Baby stork — 40% of adult scale. BirdModel uses 0.04 for the player stork.
    this._chickBaseScale = 0.016;
    this._chickBaseY = 3.0;

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
        model.rotation.y = Math.PI;

        // Force pale-yellow baby colouring — aggressive override:
        // replace material entirely so texture maps + vertex colors can't bleed through.
        model.traverse((o) => {
          if (o.isMesh) {
            o.material = new THREE.MeshStandardMaterial({
              color: 0xffe0a0,
              roughness: 0.85,
              metalness: 0.0,
              envMapIntensity: 0.4,
            });
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
      // Gentle idle bob
      this._chickModel.position.y = this._chickBaseY + Math.sin(t * 1.6) * 0.1;
      // Occasional head-turn
      this._chickModel.rotation.y = Math.PI + Math.sin(t * 0.6) * 0.25;
    }

    if (this.beam) {
      this.beam.material.opacity = 0.14 + Math.sin(t * 1.1) * 0.05;
    }
  }

  /** Quick 'chirp' animation — speeds up the flap + tiny scale pop. */
  openBeak(durationMs = 500) {
    if (!this._chickModel || !this._chickAction) return;
    const origTimeScale = this._chickAction.timeScale;
    const origScale = this._chickBaseScale;
    this._chickAction.timeScale = 2.5;

    const start = performance.now();
    const anim = () => {
      const p = (performance.now() - start) / durationMs;
      if (p >= 1) {
        this._chickAction.timeScale = origTimeScale;
        this._chickModel.scale.setScalar(origScale);
        return;
      }
      const wave = Math.sin(p * Math.PI); // 0 → 1 → 0
      this._chickModel.scale.setScalar(origScale * (1 + wave * 0.15));
      requestAnimationFrame(anim);
    };
    anim();
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
