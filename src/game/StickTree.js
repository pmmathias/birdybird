import * as THREE from 'three';

/**
 * A glowing special tree — flagged from normal forest trees by an emissive red/gold
 * outline and a pulsing aura. Flying through one gives the player a stick.
 * After being harvested the tree stays but is visually dimmed.
 */
const TRUNK_MAT = new THREE.MeshStandardMaterial({
  color: 0x553322,
  emissive: 0xff4422,
  emissiveIntensity: 1.2,
  roughness: 0.5,
});
const CROWN_MAT = new THREE.MeshStandardMaterial({
  color: 0xcc5533,
  emissive: 0xffaa44,
  emissiveIntensity: 1.1,
  roughness: 0.5,
  transparent: true,
  opacity: 0.95,
});
const AURA_MAT = new THREE.MeshBasicMaterial({
  color: 0xffaa44,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const DIM_TRUNK_MAT = new THREE.MeshStandardMaterial({
  color: 0x332211, emissive: 0x000000, roughness: 0.9,
});
const DIM_CROWN_MAT = new THREE.MeshStandardMaterial({
  color: 0x443322, emissive: 0x000000, roughness: 0.9,
});

export class StickTree {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();
    this.harvested = false;

    this.group = new THREE.Group();
    this.group.name = 'stickTree';
    this.group.position.copy(position);

    this.trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.1, 14, 8),
      TRUNK_MAT
    );
    this.trunk.position.y = 7;
    this.group.add(this.trunk);

    this.crown = new THREE.Mesh(
      new THREE.ConeGeometry(5, 14, 10),
      CROWN_MAT
    );
    this.crown.position.y = 17;
    this.group.add(this.crown);

    // Glowing aura — a big translucent sphere around the crown
    this.aura = new THREE.Mesh(
      new THREE.SphereGeometry(8, 12, 12),
      AURA_MAT
    );
    this.aura.position.y = 16;
    this.group.add(this.aura);

    scene.add(this.group);
  }

  update(dt, t) {
    if (this.harvested) return;
    // Pulse the aura + emissive intensity so it's eye-catching from distance
    const pulse = 0.5 + Math.sin(t * 2 + this.position.x * 0.01) * 0.5;
    this.aura.material.opacity = 0.12 + pulse * 0.2;
    this.aura.scale.setScalar(1.0 + pulse * 0.15);
    TRUNK_MAT.emissiveIntensity = 0.8 + pulse * 0.6;
    CROWN_MAT.emissiveIntensity = 0.7 + pulse * 0.6;
  }

  harvest() {
    if (this.harvested) return;
    this.harvested = true;
    // Swap to dim materials — tree still exists visually but no longer blinks
    this.trunk.material = DIM_TRUNK_MAT;
    this.crown.material = DIM_CROWN_MAT;
    // Remove aura entirely
    this.group.remove(this.aura);
    this.aura.geometry.dispose();
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.isMesh) obj.geometry?.dispose?.();
    });
  }
}
