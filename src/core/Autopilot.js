/**
 * Scripted autopilot for demo/testing.
 * Sequences of {action, duration} steps that override InputManager.
 *
 * Actions: 'flap', 'glide', 'dive', 'climb', 'turnLeft', 'turnRight',
 *          'flapLeft', 'flapRight', 'flapClimb'
 *
 * Usage:
 *   const autopilot = new Autopilot();
 *   autopilot.start(demoSequence);
 *   // in game loop: autopilot.update(dt, inputManager);
 */
export class Autopilot {
  constructor() {
    this.active = false;
    this._steps = [];
    this._currentStep = 0;
    this._stepTimer = 0;
  }

  /**
   * Start a scripted sequence.
   * @param {Array<{action: string, duration: number}>} steps
   */
  start(steps) {
    this._steps = steps;
    this._currentStep = 0;
    this._stepTimer = 0;
    this.active = true;
    console.log(`Autopilot started: ${steps.length} steps`);
  }

  stop() {
    this.active = false;
    this._steps = [];
    console.log('Autopilot stopped');
  }

  /**
   * Update autopilot and override input if active.
   * @param {number} dt
   * @param {import('./InputManager.js').InputManager} input
   * @returns {boolean} true if autopilot is controlling
   */
  update(dt, input) {
    if (!this.active || this._currentStep >= this._steps.length) {
      if (this.active) {
        this.active = false;
        console.log('Autopilot sequence complete');
      }
      return false;
    }

    const step = this._steps[this._currentStep];
    this._stepTimer += dt;

    // Apply action to input
    const a = step.action;
    input.lift = 0;
    input.roll = 0;
    input.pitch = 0;
    input.wingSpread = 1.0;

    if (a === 'flap' || a === 'flapLeft' || a === 'flapRight' || a === 'flapClimb') {
      input.lift = 1;
    }
    if (a === 'dive') {
      input.wingSpread = 0;
      input.pitch = -0.5;
    }
    if (a === 'climb' || a === 'flapClimb') {
      input.pitch = 0.6;
    }
    if (a === 'turnLeft' || a === 'flapLeft') {
      input.roll = 1;
    }
    if (a === 'turnRight' || a === 'flapRight') {
      input.roll = -1;
    }
    // 'glide' = all defaults (wingSpread=1, no input)

    // Advance step
    if (this._stepTimer >= step.duration) {
      this._stepTimer = 0;
      this._currentStep++;
      if (this._currentStep < this._steps.length) {
        console.log(`Autopilot step ${this._currentStep}/${this._steps.length}: ${this._steps[this._currentStep].action}`);
      }
    }

    return true;
  }
}

/**
 * Pre-built demo sequence: showcases flapping, gliding, turning, diving.
 */
export const DEMO_SEQUENCE = [
  { action: 'flapClimb', duration: 3 },
  { action: 'glide', duration: 2 },
  { action: 'flapLeft', duration: 3 },
  { action: 'glide', duration: 2 },
  { action: 'flapRight', duration: 3 },
  { action: 'flap', duration: 2 },
  { action: 'dive', duration: 3 },
  { action: 'flapClimb', duration: 3 },
  { action: 'turnLeft', duration: 4 },
  { action: 'glide', duration: 3 },
];
