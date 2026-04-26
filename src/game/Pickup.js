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
  color: 0x60d4ff, transparent: true, opacity: 0.95,
  toneMapped: false, side: THREE.DoubleSide,
});
const SPEED_TIP_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.95,
  toneMapped: false, side: THREE.DoubleSide,
});

// Clock parts — all aligned to lie in the XY plane (face along +Z).
// Disc: CylinderGeometry's natural axis is +Y, so rotateX(π/2) lays the
// flat face along world XY with normal +Z. Rim: TorusGeometry's natural
// plane is XY already → no rotation needed (matches disc).
const CLOCK_FACE_GEO = new THREE.CylinderGeometry(4.5, 4.5, 0.6, 28).rotateX(Math.PI / 2);
const CLOCK_RIM_GEO = new THREE.TorusGeometry(4.5, 0.4, 10, 28);
// Hands lie in the disc plane — extent along Y for the minute hand,
// along X for the hour hand. Thin Z so they stick just out of the face.
const CLOCK_HAND_LONG_GEO = new THREE.BoxGeometry(0.35, 3.6, 0.2);
const CLOCK_HAND_SHORT_GEO = new THREE.BoxGeometry(2.4, 0.35, 0.2);

// Chevron arrow geometry — flat 5-vertex swoosh (V-shape with body) in
// the XZ plane, tip pointing +Z. DoubleSide material so it's visible
// from above and below as it rotates.
const CHEVRON_GEO = (() => {
  const g = new THREE.BufferGeometry();
  const vertices = new Float32Array([
     0,    0,  2.5,    // 0 tip
    -1.7,  0, -1.0,    // 1 left outer
    -0.5,  0, -0.2,    // 2 left inner
     0.5,  0, -0.2,    // 3 right inner
     1.7,  0, -1.0,    // 4 right outer
  ]);
  // Two triangles forming the chevron body
  const indices = [0, 2, 1,  0, 4, 3];
  g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
})();

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
    // All parts already pre-oriented in the geometry (face in XY plane,
    // normal +Z). The whole group rotates around Y so it's visible from
    // any angle as the bird approaches.
    this.mesh.add(new THREE.Mesh(CLOCK_FACE_GEO, CLOCK_FACE_MAT));
    this.mesh.add(new THREE.Mesh(CLOCK_RIM_GEO, CLOCK_RIM_MAT));

    // Hands sit just in front of the disc (slightly +Z) so they don't
    // z-fight with the face.
    const handLong = new THREE.Mesh(CLOCK_HAND_LONG_GEO, CLOCK_HAND_MAT);
    handLong.position.set(0, 0.8, 0.4);  // pointing up — minute at "12"
    this.mesh.add(handLong);
    const handShort = new THREE.Mesh(CLOCK_HAND_SHORT_GEO, CLOCK_HAND_MAT);
    handShort.position.set(0.6, 0, 0.4);  // pointing right — hour at "3"
    this.mesh.add(handShort);
  }

  _buildSpeedArrow() {
    // Three flat chevrons in a stagger pattern — middle one tallest +
    // brightest tip, outer two trail behind in dimmer cyan. The whole
    // group rotates slowly around Y so it's visible from any approach
    // angle and reads as "speed".
    const positions = [
      { y:  0.0, scale: 1.0,  mat: SPEED_TIP_MAT, z:  0 },
      { y:  0.0, scale: 0.85, mat: SPEED_MAT,    z: -1.4 },
      { y:  0.0, scale: 0.7,  mat: SPEED_MAT,    z: -2.7 },
    ];
    for (const cfg of positions) {
      const chevron = new THREE.Mesh(CHEVRON_GEO, cfg.mat);
      chevron.position.set(0, cfg.y, cfg.z);
      chevron.scale.setScalar(cfg.scale);
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
