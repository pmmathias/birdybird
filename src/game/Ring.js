import * as THREE from 'three';

// Shared geometry + material — cheap to render many instances
const RING_GEOMETRY = new THREE.TorusGeometry(6, 0.6, 12, 28);
const RING_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xffdd44,
  emissive: 0xffaa22,
  emissiveIntensity: 0.85,
  metalness: 0.35,
  roughness: 0.3,
  transparent: true,
  opacity: 0.92,
});

/** A single collectible ring. Shares geometry/material across instances. */
export class Ring {
  constructor(position) {
    this.mesh = new THREE.Mesh(RING_GEOMETRY, RING_MATERIAL);
    this.mesh.position.copy(position);
    this.baseY = position.y;
    this.phase = Math.random() * Math.PI * 2;
    this.collected = false;
  }

  update(dt, t) {
    this.mesh.rotation.y += dt * 1.2;
    this.mesh.rotation.x += dt * 0.35;
    this.mesh.position.y = this.baseY + Math.sin(t * 1.5 + this.phase) * 0.7;
  }
}
