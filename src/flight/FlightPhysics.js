import * as THREE from 'three';
import { clamp } from '../utils/math.js';
import {
  GRAVITY, WING_AREA, AIR_DENSITY, BIRD_MASS,
  WING_INCIDENCE, CL_MAX, CL_SLOPE,
  CD_PARASITIC, CD_INDUCED_K,
  FLAP_THRUST, FLAP_DURATION, FLAP_COOLDOWN, FLAP_LIFT_BONUS,
  MAX_SPEED, TERMINAL_VELOCITY, MIN_FLIGHT_SPEED,
  BANK_RATE, PITCH_RATE, ROLL_RATE, MAX_ROLL, MAX_PITCH,
  FLIGHT_MODE, WALK_SPEED, WALK_SPRINT_SPEED, LANDING_SPEED_THRESHOLD, LANDING_ALTITUDE_MARGIN,
  TAKEOFF_IMPULSE, TAKEOFF_DURATION, GROUND_OFFSET, GROUND_EFFECT_HEIGHT, JUMP_IMPULSE,
} from '../constants.js';

/**
 * Aerodynamic flight physics for a soaring bird.
 * All forces derive from airspeed, angle of attack, and wing area.
 */
export class FlightPhysics {
  /**
   * @param {import('./FlightState.js').FlightState} state
   */
  constructor(state) {
    this.state = state;
  }

  /**
   * Initiate a flap (timed downstroke, not an impulse).
   * @param {number} strength - 0..1
   */
  flap(strength) {
    if (strength > 0 && this.state.flapCooldown <= 0) {
      this.state.flapPhase = FLAP_DURATION; // always full duration
      this.state.flapStrengthScale = strength; // scale thrust by strength
      this.state.flapCooldown = FLAP_COOLDOWN;
    }
  }

  /**
   * Apply roll input for banking turns.
   * @param {number} rollInput - -1..1
   * @param {number} dt
   */
  applyRoll(rollInput, dt) {
    const targetRoll = rollInput * MAX_ROLL;
    this.state.roll += (targetRoll - this.state.roll) * ROLL_RATE * dt;
    this.state.yaw += this.state.roll * BANK_RATE * dt;
  }

  /**
   * Apply pitch input.
   * @param {number} pitchInput - -1..1
   * @param {number} dt
   */
  applyPitch(pitchInput, dt) {
    const targetPitch = pitchInput * MAX_PITCH;
    this.state.pitch += (targetPitch - this.state.pitch) * PITCH_RATE * dt;
    this.state.pitch = clamp(this.state.pitch, -MAX_PITCH - 0.1, MAX_PITCH + 0.1);
  }

  /**
   * Compute angle of attack: angle between velocity and forward vector.
   * Positive AoA = nose above flight path (generating lift).
   * @returns {number} radians
   */
  _computeAoA() {
    const s = this.state;
    const speed = s.velocity.length();
    if (speed < 0.5) return 0;

    const velDir = s.velocity.clone().normalize();
    const dot = clamp(velDir.dot(s.forward), -1, 1);
    const rawAoA = Math.acos(dot);

    // Sign: positive when pitched up relative to velocity
    const sign = velDir.dot(s.up) < 0 ? 1 : -1;
    return sign * rawAoA;
  }

  /**
   * Compute lift coefficient from AoA. Simple linear model clamped to CL_MAX.
   * No stall — keeps flight predictable and fun.
   * @param {number} aoa - angle of attack in radians
   * @returns {number} lift coefficient
   */
  _computeCL(aoa) {
    const sign = Math.sign(aoa) || 1;
    return sign * Math.min(CL_SLOPE * Math.abs(aoa), CL_MAX);
  }

