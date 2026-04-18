import * as THREE from 'three';

/** Position, velocity, orientation of the bird. FLYING mode only. */
export class FlightState {
  constructor() {
    this.position = new THREE.Vector3(0, 30, 0);
    this.velocity = new THREE.Vector3(0, 0, 10);
    this.forward = new THREE.Vector3(0, 0, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.right = new THREE.Vector3(1, 0, 0);

    this.yaw = Math.PI;
    this.pitch = 0;
    this.roll = 0;

    this.speed = 10;
    this.altitude = 30;

    this.angleOfAttack = 0;
    this.liftCoefficient = 0;
    this.flapPhase = 0;
    this.flapCooldown = 0;
    this.flapStrengthScale = 1;
    this.wingSpread = 1.0;
  }

  updateVectors() {
    this.forward.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    ).normalize();

    const baseRight = new THREE.Vector3(
      Math.cos(this.yaw), 0, -Math.sin(this.yaw),
    ).normalize();

    const baseUp = new THREE.Vector3().crossVectors(baseRight, this.forward).normalize();

    this.up.copy(baseUp)
      .multiplyScalar(Math.cos(this.roll))
      .addScaledVector(baseRight, -Math.sin(this.roll));
    this.up.normalize();

    this.right.crossVectors(this.forward, this.up).normalize();

    this.speed = this.velocity.length();
    this.altitude = this.position.y;
  }
}
