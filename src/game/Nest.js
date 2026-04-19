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

    // Chick body
    const chickBody = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfff1b0, roughness: 0.6 })
    );
    chickBody.position.y = 3.2;
    chickBody.scale.set(1.0, 0.9, 1.0);
    this.group.add(chickBody);

    // Chick head
    const chickHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffe080, roughness: 0.6 })
    );
    chickHead.position.set(0, 4.2, 0.3);
    this.group.add(chickHead);
    this.chickHead = chickHead;

    // Beak
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.7, 6),
      new THREE.MeshStandardMaterial({ color: 0xff8822, roughness: 0.5 })
    );
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 4.2, 1.1);
    this.group.add(beak);
    this.beak = beak;

    // Two tiny eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const eyeGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.3, 4.4, 0.85);
    this.group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.3, 4.4, 0.85);
    this.group.add(eyeR);

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
    // Chick idly bobs its head
    if (this.chickHead) {
      const bob = Math.sin(t * 2.2) * 0.08;
      this.chickHead.position.y = 4.2 + bob;
      this.chickHead.rotation.y = Math.sin(t * 0.7) * 0.3;
    }
    // Beam slowly pulses
    if (this.beam) {
      this.beam.material.opacity = 0.14 + Math.sin(t * 1.1) * 0.05;
    }
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