  /**
   * Main physics step — aerodynamic force model.
   * @param {number} dt - delta time in seconds
   * @param {number} [terrainHeight=0] - ground height at current position
   * @param {object} [groundInput] - ground movement input { forward, strafe, turn, jump, sprint }
   */
  update(dt, terrainHeight = 0, groundInput) {
    const s = this.state;

    // Handle grounded/takeoff modes separately
    if (s.mode === FLIGHT_MODE.GROUNDED) {
      this._updateGrounded(dt, terrainHeight, groundInput);
      return;
    }
    if (s.mode === FLIGHT_MODE.TAKEOFF) {
      this._updateTakeoff(dt, terrainHeight);
      return;
    }

    s.updateVectors();

    const speed = s.velocity.length();
    const dynamicPressure = 0.5 * AIR_DENSITY * speed * speed;

    // Effective wing area based on wing spread (arms up = full, arms down = tucked)
    const effectiveWingArea = WING_AREA * s.wingSpread;

    // --- 1. Angle of Attack ---
    s.angleOfAttack = this._computeAoA();

    // --- 2. Lift coefficient ---
    let CL = this._computeCL(s.angleOfAttack);
    // Flap lift bonus is now pitch-dependent (see flap thrust section below)
    // Only a small residual CL bonus during flap to avoid unintended climb at level flight
    if (s.flapPhase > 0) {
      const pitchFactor = clamp((s.pitch / MAX_PITCH) + 0.3, 0, 1);
      CL += FLAP_LIFT_BONUS * pitchFactor; // full bonus only when pitched up
    }
    s.liftCoefficient = CL;
    s.isStalling = false;

    // --- Ground effect: up to 30% more lift near terrain/water ---
    const heightAboveGround = s.altitude - terrainHeight;
    if (heightAboveGround > 0 && heightAboveGround < GROUND_EFFECT_HEIGHT) {
      const geFactor = 1.0 + 0.3 * (1 - heightAboveGround / GROUND_EFFECT_HEIGHT);
      CL *= geFactor;
    }

    // --- 3. Lift force ---
    // Direction: bird's up vector projected perpendicular to velocity
    // When banked, up tilts sideways → vertical lift component decreases
    // When wings tucked (wingSpread→0), no lift → free fall
    const liftMag = dynamicPressure * effectiveWingArea * Math.abs(CL) / BIRD_MASS;

    if (speed > 1) {
      const velNorm = s.velocity.clone().normalize();
      const liftDir = s.up.clone();
      // Remove velocity-parallel component so lift is perpendicular to flight path
      liftDir.addScaledVector(velNorm, -liftDir.dot(velNorm));
      const liftDirLen = liftDir.length();
      if (liftDirLen > 0.01) {
        liftDir.divideScalar(liftDirLen);
        s.velocity.addScaledVector(liftDir, liftMag * Math.sign(CL) * dt);
      }
    }

    // --- 4. Baseline lift from wing incidence ---
    // Wing is mounted at slight angle → always some upward lift proportional to speed²
    // This acts in world-up direction (not tilted by roll/AoA) to prevent stall death spiral
    const baselineCL = CL_SLOPE * WING_INCIDENCE;
    const baselineLift = dynamicPressure * effectiveWingArea * baselineCL / BIRD_MASS;
    s.velocity.y += baselineLift * dt;

    // --- 5. Drag: parasitic + induced ---
    // Body always has some drag even with tucked wings (min 15% wing area for drag)
    const dragArea = Math.max(effectiveWingArea, WING_AREA * 0.15);
    const CD = CD_PARASITIC + CD_INDUCED_K * CL * CL;
    const dragMag = dynamicPressure * dragArea * CD / BIRD_MASS;
    if (speed > 0.1) {
      const dragDir = s.velocity.clone().normalize().negate();
      s.velocity.addScaledVector(dragDir, dragMag * dt);
    }

    // --- 6. Gravity ---
    s.velocity.y += GRAVITY * dt;

    // --- 7. Flap thrust (timed downstroke) — pitch-dependent direction ---
    // Level flight: mostly forward (80/20). Climbing: even split. Diving: almost all forward.
    if (s.flapPhase > 0) {
      const thrustAccel = FLAP_THRUST * (s.flapStrengthScale || 1) / BIRD_MASS;
      // pitchFactor: 0.1 at full dive, 0.5 at level, 1.0 at full climb
      const pitchFactor = clamp((s.pitch / MAX_PITCH) * 0.5 + 0.5, 0.1, 1.0);
      const upComponent = pitchFactor * 0.5;           // 0.05..0.5
      const fwdComponent = 1.0 - upComponent * 0.5;    // 0.75..0.975
      const thrustDir = s.forward.clone().multiplyScalar(fwdComponent);
      thrustDir.y += upComponent;
      thrustDir.normalize();
      s.velocity.addScaledVector(thrustDir, thrustAccel * dt);
      s.flapPhase -= dt;
    }
    if (s.flapCooldown > 0) {
      s.flapCooldown -= dt;
    }

    // --- 8. Auto-trim pitch toward velocity ---
    // DISABLED during dive AND flap — prevents fighting thrust direction
    if (speed > 2 && s.wingSpread > 0.5 && s.flapPhase <= 0) {
      const velDir = s.velocity.clone().normalize();
      const targetPitch = Math.asin(clamp(velDir.y, -0.8, 0.8));
      s.pitch += (targetPitch - s.pitch) * 0.8 * dt; // gentle auto-trim
    }

    // --- 9. Wing tuck → nosedive ---
    if (s.wingSpread < 0.5) {
      const tuckForce = (1 - s.wingSpread / 0.5); // 0→1 as wings tuck

      // Aggressive pitch down — no resistance
      s.pitch -= tuckForce * 15.0 * dt;
      s.pitch = clamp(s.pitch, -Math.PI * 0.45, MAX_PITCH);

      // Strong dive acceleration
      s.velocity.y += GRAVITY * 1.0 * tuckForce * dt;

      // Redirect horizontal velocity downward (like pointing nose down)
      // This makes the dive feel immediate instead of coasting
      const hSpeed = Math.sqrt(s.velocity.x * s.velocity.x + s.velocity.z * s.velocity.z);
      if (hSpeed > 5 && s.pitch < -0.2) {
        const redirectRate = tuckForce * 3.0 * dt;
        const redirectAmount = hSpeed * redirectRate;
        s.velocity.y -= redirectAmount;
        // Reduce horizontal speed proportionally
        const hScale = Math.max(0, 1 - redirectRate);
        s.velocity.x *= hScale;
        s.velocity.z *= hScale;
      }

      // Push in dive direction for speed buildup
      s.velocity.addScaledVector(s.forward, 8.0 * tuckForce * dt);
    }

    // --- 10. Underwater physics ---
    if (s.altitude < 15) { // WATER_LEVEL = 15
      // Water drag (moderate — still allows flap to work)
      s.velocity.multiplyScalar(1 - 1.0 * dt);
      // Strong buoyancy — bird naturally floats up
      s.velocity.y += 8.0 * dt;
      // Flap works extra well underwater (like swimming upward)
      if (s.flapPhase > 0) {
        s.velocity.y += 15.0 * dt;
      }
    }

    // --- 11. Speed limiting (progressive drag — no hard clamp) ---
    s.velocity.y = Math.max(s.velocity.y, TERMINAL_VELOCITY);
    const currentSpeed = s.velocity.length();
    if (currentSpeed > MAX_SPEED * 0.7) {
      // Exponential drag above 70% max speed — impossible to exceed max
      const ratio = currentSpeed / MAX_SPEED;
      const excessDrag = Math.pow(ratio - 0.7, 2) * 30.0; // strong quadratic drag
      s.velocity.multiplyScalar(1 - excessDrag * dt);
    }

    // --- 12. Integrate position ---
    s.position.addScaledVector(s.velocity, dt);
    s.speed = s.velocity.length();
    s.altitude = s.position.y;

    // --- 13. Landing transition check ---
    // FLYING → LANDING when slow + near ground + not climbing
    if (s.mode === FLIGHT_MODE.FLYING &&
        s.speed < LANDING_SPEED_THRESHOLD &&
        heightAboveGround < LANDING_ALTITUDE_MARGIN &&
        s.pitch <= 0.05 &&
        terrainHeight >= 14) { // don't land on water
      s.mode = FLIGHT_MODE.LANDING;
      s.landingTimer = 0; // track landing progress
    }

    // LANDING: flare — wings spread, pitch up gradually, decelerate
    if (s.mode === FLIGHT_MODE.LANDING) {
      s.landingTimer = (s.landingTimer || 0) + dt;
      const progress = clamp(s.landingTimer / 1.5, 0, 1); // 1.5s landing flare

      // Flare: pitch nose up gradually (like a bird braking)
      s.pitch += (0.4 - s.pitch) * 2.0 * dt; // nose up to ~25°
      s.roll *= 0.9; // level out roll

      // Wings fully spread for braking
      s.wingSpread = 1.0;

      // Decelerate horizontally
      const hSpeed = Math.sqrt(s.velocity.x * s.velocity.x + s.velocity.z * s.velocity.z);
      if (hSpeed > 0.5) {
        const drag = Math.min(8.0 * dt, hSpeed * 0.5);
        s.velocity.x *= 1 - drag / hSpeed;
        s.velocity.z *= 1 - drag / hSpeed;
      }

      // Gentle descent
      if (s.velocity.y > -1.5) s.velocity.y -= 2.0 * dt;
      s.velocity.y = Math.max(s.velocity.y, -2.0); // cap descent rate

      // Touchdown
      if (heightAboveGround <= GROUND_OFFSET + 0.3) {
        s.mode = FLIGHT_MODE.GROUNDED;
        s.velocity.set(0, 0, 0);
        s.position.y = terrainHeight + GROUND_OFFSET;
        s.pitch = 0;
        s.roll = 0;
        s.speed = 0;
      }
    }
  }

