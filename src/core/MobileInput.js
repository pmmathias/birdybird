import { clamp } from '../utils/math.js';

/**
 * Mobile gyroscope input for flight control.
 *
 * Landscape mode (phone horizontal, screen facing up/toward you):
 * - Tilt phone toward you → climb
 * - Tilt phone away from you → dive
 * - Tilt phone left → turn left
 * - Tilt phone right → turn right
 * - Shake → flap burst
 */
export class MobileInput {
  constructor() {
    this.available = false;
    this.active = false;

    // Outputs
    this.pitch = 0;
    this.roll = 0;
    this.lift = 0;
    this.wingSpread = 1;

    // Calibration profile (set by CalibrationWizard)
    this._profile = null;
    this._pendingCalibration = false;

    // Shake
    this._lastAccel = { x: 0, y: 0, z: 0 };
    this._shakeThreshold = 12;
    this._lastShakeTime = 0;
    this._shakeFreezeUntil = 0;
    this._flapBurst = 0;
    this._flapBurstTotal = 90;

    // Smoothing
    this._smoothPitch = 0;
    this._smoothRoll = 0;

    // Debug overlay
    this._debugEl = null;

    this._setup();
  }

  async _setup() {
    if (!window.DeviceOrientationEvent) return;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      this._needsPermission = true;
    } else {
      this._startListening();
    }
  }

  async requestPermission() {
    const needsOrientationPerm = typeof DeviceOrientationEvent.requestPermission === 'function';
    const needsMotionPerm = typeof window.DeviceMotionEvent?.requestPermission === 'function';

    if (!needsOrientationPerm && !needsMotionPerm) {
      this._startListening();
      return true;
    }

    try {
      // iOS 13+ requires SEPARATE permissions for orientation and motion.
      // We need both: orientation for tilt-fly controls, motion for the
      // shake-to-flap gesture (which also drives the shake calibration
      // step). Asking only for orientation silently leaves devicemotion
      // events unfired → the calibration wizard would hang indefinitely
      // on the shake step. Request both in parallel.
      const responses = await Promise.all([
        needsOrientationPerm
          ? DeviceOrientationEvent.requestPermission().catch(() => 'denied')
          : Promise.resolve('granted'),
        needsMotionPerm
          ? DeviceMotionEvent.requestPermission().catch(() => 'denied')
          : Promise.resolve('granted'),
      ]);
      const orientationOk = responses[0] === 'granted';
      const motionOk = responses[1] === 'granted';
      if (orientationOk) this._startListening();
      return orientationOk && motionOk;
    } catch (e) {
      console.warn('Sensor permission request failed:', e);
      return false;
    }
  }

  _startListening() {
    window.addEventListener('deviceorientation', (e) => this._onOrientation(e), true);
    window.addEventListener('devicemotion', (e) => this._onMotion(e), true);
    this.available = true;
    console.log('Mobile gyroscope input active');
  }

  /**
   * Apply a calibration profile from CalibrationWizard.
   * @param {object} profile
   */
  setProfile(profile) {
    this._profile = profile;
    this._shakeThreshold = profile.shakeThreshold ?? 12;
    this._smoothPitch = 0;
    this._smoothRoll = 0;
    console.log('MobileInput: profile applied', profile);
  }

  _onOrientation(e) {
    if (!this.active) return;

    const beta = e.beta;   // -180..180 (front/back tilt)
    const gamma = e.gamma; // -90..90 (left/right tilt)

    if (beta === null || gamma === null) return;

    // Quick recalibrate (double-tap) — update rest position within profile
    if (this._pendingCalibration) {
      if (this._profile) {
        this._profile.restBeta = beta;
        this._profile.restGamma = gamma;
      }
      this._pendingCalibration = false;
      this._smoothPitch = 0;
      this._smoothRoll = 0;
      console.log(`Recalibrated rest: beta=${beta.toFixed(1)}°, gamma=${gamma.toFixed(1)}°`);
    }

    // Need a profile to know which axis maps to what
    if (!this._profile) return;

    // Delta from calibrated rest position
    const dBeta = beta - this._profile.restBeta;
    const dGamma = gamma - this._profile.restGamma;

    // Use calibration profile: the wizard learned which axis and direction
    // maps to roll (left/right) and pitch (climb/dive) for this device
    const rollRaw = this._profile.rollAxis === 'beta' ? dBeta : dGamma;
    const pitchRaw = this._profile.pitchAxis === 'beta' ? dBeta : dGamma;

    const rollDeg = rollRaw * -this._profile.rollSign;
    const pitchDeg = pitchRaw * this._profile.pitchSign;

    // Normalize using calibrated range (user's actual tilt range)
    const normPitch = clamp(pitchDeg / this._profile.pitchRange, -1, 1);
    const normRoll = clamp(rollDeg / this._profile.rollRange, -1, 1);

    // Dead zone + non-linear response curve (T021 + T023):
    // - Wider dead zone (10%) so a phone held loosely doesn't drift the bird.
    // - Quadratic curve so micro-tilts feel calm, large tilts retain
    //   full authority. Formula: shape(v) = sign(v) · ((|v|−dz)/(1−dz))²
    //   for |v| ≥ dz, else 0. Phil's feedback ("less sensitive at small
    //   angles, more at large") with the curve replacing his suggested
    //   2.5 exponent — quadratic feels more responsive.
    const DEAD_ZONE = 0.10;
    const CURVE_EXPONENT = 2.0;
    const shape = (v) => {
      const abs = Math.abs(v);
      if (abs < DEAD_ZONE) return 0;
      const linear = (abs - DEAD_ZONE) / (1 - DEAD_ZONE);
      return Math.sign(v) * Math.pow(linear, CURVE_EXPONENT);
    };
    const rawPitch = shape(normPitch);
    const rawRoll = shape(normRoll);

    // Shake stabilization (see _onMotion): a vigorous flap-shake inevitably
    // jerks the phone's tilt. Following that jitter swung the nose down, and
    // since flap thrust points along the live pitch the flap drove the bird
    // DOWN ("shake → sink"). While a shake is active we hold the last steady
    // tilt instead of tracking the jerk, so the flap thrust keeps its
    // intended direction.
    if (performance.now() < this._shakeFreezeUntil) {
      this._updateDebug(beta, gamma, dBeta, dGamma, pitchDeg, rollDeg);
      return;
    }

    // Responsive smoothing
    this._smoothPitch += (rawPitch - this._smoothPitch) * 0.15;
    this._smoothRoll += (rawRoll - this._smoothRoll) * 0.15;

    this.pitch = this._smoothPitch;
    this.roll = this._smoothRoll;

    // Wing spread: only tuck wings at EXTREME dive (> 70% negative pitch)
    // Gentle negative pitch = normal descent with wings spread
    if (this.pitch < -0.55) {
      this.wingSpread = clamp(1 + (this.pitch + 0.55) * 4.0, 0, 1);
    } else {
      this.wingSpread = 1;
    }

    // Debug overlay
    this._updateDebug(beta, gamma, dBeta, dGamma, pitchDeg, rollDeg);
  }

  _onMotion(e) {
    if (!this.active) return;
    const accel = e.accelerationIncludingGravity;
    if (!accel) return;

    const dx = accel.x - this._lastAccel.x;
    const dy = accel.y - this._lastAccel.y;
    const dz = accel.z - this._lastAccel.z;
    const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);

    this._lastAccel = { x: accel.x, y: accel.y, z: accel.z };

    const now = performance.now();
    if (delta > this._shakeThreshold && now - this._lastShakeTime > 400) {
      this._flapBurst = this._flapBurstTotal;
      this._lastShakeTime = now;
      // Freeze tilt steering briefly so the shake's own jerk can't redirect
      // flap thrust (see _onOrientation).
      this._shakeFreezeUntil = now + 450;
    }
  }

  update(dt) {
    if (this._flapBurst > 0) {
      this.lift = 1;
      this._flapBurst--;
    } else {
      this.lift = 0;
    }
  }

  /**
   * Quick recalibrate: updates rest position on next orientation event.
   * Called by double-tap during gameplay.
   */
  calibrate() {
    this._pendingCalibration = true;
    this._smoothPitch = 0;
    this._smoothRoll = 0;
  }

  _updateDebug(beta, gamma, dBeta, dGamma, pitchDeg, rollDeg) {
    if (!this._debugEl) {
      this._debugEl = document.createElement('div');
      this._debugEl.style.cssText = `
        position:fixed; top:4px; left:4px; color:rgba(255,255,255,0.6);
        font:10px monospace; pointer-events:none; z-index:999;
        background:rgba(0,0,0,0.3); padding:4px 6px; border-radius:4px;
      `;
      document.body.appendChild(this._debugEl);
    }
    this._debugEl.textContent =
      `β:${beta.toFixed(0)}° γ:${gamma.toFixed(0)}° | ` +
      `P:${this.pitch.toFixed(2)} R:${this.roll.toFixed(2)} | ` +
      `${this._flapBurst > 0 ? 'FLAP!' : 'ws:' + this.wingSpread.toFixed(1)}`;
  }
}

export function requestFullscreenLandscape() {
  const el = document.documentElement;
  const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
  if (rfs) {
    rfs.call(el).catch(() => {});
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }
}

export function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1)
    || ('ontouchstart' in window)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 0);
}
