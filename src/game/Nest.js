import * as THREE from 'three';

/**
 * The home nest — player spawns here, must return here after gathering
 * a stick + a worm. Visible from far away thanks to a subtle upward light beam.
 */
export class Nest {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();

    this.group = new THREE.Group();
    this.group.name = 'nest';
    this.group.position.copy(position);
    scene.add(this.group);

    this._build();
  }

  _build() {
    // Outer twig bowl — a fat torus looks surprisingly nest-like
    const bowl = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 2.2, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.95, metalness: 0.0 })
    );
    bowl.rotation.x = Math.PI / 2;
    bowl.position.y = 1.5;
    this.group.add(bowl);

    // Second twig ring offset for depth
    const bowl2 = new THREE.Mesh(
      new THREE.TorusGeometry(4.8, 1.8, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x6a4020, roughness: 0.95 })
    );
    bowl2.rotation.x = Math.PI / 2;
    bowl2.position.y = 2.6;
    this.group.add(bowl2);

    // Inner floor (soft moss)
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 16),
      new THREE.MeshStandardMaterial({ color: 0x5a6a2a, roughness: 0.9, side: THREE.DoubleSide })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 1.8;
    this.group.add(floor);

    // --- Chick: fluffy baby-bird proportions ---
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfff0a0, roughness: 0.75 });
    const fluffMat = new THREE.MeshStandardMaterial({ color: 0xfff5c8, roughness: 0.9 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xff8822, roughness: 0.5 });
    const footMat = new THREE.MeshStandardMaterial({ color: 0xff9933, roughness: 0.6 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.25 });
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    this.chickGroup = new THREE.Group();
    this.chickGroup.position.y = 2.0;
    this.group.add(this.chickGroup);

    // Body — slightly stretched sphere, teardrop-ish
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 14), bodyMat);
    body.scale.set(1.05, 1.05, 1.2);
    body.position.y = 1.25;
    this.chickGroup.add(body);

    // Down fluff lumps scattered across the back
    const fluffSpots = [
      { x: -0.4, y: 1.9, z: -0.5, r: 0.55 },
      { x:  0.5, y: 2.0, z: -0.3, r: 0.5 },
      { x:  0.0, y: 2.1, z: -0.6, r: 0.6 },
      { x: -0.6, y: 1.4, z: -0.7, r: 0.45 },
      { x:  0.7, y: 1.5, z: -0.6, r: 0.45 },
    ];
    for (const s of fluffSpots) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(s.r, 8, 8), fluffMat);
      f.position.set(s.x, s.y, s.z);
      this.chickGroup.add(f);
    }

    // Tiny stubby wings — flat ellipsoids pressed against the body sides
    const wingGeo = new THREE.SphereGeometry(0.55, 10, 8);
    const wingL = new THREE.Mesh(wingGeo, bodyMat);
    wingL.scale.set(0.4, 0.8, 1.2);
    wingL.position.set(-0.95, 1.35, 0.05);
    wingL.rotation.z = 0.15;
    this.chickGroup.add(wingL);
    const wingR = wingL.clone();
    wingR.position.x = 0.95;
    wingR.rotation.z = -0.15;
    this.chickGroup.add(wingR);
    this.wingL = wingL;
    this.wingR = wingR;

    // Head — big relative to body (baby proportions!)
    const headGeom = new THREE.SphereGeometry(1.0, 16, 14);
    const head = new THREE.Mesh(headGeom, bodyMat);
    head.scale.set(1.0, 0.95, 1.0);
    head.position.set(0, 2.55, 0.25);
    this.chickGroup.add(head);
    this.chickHead = head;

    // Head fluff — three messy tufts on top
    const tuftPositions = [
      { x: -0.15, y: 3.25, z: -0.1, r: 0.3 },
      { x:  0.2, y: 3.3, z: 0.0, r: 0.27 },
      { x:  0.0, y: 3.4, z: 0.15, r: 0.25 },
    ];
    for (const t of tuftPositions) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(t.r, 8, 8), fluffMat);
      tuft.position.set(t.x, t.y, t.z);
      this.chickGroup.add(tuft);
    }

    // Big baby eyes
    const eyeGeo = new THREE.SphereGeometry(0.18, 10, 10);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.35, 2.62, 0.88);
    this.chickGroup.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.35;
    this.chickGroup.add(eyeR);

    // Eye highlights — tiny white specks that give the bird "life"
    const hlGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const hlL = new THREE.Mesh(hlGeo, highlightMat);
    hlL.position.set(-0.3, 2.68, 1.01);
    this.chickGroup.add(hlL);
    const hlR = hlL.clone();
    hlR.position.x = 0.4;
    this.chickGroup.add(hlR);

    // Beak — split in two so we can open it on feed
    this.beakUpper = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.55, 6),
      beakMat
    );
    this.beakUpper.rotation.x = Math.PI / 2;
    this.beakUpper.position.set(0, 2.48, 1.1);
    this.chickGroup.add(this.beakUpper);

    this.beakLower = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.5, 6),
      beakMat
    );
    this.beakLower.rotation.x = Math.PI / 2;
    this.beakLower.position.set(0, 2.35, 1.08);
    this.chickGroup.add(this.beakLower);

    // Little orange feet peeking out from the body
    const footGeo = new THREE.SphereGeometry(0.16, 8, 6);
    const footL = new THREE.Mesh(footGeo, footMat);
    footL.scale.set(1.3, 0.55, 1.1);
    footL.position.set(-0.35, 0.15, 0.35);
    this.chickGroup.add(footL);
    const footR = footL.clone();
    footR.position.x = 0.35;
    this.chickGroup.add(footR);

    // Orientation beacon — soft upward light column, visible from afar
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

    // Point light for nighttime biomes
    const glow = new THREE.PointLight(0x88ddff, 2.0, 300, 1.3);
    glow.position.y = 8;
    this.group.add(glow);
  }

  update(dt, t) {
    // Chick idly sways and looks around
    if (this.chickGroup) {
      this.chickGroup.rotation.y = Math.sin(t * 0.7) * 0.25;
      this.chickGroup.position.y = 2.0 + Math.sin(t * 2.2) * 0.05;
    }
    if (this.chickHead) {
      this.chickHead.rotation.z = Math.sin(t * 1.3) * 0.1;
    }
    // Wings twitch occasionally
    if (this.wingL && this.wingR) {
      const twitch = Math.max(0, Math.sin(t * 0.9));
      this.wingL.rotation.z = 0.15 - twitch * 0.1;
      this.wingR.rotation.z = -0.15 + twitch * 0.1;
    }
    // Beam slowly pulses
    if (this.beam) {
      this.beam.material.opacity = 0.14 + Math.sin(t * 1.1) * 0.05;
    }
  }

  /** Trigger a 'beak open — chirp' animation (call on worm feed / win). */
  openBeak(durationMs = 400) {
    if (!this.beakLower) return;
    const start = performance.now();
    const anim = () => {
      const p = (performance.now() - start) / durationMs;
      if (p >= 1) {
        this.beakLower.position.y = 2.35;
        this.beakLower.rotation.x = Math.PI / 2;
        return;
      }
      const wave = Math.sin(p * Math.PI); // 0 → 1 → 0
      this.beakLower.rotation.x = Math.PI / 2 + wave * 0.7;
      this.beakLower.position.y = 2.35 - wave * 0.18;
      requestAnimationFrame(anim);
    };
    anim();
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
