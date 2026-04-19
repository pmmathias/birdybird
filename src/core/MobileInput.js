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
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          this._startListening();
          return true;
        }
      } catch (e) {
        console.warn('DeviceOrientation permission denied:', e);
      }
      return false;
    }
    this._startListening();
    return true;
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

    // Small dead zone (5%) then linear response — fully proportional, no curve
    const deadZone = 0.05;
    const applyDeadZone = (v) => {
      const abs = Math.abs(v);
      return abs < deadZone ? 0 : Math.sign(v) * ((abs - deadZone) / (1 - deadZone));
    };
    const rawPitch = applyDeadZone(normPitch) * 0.8;
    const rawRoll = applyDeadZone(normRoll) * 0.8;

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
