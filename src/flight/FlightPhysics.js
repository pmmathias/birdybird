import * as THREE from 'three';
import { clamp } from '../utils/math.js';
import {
  GRAVITY, WING_AREA, AIR_DENSITY, BIRD_MASS,
  WING_INCIDENCE, CL_MAX, CL_SLOPE,
  CD_PARASITIC, CD_INDUCED_K,
  FLAP_THRUST, FLAP_DURATION, FLAP_COOLDOWN, FLAP_LIFT_BONUS,
  MAX_SPEED, TERMINAL_VELOCITY, MIN_FLIGHT_SPEED,
  BANK_RATE, PITCH_RATE, ROLL_RATE, MAX_ROLL, MAX_PITCH,
  GROUND_EFFECT_HEIGHT, GROUND_Y, GROUND_BIRD_OFFSET,
} from '../constants.js';

/**
 * Arcade-tuned aerodynamic flight physics. Ported from VogelSimulator
 * (FLYING mode only; grounded/landing/takeoff/underwater omitted for now).
 */
export class FlightPhysics {
  constructor(state) {
    this.state = state;
  }

  flap(strength = 1) {
    if (strength > 0 && this.state.flapCooldown <= 0) {
      this.state.flapPhase = FLAP_DURATION;
      this.state.flapStrengthScale = strength;
      this.state.flapCooldown = FLAP_COOLDOWN;
    }
  }

  applyRoll(rollInput, dt) {
    const targetRoll = rollInput * MAX_ROLL;
    this.state.roll += (targetRoll - this.state.roll) * ROLL_RATE * dt;
    this.state.yaw += this.state.roll * BANK_RATE * dt;
  }

  applyPitch(pitchInput, dt) {
    const targetPitch = pitchInput * MAX_PITCH;
    this.state.pitch += (targetPitch - this.state.pitch) * PITCH_RATE * dt;
    this.state.pitch = clamp(this.state.pitch, -MAX_PITCH - 0.1, MAX_PITCH + 0.1);
  }

  _computeAoA() {
    const s = this.state;
    const speed = s.velocity.length();
    if (speed < 0.5) return 0;
    const velDir = s.velocity.clone().normalize();
    const dot = clamp(velDir.dot(s.forward), -1, 1);
    const rawAoA = Math.acos(dot);
    const sign = velDir.dot(s.up) < 0 ? 1 : -1;
    return sign * rawAoA;
  }

  _computeCL(aoa) {
    const sign = Math.sign(aoa) || 1;
    return sign * Math.min(CL_SLOPE * Math.abs(aoa), CL_MAX);
  }

  update(dt) {
    const s = this.state;
    s.updateVectors();

    const speed = s.velocity.length();
    const dynamicPressure = 0.5 * AIR_DENSITY * speed * speed;
    const effectiveWingArea = WING_AREA * s.wingSpread;

    s.angleOfAttack = this._computeAoA();

    let CL = this._computeCL(s.angleOfAttack);
    if (s.flapPhase > 0) {
      const pitchFactor = clamp((s.pitch / MAX_PITCH) + 0.3, 0, 1);
      CL += FLAP_LIFT_BONUS * pitchFactor;
    }
    s.liftCoefficient = CL;

    const heightAboveGround = s.altitude - GROUND_Y;
    if (heightAboveGround > 0 && heightAboveGround < GROUND_EFFECT_HEIGHT) {
      CL *= 1.0 + 0.3 * (1 - heightAboveGround / GROUND_EFFECT_HEIGHT);
    }

    const liftMag = dynamicPressure * effectiveWingArea * Math.abs(CL) / BIRD_MASS;

    if (speed > 1) {
      const velNorm = s.velocity.clone().normalize();
      const liftDir = s.up.clone();
      liftDir.addScaledVector(velNorm, -liftDir.dot(velNorm));
      const liftDirLen = liftDir.length();
      if (liftDirLen > 0.01) {
        liftDir.divideScalar(liftDirLen);
        s.velocity.addScaledVector(liftDir, liftMag * Math.sign(CL) * dt);
      }
    }

    const baselineCL = CL_SLOPE * WING_INCIDENCE;
    const baselineLift = dynamicPressure * effectiveWingArea * baselineCL / BIRD_MASS;
    s.velocity.y += baselineLift * dt;

    const dragArea = Math.max(effectiveWingArea, WING_AREA * 0.15);
    const CD = CD_PARASITIC + CD_INDUCED_K * CL * CL;
    const dragMag = dynamicPressure * dragArea * CD / BIRD_MASS;
    if (speed > 0.1) {
      const dragDir = s.velocity.clone().normalize().negate();
      s.velocity.addScaledVector(dragDir, dragMag * dt);
    }

    s.velocity.y += GRAVITY * dt;

    if (s.flapPhase > 0) {
      const thrustAccel = FLAP_THRUST * (s.flapStrengthScale || 1) / BIRD_MASS;
      const pitchFactor = clamp((s.pitch / MAX_PITCH) * 0.5 + 0.5, 0.1, 1.0);
      const upComponent = pitchFactor * 0.5;
      const fwdComponent = 1.0 - upComponent * 0.5;
      const thrustDir = s.forward.clone().multiplyScalar(fwdComponent);
      thrustDir.y += upComponent;
      thrustDir.normalize();
      s.velocity.addScaledVector(thrustDir, thrustAccel * dt);
      s.flapPhase -= dt;
    }
    if (s.flapCooldown > 0) s.flapCooldown -= dt;

    if (speed > 2 && s.flapPhase <= 0) {
      const velDir = s.velocity.clone().normalize();
      const targetPitch = Math.asin(clamp(velDir.y, -0.8, 0.8));
      s.pitch += (targetPitch - s.pitch) * 0.8 * dt;
    }

    s.velocity.y = Math.max(s.velocity.y, TERMINAL_VELOCITY);
    const currentSpeed = s.velocity.length();
    if (currentSpeed > MAX_SPEED * 0.7) {
      const ratio = currentSpeed / MAX_SPEED;
      const excessDrag = Math.pow(ratio - 0.7, 2) * 30.0;
      s.velocity.multiplyScalar(1 - excessDrag * dt);
    }

    s.position.addScaledVector(s.velocity, dt);
    s.speed = s.velocity.length();
    s.altitude = s.position.y;

    // Flat ground enforcement (temporary until terrain lands)
    const minY = GROUND_Y + GROUND_BIRD_OFFSET;
    if (s.position.y < minY) {
      s.position.y = minY;
      if (s.velocity.y < 0) s.velocity.y = 0;
      s.pitch *= 0.9;
      if (s.speed < MIN_FLIGHT_SPEED) {
        s.velocity.addScaledVector(s.forward, MIN_FLIGHT_SPEED);
      }
    }
  }
}
