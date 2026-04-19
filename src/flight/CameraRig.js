import * as THREE from 'three';
import { CHASE_DISTANCE, CHASE_HEIGHT, CAMERA_FOV, FLIGHT_MODE } from '../constants.js';

/**
 * Smooth third-person chase camera.
 * All transitions are interpolated to prevent jitter at high speed.
 */
export class CameraRig {
  constructor(camera, flightState) {
    this.camera = camera;
    this.state = flightState;
    this._pos = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._roll = 0;
    this._fov = CAMERA_FOV;
    this._initialized = false;
  }

  update(dt) {
    const s = this.state;

    const grounded = s.mode === FLIGHT_MODE.GROUNDED || s.mode === FLIGHT_MODE.LANDING;

    // Camera distance/height: tighter and lower when grounded
    const chaseDist = grounded ? CHASE_DISTANCE * 0.5 : CHASE_DISTANCE;
    const chaseHeight = grounded ? CHASE_HEIGHT * 0.4 : CHASE_HEIGHT;

    // Desired position: behind and above bird
    const desiredPos = s.position.clone()
      .addScaledVector(s.forward, -chaseDist)
      .add(new THREE.Vector3(0, chaseHeight, 0));

    // Desired look target: bird position
    const desiredLook = s.position.clone();

    if (!this._initialized) {
      this._pos.copy(desiredPos);
      this._lookTarget.copy(desiredLook);
      this._initialized = true;
    }

    // Position slightly lazy to reveal flock, lookAt stays tight
    const posRate = 1 - Math.exp(-2.5 * dt);
    const lookRate = 1 - Math.exp(-3.0 * dt);
    this._pos.lerp(desiredPos, posRate);
    this._lookTarget.lerp(desiredLook, lookRate);

    // Smooth roll
    this._roll += (s.roll * 0.4 - this._roll) * posRate;

    // Smooth FOV
    const speedRatio = s.speed / 40;
    const targetFov = CAMERA_FOV + Math.max(0, (speedRatio - 1.5)) * 15;
    this._fov += (targetFov - this._fov) * posRate;

    // Apply
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._lookTarget);

    // Roll as pure rotation around forward axis
    if (Math.abs(this._roll) > 0.001) {
      const camQuat = this.camera.quaternion.clone();
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1), this._roll
      );
      this.camera.quaternion.copy(camQuat).multiply(rollQuat);
    }

    this.camera.fov = this._fov;
    this.camera.updateProjectionMatrix();
  }
}
