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

// Chevron arm: a tube from one end to the other. We build it as a
// CylinderGeometry pre-translated so its base is at the origin and its
// length runs along +Y; then per-instance rotation aims it from the
// shoulder point to the tip.
const ARM_RADIUS = 0.32;
function _buildArmGeo(length) {
  const g = new THREE.CylinderGeometry(ARM_RADIUS, ARM_RADIUS, length, 8);
  g.translate(0, length / 2, 0);  // pivot at base end
  return g;
}
// Tip ball — small sphere at the chevron point so the join looks clean
const TIP_BALL_GEO = new THREE.IcosahedronGeometry(ARM_RADIUS * 1.4, 0);

const _UP = new THREE.Vector3(0, 1, 0);
const _TMP_DIR = new THREE.Vector3();

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
    // Three 3D chevrons in a stagger pattern, each a pair of cylinder
    // arms meeting at a tip ball. Looks the same from above and below
    // because the arms ARE 3D — the previous flat-triangle version
    // disappeared when viewed edge-on from below.
    const cfgs = [
      { z:  0.0, scale: 1.0,  mat: SPEED_TIP_MAT },
      { z: -1.6, scale: 0.85, mat: SPEED_MAT },
      { z: -3.0, scale: 0.7,  mat: SPEED_MAT },
    ];
    for (const cfg of cfgs) {
      const chev = this._buildChevron(cfg.scale, cfg.mat);
      chev.position.z = cfg.z;
      this.mesh.add(chev);
    }
  }

  /** A single 3D chevron — two cylinder arms meeting at a tip ball,
   *  pointing along +Z (forward) with the V opening backward. */
  _buildChevron(scale, mat) {
    const grp = new THREE.Group();
    const tip   = new THREE.Vector3(0, 0,  2.5 * scale);
    const left  = new THREE.Vector3(-1.7 * scale, 0, -1.0 * scale);
    const right = new THREE.Vector3( 1.7 * scale, 0, -1.0 * scale);

    grp.add(this._buildArm(left, tip, mat, scale));
    grp.add(this._buildArm(right, tip, mat, scale));

    // Tip sphere so the two arms blend cleanly at the apex
    const ball = new THREE.Mesh(TIP_BALL_GEO, mat);
    ball.position.copy(tip);
    ball.scale.setScalar(scale);
    grp.add(ball);
    return grp;
  }

  _buildArm(from, to, mat, scale) {
    _TMP_DIR.copy(to).sub(from);
    const len = _TMP_DIR.length();
    const geo = _buildArmGeo(len);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from);
    // Aim the cylinder's local +Y at the (to-from) direction
    mesh.quaternion.setFromUnitVectors(_UP, _TMP_DIR.clone().normalize());
    mesh.scale.set(scale, 1, scale);  // thicken proportionally with size
    return mesh;
  }

  update(dt, t) {
    this.mesh.rotation.y += dt * 1.0;
    this.mesh.position.y = this.baseY + Math.sin(t * 1.5 + this.phase) * 0.7;
  }

  dispose() {
    // Geometry/material are shared globals — only the Group needs unlinking.
  }
}
