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
    window.addEventListener('orientationchange', this._onOrientationChange);
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener('change', this._onOrientationChange);
    }
    this._autoCalibrateOnNext = true;
  }

  _getScreenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') {
      return screen.orientation.angle;
    }
    // Safari fallback on older iOS
    return typeof window.orientation === 'number' ? window.orientation : 0;
  }

  _onOrientationChange = () => {
    // Orientation swap invalidates the calibration zero — re-calibrate on next event
    this._autoCalibrateOnNext = true;
  };

  _onOrientation(e) {
    const beta = e.beta ?? 0;
    const gamma = e.gamma ?? 0;
    const angle = this._getScreenAngle();
    this._screenAngle = angle;
    this._sensorBeta = beta;
    this._sensorGamma = gamma;

    // Remap raw sensor axes (device frame) to a consistent pitch/roll (screen frame).
    // _rawBeta → used as pitch source, _rawGamma → used as roll source.
    // In portrait, beta = front/back tilt, gamma = left/right tilt.
    // In landscape, these swap roles.
    switch (angle) {
      case 90:   // landscape, top-of-device to the right
        this._rawBeta = gamma;
        this._rawGamma = -beta;
        break;
      case -90:
      case 270:  // landscape, top-of-device to the left
        this._rawBeta = -gamma;
        this._rawGamma = beta;
        break;
      case 180:  // portrait upside-down
        this._rawBeta = -beta;
        this._rawGamma = -gamma;
        break;
      default:   // portrait (0)
        this._rawBeta = beta;
        this._rawGamma = gamma;
        break;
    }

    this._eventCount++;
    this._lastEventAt = performance.now();

    if (this._autoCalibrateOnNext) {
      this.calibrate();
      this._autoCalibrateOnNext = false;
    }
  }

  /** Live-Debug-Info for on-screen HUD. */
  get debug() {
    return {
      angle: this._screenAngle ?? 0,
      sensorBeta: this._sensorBeta ?? 0,
      sensorGamma: this._sensorGamma ?? 0,
      remappedBeta: this._rawBeta,
      remappedGamma: this._rawGamma,
      calBeta: this._calibratedBeta,
      calGamma: this._calibratedGamma,
    };
  }
}
