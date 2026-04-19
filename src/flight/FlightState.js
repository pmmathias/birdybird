import * as THREE from 'three';
import { FLIGHT_MODE } from '../constants.js';

/**
 * Holds the bird's flight state: position, velocity, orientation.
 */
export class FlightState {
  constructor() {
    this.position = new THREE.Vector3(0, 150, 0);
    this.velocity = new THREE.Vector3(0, 0, 10); // initial forward speed (matches yaw=π → forward +Z)
    this.forward = new THREE.Vector3(0, 0, -1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.right = new THREE.Vector3(1, 0, 0);

    // Euler angles (radians)
    this.yaw = Math.PI;    // facing -Z
    this.pitch = 0;
    this.roll = 0;

    // Derived values
    this.speed = 10;
    this.altitude = 60;

    // Flight mode state machine: FLYING → LANDING → GROUNDED → TAKEOFF → FLYING
    this.mode = FLIGHT_MODE.FLYING;
    this.takeoffTimer = 0;  // counts down during TAKEOFF
    this.landingTimer = 0;  // counts up during LANDING flare

    // Aerodynamic state (computed each frame, exposed for HUD/debug)
    this.angleOfAttack = 0;
    this.liftCoefficient = 0;
    this.isStalling = false;
    this.flapPhase = 0;          // >0 = in downstroke (counts down)
    this.flapCooldown = 0;       // counts down to 0
    this.flapStrengthScale = 1;  // thrust multiplier from input strength
    this.wingSpread = 1.0;   // 0 = wings tucked, 1 = fully spread
  }

  /** Update derived vectors from euler angles */
  updateVectors() {
    // Forward vector from yaw and pitch
    this.forward.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    ).normalize();

    // Base right vector (in XZ plane)
    const baseRight = new THREE.Vector3(
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw),
    ).normalize();

    // Base up (before roll)
    const baseUp = new THREE.Vector3().crossVectors(baseRight, this.forward).normalize();

    // Apply roll: rotate baseUp around forward axis
    // Negate sin(roll) because baseRight points left in this coordinate system
    this.up.copy(baseUp)
      .multiplyScalar(Math.cos(this.roll))
      .addScaledVector(baseRight, -Math.sin(this.roll));
    this.up.normalize();

    // Update right to be consistent with rolled up
    this.right.crossVectors(this.forward, this.up).normalize();

    this.speed = this.velocity.length();
    this.altitude = this.position.y;
  }
}
