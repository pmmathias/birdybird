/**
 * DeviceOrientation-based tilt input with permission handling, calibration,
 * dead-zone, low-pass smoothing, and clamped normalized output.
 *
 * Usage:
 *   const tilt = new TiltInput();
 *   await tilt.requestPermission();   // triggers iOS prompt, attaches listener
 *   // in game loop:
 *   tilt.update();
 *   bird.rotation.z = -tilt.roll * MAX_BANK;
 *   bird.rotation.x = tilt.pitch * MAX_PITCH;
 */

export const TILT_STATE = Object.freeze({
  IDLE: 'idle',
  UNSUPPORTED: 'unsupported',
  PROMPT_NEEDED: 'prompt-needed',
  REQUESTING: 'requesting',
  GRANTED: 'granted',
  DENIED: 'denied',
  ERROR: 'error',
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class TiltInput {
  constructor({
    smoothing = 0.2,
    deadZoneDeg = 3,
    maxRollDeg = 45,
    maxPitchDeg = 30,
  } = {}) {
    this.roll = 0;
    this.pitch = 0;

    this.smoothing = smoothing;
    this.deadZoneDeg = deadZoneDeg;
    this.maxRollDeg = maxRollDeg;
    this.maxPitchDeg = maxPitchDeg;

    this._rawBeta = 0;
    this._rawGamma = 0;
    this._smoothedBeta = 0;
    this._smoothedGamma = 0;
    this._calibratedBeta = 0;
    this._calibratedGamma = 0;

    this._eventCount = 0;
    this._lastEventAt = 0;
    this._autoCalibrateOnNext = false;

    const hasDOE = typeof DeviceOrientationEvent !== 'undefined';
    this._needsPermission = hasDOE && typeof DeviceOrientationEvent.requestPermission === 'function';

    if (!hasDOE) {
      this.state = TILT_STATE.UNSUPPORTED;
    } else if (this._needsPermission) {
      this.state = TILT_STATE.PROMPT_NEEDED;
    } else {
      this.state = TILT_STATE.IDLE;
    }

    this._onOrientation = this._onOrientation.bind(this);
  }

  get active() {
    return this.state === TILT_STATE.GRANTED;
  }

  get eventCount() {
    return this._eventCount;
  }

  get hasRecentEvents() {
    return performance.now() - this._lastEventAt < 500;
  }

  async requestPermission() {
    if (this.state === TILT_STATE.UNSUPPORTED) return this.state;

    if (!this._needsPermission) {
      this._attach();
      this.state = TILT_STATE.GRANTED;
      return this.state;
    }

    this.state = TILT_STATE.REQUESTING;
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result === 'granted') {
        this._attach();
        this.state = TILT_STATE.GRANTED;
      } else {
        this.state = TILT_STATE.DENIED;
      }
    } catch (err) {
      console.error('[TiltInput] permission error:', err);
      this.state = TILT_STATE.ERROR;
    }
    return this.state;
  }

  calibrate() {
    this._calibratedBeta = this._rawBeta;
    this._calibratedGamma = this._rawGamma;
    this._smoothedBeta = 0;
    this._smoothedGamma = 0;
  }

  update() {
    if (!this.active) {
      this.roll = 0;
      this.pitch = 0;
      return;
    }

    const deltaBeta = this._rawBeta - this._calibratedBeta;
    const deltaGamma = this._rawGamma - this._calibratedGamma;

    this._smoothedBeta += (deltaBeta - this._smoothedBeta) * this.smoothing;
    this._smoothedGamma += (deltaGamma - this._smoothedGamma) * this.smoothing;

    const dzBeta = Math.abs(this._smoothedBeta) < this.deadZoneDeg ? 0 : this._smoothedBeta;
    const dzGamma = Math.abs(this._smoothedGamma) < this.deadZoneDeg ? 0 : this._smoothedGamma;

    this.pitch = clamp(dzBeta / this.maxPitchDeg, -1, 1);
    this.roll = clamp(dzGamma / this.maxRollDeg, -1, 1);
  }

  destroy() {
    window.removeEventListener('deviceorientation', this._onOrientation);
    this.state = TILT_STATE.IDLE;
  }

  _attach() {
    window.addEventListener('deviceorientation', this._onOrientation);
    this._autoCalibrateOnNext = true;
  }

  _onOrientation(e) {
    this._rawBeta = e.beta ?? 0;
    this._rawGamma = e.gamma ?? 0;
    this._eventCount++;
    this._lastEventAt = performance.now();

    if (this._autoCalibrateOnNext) {
      this.calibrate();
      this._autoCalibrateOnNext = false;
    }
  }
}