  /**
   * Grounded physics: walking on terrain with WASD controls.
   * @param {object} groundInput - { forward, strafe, turn, jump, sprint }
   */
  _updateGrounded(dt, terrainHeight, groundInput = {}) {
    const s = this.state;

    // Turning (arrow keys / mouse)
    s.yaw += (groundInput.turn || 0) * 2.5 * dt;

    s.updateVectors();

    // Terrain following
    s.altitude = s.position.y;
    s.pitch = 0;
    s.roll = 0;
    s.angleOfAttack = 0;
    s.liftCoefficient = 0;

    // Movement: forward/backward + strafe
    const fwd = groundInput.forward || 0; // -1..1
    const strafe = groundInput.strafe || 0; // -1..1
    const sprint = groundInput.sprint ? WALK_SPRINT_SPEED : WALK_SPEED;

    const forwardDir = new THREE.Vector3(
      -Math.sin(s.yaw), 0, -Math.cos(s.yaw),
    );
    const rightDir = new THREE.Vector3(
      -Math.cos(s.yaw), 0, Math.sin(s.yaw),
    );

    s.velocity.set(0, 0, 0);
    s.velocity.addScaledVector(forwardDir, fwd * sprint);
    s.velocity.addScaledVector(rightDir, strafe * sprint);
    s.position.addScaledVector(s.velocity, dt);
    s.speed = s.velocity.length();

    // Snap to terrain
    s.position.y = terrainHeight + GROUND_OFFSET;
    s.altitude = s.position.y;
  }

