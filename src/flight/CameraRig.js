import * as THREE from 'three';
import { CHASE_DISTANCE, CHASE_HEIGHT, CHASE_LERP } from '../constants.js';

/** Simple third-person chase cam: sits behind and above the bird, smoothly follows. */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this._tmpOffset = new THREE.Vector3();
    this._tmpTarget = new THREE.Vector3();
  }

  snap(state) {
    this._tmpOffset.set(
      -Math.sin(state.yaw) * CHASE_DISTANCE,
      CHASE_HEIGHT,
      -Math.cos(state.yaw) * CHASE_DISTANCE,
    );
    this._tmpTarget.copy(state.position).sub(this._tmpOffset);
    this.camera.position.copy(this._tmpTarget);
    this.camera.lookAt(state.position);
  }

  update(state) {
    this._tmpOffset.set(
      -Math.sin(state.yaw) * CHASE_DISTANCE,
      CHASE_HEIGHT,
      -Math.cos(state.yaw) * CHASE_DISTANCE,
    );
    this._tmpTarget.copy(state.position).sub(this._tmpOffset);
    this.camera.position.lerp(this._tmpTarget, CHASE_LERP);
    this.camera.lookAt(state.position);
  }
}
