import * as THREE from 'three';

// Shared geometry + material — cheap to render many instances.
// MeshBasicMaterial keeps rings visible on WebGPU too: MeshStandardMaterial
// needs an environment map for its metalness term, and we currently skip
// PMREM on WebGPU (r184 SkyMesh bug), so the metalness lobe rendered black
// and swallowed most of the ring. Basic + bright color (toneMapped off so
// it pops) gets the glowing look without lighting data.
const RING_GEOMETRY = new THREE.TorusGeometry(6, 0.6, 12, 28);
const RING_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xffd050,
  transparent: true,
  opacity: 0.95,
  toneMapped: false,
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