  /**
   * Takeoff: brief upward launch, then transition back to FLYING.
   */
  _updateTakeoff(dt, terrainHeight) {
    const s = this.state;
    s.takeoffTimer -= dt;

    if (s.takeoffTimer <= 0) {
      // Transition to flying
      s.mode = FLIGHT_MODE.FLYING;
      s.takeoffTimer = 0;
      return;
    }

    s.updateVectors();

    // Strong upward + forward impulse during takeoff
    const progress = 1 - (s.takeoffTimer / TAKEOFF_DURATION); // 0→1
    s.velocity.y += TAKEOFF_IMPULSE * 2.0 * dt * (1 - progress); // decreasing upward force
    const fwdDir = new THREE.Vector3(
      -Math.sin(s.yaw), 0, -Math.cos(s.yaw),
    ).normalize();
    s.velocity.addScaledVector(fwdDir, 12.0 * dt); // forward acceleration

    // Pitch up during takeoff
    s.pitch = 0.3 * (1 - progress);
    s.roll = 0;

    // Integrate position
    s.position.addScaledVector(s.velocity, dt);
    s.speed = s.velocity.length();
    s.altitude = s.position.y;
  }

  /**
   * Trigger takeoff from grounded state.
   */
  takeoff() {
    const s = this.state;
    if (s.mode !== FLIGHT_MODE.GROUNDED) return;
    s.mode = FLIGHT_MODE.TAKEOFF;
    s.takeoffTimer = TAKEOFF_DURATION;
    s.wingSpread = 1.0;
    // Initial kick
    s.velocity.set(0, TAKEOFF_IMPULSE * 0.5, 0);
    const fwd = new THREE.Vector3(
      -Math.sin(s.yaw), 0, -Math.cos(s.yaw),
    ).normalize();
    s.velocity.addScaledVector(fwd, MIN_FLIGHT_SPEED);
  }

  /**
   * Enforce terrain collision (minimum altitude).
   * @param {number} terrainHeight - ground height at current position
   */
  enforceGround(terrainHeight) {
    // Skip for grounded/takeoff/landing modes (handled by their own methods)
    if (this.state.mode !== FLIGHT_MODE.FLYING) return;

    // Underwater: allow diving but enforce seabed collision (max 30m below water)
    if (terrainHeight < 14) {
      const seabed = Math.max(terrainHeight, -80) + 1.0; // allow deep canyons
      if (this.state.position.y < seabed) {
        this.state.position.y = seabed;
        if (this.state.velocity.y < 0) this.state.velocity.y = 0;
      }
      return;
    }
    const minAlt = terrainHeight + 1.0;
    if (this.state.position.y < minAlt) {
      this.state.position.y = minAlt;
      if (this.state.velocity.y < 0) {
        this.state.velocity.y = 0;
      }
      this.state.pitch *= 0.9;
      // Ensure minimum forward speed so the bird can recover
      if (this.state.speed < MIN_FLIGHT_SPEED) {
        this.state.velocity.addScaledVector(this.state.forward, MIN_FLIGHT_SPEED);
      }
    }
  }
}
