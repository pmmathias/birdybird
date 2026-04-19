import { clamp } from '../utils/math.js';
import { t } from '../i18n.js';

/**
 * Mobile calibration wizard — walks user through each flight gesture
 * to learn the correct axis mapping for their device + orientation.
 */

const STEP_DURATION = 2500;

function getSteps() {
  return [
    { id: 'rest', icon: '✋', title: t('calib.rest.title'), text: t('calib.rest.text') },
    { id: 'left', icon: '↰', title: t('calib.left.title'), text: t('calib.left.text') },
    { id: 'right', icon: '↱', title: t('calib.right.title'), text: t('calib.right.text') },
    { id: 'climb', icon: '↗', title: t('calib.climb.title'), text: t('calib.climb.text') },
    { id: 'dive', icon: '↘', title: t('calib.dive.title'), text: t('calib.dive.text') },
    { id: 'shake', icon: '🦅', title: t('calib.shake.title'), text: t('calib.shake.text') },
  ];
}

export class CalibrationWizard {
  constructor() {
    this._overlay = null;
  }

  /** Load saved profile from localStorage, or null. */
  static loadProfile() {
    try {
      const json = localStorage.getItem('vogel_calibration');
      return json ? JSON.parse(json) : null;
    } catch { return null; }
  }

  /**
   * Run the full calibration wizard.
   * @returns {Promise<object>} calibration profile
   */
  async run() {
    this._createOverlay();
    const data = {};

    const steps = getSteps();
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.id === 'shake') {
        data.shake = await this._runShakeStep(step, i);
      } else {
        data[step.id] = await this._runTiltStep(step, i);
      }
    }

    const profile = this._computeProfile(data);
    localStorage.setItem('vogel_calibration', JSON.stringify(profile));

    await this._showDone();
    this._removeOverlay();
    return profile;
  }

  // --- UI ---

  _createOverlay() {
    this._overlay = document.createElement('div');
    this._overlay.style.cssText = `
      position:fixed; inset:0; z-index:700;
      background:linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0a1628 100%);
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      color:white; font-family:sans-serif; text-align:center; padding:20px;
      transition:opacity 0.3s;
    `;
    document.body.appendChild(this._overlay);
  }

  _removeOverlay() {
    if (!this._overlay) return;
    this._overlay.style.opacity = '0';
    setTimeout(() => this._overlay?.remove(), 300);
    this._overlay = null;
  }

  _renderStep(step, stepIndex) {
    this._overlay.innerHTML = `
      <div style="color:#556677; font-size:12px; margin-bottom:20px; letter-spacing:1px;">
        ${t('calib.step')} ${stepIndex + 1} / ${getSteps().length}
      </div>
      <div style="font-size:56px; margin-bottom:16px;">${step.icon}</div>
      <h2 style="font-size:22px; font-weight:bold; margin-bottom:8px;
        color:#60c0ff;">${step.title}</h2>
      <p style="color:#88aacc; font-size:15px; line-height:1.6;
        white-space:pre-line; margin-bottom:28px;">${step.text}</p>
      <div id="calib-progress" style="
        width:180px; height:5px; background:rgba(255,255,255,0.1);
        border-radius:3px; overflow:hidden;">
        <div id="calib-bar" style="
          width:0%; height:100%;
          background:linear-gradient(90deg, #40a0ff, #60c0ff);
          border-radius:3px; transition:width 0.1s linear;
        "></div>
      </div>
    `;
  }

  // --- Tilt step ---

  async _runTiltStep(step, stepIndex) {
    this._renderStep(step, stepIndex);

    // Brief pause so user can read and get into position
    await this._delay(1000);

    const samples = [];
    const handler = (e) => {
      if (e.beta !== null && e.gamma !== null) {
        samples.push({ beta: e.beta, gamma: e.gamma });
      }
    };
    window.addEventListener('deviceorientation', handler, true);

    // Animate progress bar
    const bar = document.getElementById('calib-bar');
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const progress = Math.min((performance.now() - start) / STEP_DURATION, 1);
        if (bar) bar.style.width = `${progress * 100}%`;
        if (progress < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    window.removeEventListener('deviceorientation', handler, true);

    // Average samples (skip first 20% as settling time)
    const skip = Math.floor(samples.length * 0.2);
    const usable = samples.slice(skip);
    if (usable.length === 0) return { avgBeta: 0, avgGamma: 0 };

    const sum = usable.reduce(
      (a, s) => ({ beta: a.beta + s.beta, gamma: a.gamma + s.gamma }),
      { beta: 0, gamma: 0 },
    );
    return {
      avgBeta: sum.beta / usable.length,
      avgGamma: sum.gamma / usable.length,
    };
  }

  // --- Shake step ---

  async _runShakeStep(step, stepIndex) {
    this._renderStep(step, stepIndex);
    const bar = document.getElementById('calib-bar');
    if (bar) {
      bar.style.width = '100%';
      bar.style.opacity = '0.4';
      bar.style.animation = 'none'; // pulsing handled via opacity
    }

    return new Promise((resolve) => {
      let lastAccel = { x: 0, y: 0, z: 0 };
      let detected = false;

      const handler = (e) => {
        if (detected) return;
        const a = e.accelerationIncludingGravity;
        if (!a) return;

        const dx = a.x - lastAccel.x;
        const dy = a.y - lastAccel.y;
        const dz = a.z - lastAccel.z;
        const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
        lastAccel = { x: a.x, y: a.y, z: a.z };

        if (mag > 10) {
          detected = true;
          window.removeEventListener('devicemotion', handler, true);
          // Flash success
          const h2 = this._overlay.querySelector('h2');
          if (h2) {
            h2.textContent = `${t('calib.detected')} ✓`;
            h2.style.color = '#44dd88';
          }
          setTimeout(
            () => resolve({ threshold: clamp(mag * 0.6, 8, 18) }),
            600,
          );
        }
      };
      window.addEventListener('devicemotion', handler, true);
    });
  }

  // --- Profile computation ---

  _computeProfile(data) {
    const rest = data.rest;

    // Deltas from rest for each gesture
    const leftDB = data.left.avgBeta - rest.avgBeta;
    const leftDG = data.left.avgGamma - rest.avgGamma;
    const rightDB = data.right.avgBeta - rest.avgBeta;
    const rightDG = data.right.avgGamma - rest.avgGamma;
    const climbDB = data.climb.avgBeta - rest.avgBeta;
    const climbDG = data.climb.avgGamma - rest.avgGamma;
    const diveDB = data.dive.avgBeta - rest.avgBeta;
    const diveDG = data.dive.avgGamma - rest.avgGamma;

    // Roll: which sensor axis has the biggest span between left and right?
    const rollBetaSpan = rightDB - leftDB;
    const rollGammaSpan = rightDG - leftDG;

    let rollAxis, rollSign, rollRange;
    if (Math.abs(rollBetaSpan) > Math.abs(rollGammaSpan)) {
      rollAxis = 'beta';
      rollSign = Math.sign(rollBetaSpan); // positive → right
      rollRange = Math.abs(rollBetaSpan) / 2;
    } else {
      rollAxis = 'gamma';
      rollSign = Math.sign(rollGammaSpan);
      rollRange = Math.abs(rollGammaSpan) / 2;
    }

    // Pitch: which sensor axis has the biggest span between climb and dive?
    const pitchBetaSpan = climbDB - diveDB;
    const pitchGammaSpan = climbDG - diveDG;

    let pitchAxis, pitchSign, pitchRange;
    if (Math.abs(pitchBetaSpan) > Math.abs(pitchGammaSpan)) {
      pitchAxis = 'beta';
      pitchSign = Math.sign(pitchBetaSpan); // positive → climb
      pitchRange = Math.abs(pitchBetaSpan) / 2;
    } else {
      pitchAxis = 'gamma';
      pitchSign = Math.sign(pitchGammaSpan);
      pitchRange = Math.abs(pitchGammaSpan) / 2;
    }

    // Edge case: both axes computed to the same sensor axis
    // Force the weaker one to the other axis
    if (rollAxis === pitchAxis) {
      const otherAxis = rollAxis === 'beta' ? 'gamma' : 'beta';
      if (rollRange < pitchRange) {
        rollAxis = otherAxis;
        rollSign = otherAxis === 'beta'
          ? Math.sign(rightDB - leftDB)
          : Math.sign(rightDG - leftDG);
        rollRange = Math.abs(
          otherAxis === 'beta' ? rollBetaSpan : rollGammaSpan,
        ) / 2;
      } else {
        pitchAxis = otherAxis;
        pitchSign = otherAxis === 'beta'
          ? Math.sign(climbDB - diveDB)
          : Math.sign(climbDG - diveDG);
        pitchRange = Math.abs(
          otherAxis === 'beta' ? pitchBetaSpan : pitchGammaSpan,
        ) / 2;
      }
    }

    // Safety minimums
    rollRange = Math.max(rollRange, 5);
    pitchRange = Math.max(pitchRange, 5);

    return {
      restBeta: rest.avgBeta,
      restGamma: rest.avgGamma,
      rollAxis,
      rollSign,
      rollRange,
      pitchAxis,
      pitchSign,
      pitchRange,
      shakeThreshold: data.shake?.threshold ?? 12,
      timestamp: Date.now(),
    };
  }

  // --- Done screen ---

  async _showDone() {
    this._overlay.innerHTML = `
      <div style="font-size:56px; margin-bottom:16px;">✓</div>
      <h2 style="font-size:24px; font-weight:bold; color:#44dd88;
        margin-bottom:8px;">${t('calib.done')}</h2>
      <p style="color:#88aacc; font-size:14px;">${t('calib.enjoy')}</p>
    `;
    await this._delay(1200);
  }

  _delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
