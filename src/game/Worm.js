import * as THREE from 'three';

/**
 * Small glowing worm on the ground. Wiggles + blinks pink so it's visible
 * from altitude. Player must fly low enough to pick it up.
 */
const BODY_GEOM = new THREE.CapsuleGeometry(0.5, 2.6, 4, 8);
const BODY_MAT = new THREE.MeshStandardMaterial({
  color: 0xee6699,
  emissive: 0xff5599,
  emissiveIntensity: 1.3,
  roughness: 0.6,
});
const HALO_GEOM = new THREE.RingGeometry(1.8, 3.2, 20);
const HALO_MAT = new THREE.MeshBasicMaterial({
  color: 0xff88bb,
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

export class Worm {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();
    this.collected = false;

    this.group = new THREE.Group();
    this.group.name = 'worm';
    this.group.position.copy(position);

    this.body = new THREE.Mesh(BODY_GEOM, BODY_MAT);
    this.body.rotation.z = Math.PI / 2; // lay flat on ground
    // Lifted so the body sits clearly above terrain (terrain mesh has
    // some smoothing & visual thickness — at y=0.5 the worm half-sank
    // into the ground from the chase-cam angle).
    this.body.position.y = 1.1;
    this.group.add(this.body);

    // Ground halo — sits just above ground so it stays visible from
    // every angle without z-fighting against terrain
    this.halo = new THREE.Mesh(HALO_GEOM, HALO_MAT);
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = 0.4;
    this.group.add(this.halo);

    // Phase offset so worms don't all blink in sync
    this._phase = Math.random() * Math.PI * 2;

    scene.add(this.group);
  }

  update(dt, t) {
    if (this.collected) return;
    const tt = t + this._phase;
    // Body wiggle
    this.body.rotation.y = Math.sin(tt * 4) * 0.5;
    // Halo pulse for visibility from altitude
    const pulse = 0.5 + Math.sin(tt * 2.5) * 0.5;
    this.halo.material.opacity = 0.2 + pulse * 0.35;
    this.halo.scale.setScalar(0.9 + pulse * 0.3);
    BODY_MAT.emissiveIntensity = 0.9 + pulse * 0.6;
  }

  dispose() {
    this.scene.remove(this.group);
    // Geom + material are shared — don't dispose
  }
}
