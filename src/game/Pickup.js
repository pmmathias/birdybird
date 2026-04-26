import * as THREE from 'three';

/**
 * Two pickup variants for Nest Quest mode:
 * - 'clock'  → +30 s on the timer
 * - 'speed'  → 30 s of doubled cruise speed
 *
 * Geometry/material are reused across instances per type to keep
 * scene-graph cost low.
 */

const CLOCK_FACE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffd040, transparent: true, opacity: 0.95, toneMapped: false,
});
const CLOCK_RIM_MAT = new THREE.MeshBasicMaterial({
  color: 0xb87a00, toneMapped: false,
});
const CLOCK_HAND_MAT = new THREE.MeshBasicMaterial({
  color: 0x222222, toneMapped: false,
});
const SPEED_MAT = new THREE.MeshBasicMaterial({
  color: 0x60d4ff, transparent: true, opacity: 0.95, toneMapped: false,
});
const SPEED_TIP_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false,
});

const CLOCK_FACE_GEO = new THREE.CylinderGeometry(4.5, 4.5, 0.6, 24);
const CLOCK_RIM_GEO = new THREE.TorusGeometry(4.5, 0.5, 10, 24);
const CLOCK_HAND_LONG_GEO = new THREE.BoxGeometry(0.3, 0.2, 3.6);
const CLOCK_HAND_SHORT_GEO = new THREE.BoxGeometry(0.3, 0.2, 2.4);

const CHEVRON_GEO = new THREE.ConeGeometry(2.5, 4.5, 4);

export class Pickup {
  /**
   * @param {'clock'|'speed'} type
   * @param {THREE.Vector3} position
   */
  constructor(type, position) {
    this.type = type;
    this.collected = false;
    this.baseY = position.y;
    this.phase = Math.random() * Math.PI * 2;

    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    if (type === 'clock') {
      this._buildClock();
    } else {
      this._buildSpeedArrow();
    }
  }

  _buildClock() {
    const face = new THREE.Mesh(CLOCK_FACE_GEO, CLOCK_FACE_MAT);
    face.rotation.x = Math.PI / 2;  // disc faces forward like a wall clock
    this.mesh.add(face);

    const rim = new THREE.Mesh(CLOCK_RIM_GEO, CLOCK_RIM_MAT);
    rim.rotation.x = Math.PI / 2;
    this.mesh.add(rim);

    // Two clock hands forming a "12 o'clock" T
    const handLong = new THREE.Mesh(CLOCK_HAND_LONG_GEO, CLOCK_HAND_MAT);
    handLong.position.set(0, 0, -0.4);
    this.mesh.add(handLong);
    const handShort = new THREE.Mesh(CLOCK_HAND_SHORT_GEO, CLOCK_HAND_MAT);
    handShort.rotation.y = Math.PI / 2;
    handShort.position.set(0, 0, -0.4);
    this.mesh.add(handShort);
  }

  _buildSpeedArrow() {
    // Three stacked chevrons trailing back from a bright tip — reads
    // as "speed boost" from any angle.
    const tip = new THREE.Mesh(CHEVRON_GEO, SPEED_TIP_MAT);
    tip.rotation.x = -Math.PI / 2;   // chevron points along world -Z
    tip.scale.setScalar(1.0);
    tip.position.z = -2;
    this.mesh.add(tip);
    for (let i = 0; i < 2; i++) {
      const chevron = new THREE.Mesh(CHEVRON_GEO, SPEED_MAT);
      chevron.rotation.x = -Math.PI / 2;
      chevron.scale.setScalar(0.85 - i * 0.18);
      chevron.position.z = (i + 1) * 1.6;
      this.mesh.add(chevron);
    }
  }

  update(dt, t) {
    this.mesh.rotation.y += dt * 1.0;
    this.mesh.position.y = this.baseY + Math.sin(t * 1.5 + this.phase) * 0.7;
  }

  dispose() {
    // Geometry/material are shared globals — only the Group needs unlinking.
  }
}
