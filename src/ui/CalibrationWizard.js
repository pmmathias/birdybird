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
   * Run the full calibration wizard. Loops on user request from the
   * test-fly verification step so a mis-calibrated mapping can be
   * redone without leaving the wizard.
   * @returns {Promise<object>} calibration profile
   */
  async run() {
    while (true) {
      this._createOverlay();
      const data = {};

      const tiltSteps = getSteps().filter((s) => s.id !== 'shake');
      for (let i = 0; i < tiltSteps.length; i++) {
        data[tiltSteps[i].id] = await this._runTiltStep(tiltSteps[i], i, data.rest);
      }

      const provisionalProfile = this._computeProfile({
        ...data,
        shake: { threshold: 12 },  // placeholder; real one captured next
      });

      // Test-fly verification — user confirms the mapping is correct
      // before we commit. If they hit redo, restart the whole wizard.
      const ok = await this._runTestFlyStep(provisionalProfile, tiltSteps.length);
      if (!ok) {
        this._removeOverlay();
        continue;
      }

      // Capture shake threshold last so test-fly fits the natural flow
      const shakeStep = getSteps().find((s) => s.id === 'shake');
      const shake = await this._runShakeStep(shakeStep, tiltSteps.length + 1);

      const profile = this._computeProfile({ ...data, shake });
      localStorage.setItem('vogel_calibration', JSON.stringify(profile));

      await this._showDone();
      this._removeOverlay();
      return profile;
    }
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

  _renderStep(step, stepIndex, opts = {}) {
    const showLive = opts.showLive !== false;
    const totalSteps = getSteps().length + 1; // +1 for test-fly
    this._overlay.innerHTML = `
      <div style="color:#556677; font-size:12px; margin-bottom:20px; letter-spacing:1px;">
        ${t('calib.step')} ${stepIndex + 1} / ${totalSteps}
      </div>
      <div style="font-size:56px; margin-bottom:16px;">${step.icon}</div>
      <h2 style="font-size:22px; font-weight:bold; margin-bottom:8px;
        color:#60c0ff;">${step.title}</h2>
      <p style="color:#88aacc; font-size:15px; line-height:1.6;
        white-space:pre-line; margin-bottom:20px;">${step.text}</p>
      ${showLive ? this._liveSensorMarkup() : ''}
      <div id="calib-progress" style="
        width:180px; height:5px; background:rgba(255,255,255,0.1);
        border-radius:3px; overflow:hidden; margin-top:8px;">
        <div id="calib-bar" style="
          width:0%; height:100%;
          background:linear-gradient(90deg, #40a0ff, #60c0ff);
          border-radius:3px; transition:width 0.1s linear;
        "></div>
      </div>
    `;
  }

  /** Live sensor visualization: a 2D dot in a labeled square showing
   *  current tilt relative to rest. Lets the user immediately see what
   *  the wizard is measuring and verify their phone reports data. */
  _liveSensorMarkup() {
    return `
      <div style="display:flex; flex-direction:column; align-items:center;
        gap:6px; margin-bottom:8px;">
        <div style="position:relative; width:140px; height:140px;
          border:1px solid rgba(96,192,255,0.3); border-radius:14px;
          background:rgba(10,22,40,0.5);">
          <div style="position:absolute; top:50%; left:50%; width:1px;
            height:100%; background:rgba(255,255,255,0.06);
            transform:translateX(-50%);"></div>
          <div style="position:absolute; top:50%; left:50%; height:1px;
            width:100%; background:rgba(255,255,255,0.06);
            transform:translateY(-50%);"></div>
          <div style="position:absolute; top:6px; left:50%;
            transform:translateX(-50%); color:#88aacc; font-size:10px;
            letter-spacing:0.5px;">↑ β+</div>
          <div style="position:absolute; bottom:6px; left:50%;
            transform:translateX(-50%); color:#88aacc; font-size:10px;
            letter-spacing:0.5px;">β− ↓</div>
          <div style="position:absolute; left:6px; top:50%;
            transform:translateY(-50%); color:#88aacc; font-size:10px;">γ−</div>
          <div style="position:absolute; right:6px; top:50%;
            transform:translateY(-50%); color:#88aacc; font-size:10px;">γ+</div>
          <div id="calib-dot" style="position:absolute; top:50%; left:50%;
            width:14px; height:14px; border-radius:50%;
            background:radial-gradient(circle, #60c0ff, #2080cc);
            box-shadow:0 0 12px rgba(96,192,255,0.7);
            transform:translate(-50%,-50%);
            transition:transform 0.05s linear;"></div>
        </div>
        <div id="calib-readout" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size:11px; color:#88aacc; min-height:14px;
          letter-spacing:0.5px;">${t('calib.live.waiting')}</div>
      </div>
    `;
  }

  // --- Tilt step ---

  async _runTiltStep(step, stepIndex, restRef) {
    this._renderStep(step, stepIndex);

    // Brief pause so user can read and get into position
    await this._delay(1000);

    const samples = [];
    let latest = null;
    const handler = (e) => {
      if (e.beta !== null && e.gamma !== null) {
        latest = { beta: e.beta, gamma: e.gamma };
        samples.push(latest);
      }
    };
    window.addEventListener('deviceorientation', handler, true);

    // Animate progress bar + drive the live-sensor dot. The dot maps
    // delta-from-rest if rest is known (steps after rest); for the rest
    // step itself, it shows raw values centred at 0.
    const bar = document.getElementById('calib-bar');
    const dot = document.getElementById('calib-dot');
    const readout = document.getElementById('calib-readout');
    const DOT_SCALE = 3.0;     // px per ° of tilt — soft-saturates around ±20°
    const DOT_LIMIT = 60;      // px box half-width for clamping
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const progress = Math.min((performance.now() - start) / STEP_DURATION, 1);
        if (bar) bar.style.width = `${progress * 100}%`;
        if (latest && dot && readout) {
          let dBeta, dGamma;
          if (restRef && step.id !== 'rest') {
            dBeta = latest.beta - restRef.avgBeta;
            dGamma = latest.gamma - restRef.avgGamma;
          } else {
            dBeta = latest.beta;
            dGamma = latest.gamma;
          }
          const dx = Math.max(-DOT_LIMIT, Math.min(DOT_LIMIT, dGamma * DOT_SCALE));
          const dy = Math.max(-DOT_LIMIT, Math.min(DOT_LIMIT, -dBeta * DOT_SCALE));
          dot.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          const label = (restRef && step.id !== 'rest')
            ? t('calib.live.delta')
            : t('calib.live.label');
          readout.textContent = `${label}  β ${dBeta.toFixed(1)}°  γ ${dGamma.toFixed(1)}°`;
        }
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

  // --- Test-fly verification step ---

  /**
   * Final sanity check before saving. A live preview-bird banks/pitches
   * with the user's tilt using the just-computed profile. User confirms
   * the mapping matches their expectation, or hits "redo" to start over.
   * @returns {Promise<boolean>} true = confirmed, false = redo
   */
  async _runTestFlyStep(profile, stepIndex) {
    const totalSteps = getSteps().length + 1;
    this._overlay.innerHTML = `
      <div style="color:#556677; font-size:12px; margin-bottom:20px; letter-spacing:1px;">
        ${t('calib.step')} ${stepIndex + 1} / ${totalSteps}
      </div>
      <div style="font-size:56px; margin-bottom:14px;">🦅</div>
      <h2 style="font-size:22px; font-weight:bold; margin-bottom:8px;
        color:#60c0ff;">${t('calib.test.title')}</h2>
      <p style="color:#88aacc; font-size:15px; line-height:1.6;
        white-space:pre-line; margin-bottom:18px;">${t('calib.test.text')}</p>
      <div id="calib-bird-stage" style="position:relative; width:170px;
        height:170px; margin-bottom:24px;
        background:radial-gradient(ellipse at 50% 60%, rgba(96,192,255,0.08), transparent 70%);">
        <svg id="calib-bird" viewBox="-50 -30 100 60" width="170" height="100"
          style="position:absolute; left:0; top:35px;
            transition:transform 0.08s linear;">
          <path d="M -40 0 Q -22 -16 0 -3 Q 22 -16 40 0 Q 22 6 0 6 Q -22 6 -40 0 Z"
            fill="#60c0ff" stroke="#a0d8ff" stroke-width="1"/>
          <circle cx="0" cy="0" r="5" fill="#a0d8ff"/>
          <path d="M 4 -1 L 12 -2 L 4 1 Z" fill="#ffd060"/>
        </svg>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
        <button id="calib-confirm" style="
          padding:11px 22px; font-size:14px; font-weight:600;
          background:linear-gradient(135deg, #44dd88, #22aa66); color:#03210f;
          border:none; border-radius:8px; cursor:pointer;
          box-shadow:0 4px 14px rgba(68,221,136,0.3);">
          ${t('calib.test.confirm')}
        </button>
        <button id="calib-redo" style="
          padding:11px 22px; font-size:14px;
          background:rgba(255,255,255,0.08); color:#ccddff;
          border:1px solid rgba(255,255,255,0.15); border-radius:8px;
          cursor:pointer;">
          ${t('calib.test.redo')}
        </button>
      </div>
    `;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('deviceorientation', handler, true);
        cancelAnimationFrame(rafId);
        resolve(ok);
      };

      const bird = document.getElementById('calib-bird');
      let latest = null;
      const handler = (e) => {
        if (e.beta !== null && e.gamma !== null) {
          latest = { beta: e.beta, gamma: e.gamma };
        }
      };
      window.addEventListener('deviceorientation', handler, true);

      // Drive bird transform from the LIVE input through the same profile
      // mapping the game uses, so what the user sees here matches in-game.
      let rafId = 0;
      const tick = () => {
        if (latest && bird) {
          const dBeta = latest.beta - profile.restBeta;
          const dGamma = latest.gamma - profile.restGamma;
          const rollRaw = profile.rollAxis === 'beta' ? dBeta : dGamma;
          const pitchRaw = profile.pitchAxis === 'beta' ? dBeta : dGamma;
          const rollNorm = Math.max(-1, Math.min(1,
            (rollRaw * profile.rollSign) / profile.rollRange));
          const pitchNorm = Math.max(-1, Math.min(1,
            (pitchRaw * profile.pitchSign) / profile.pitchRange));
          const bankDeg = rollNorm * 45;     // visual cap ±45°
          const pitchDeg = -pitchNorm * 25;  // climb = nose up = negative rotation
          bird.style.transform = `rotate(${bankDeg}deg) translateY(${pitchNorm * -20}px)`;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      document.getElementById('calib-confirm').addEventListener('click',
        () => finish(true));
      document.getElementById('calib-redo').addEventListener('click',
        () => finish(false));
    });
  }

  // --- Shake step ---

  async _runShakeStep(step, stepIndex) {
    this._renderStep(step, stepIndex, { showLive: false });
    const bar = document.getElementById('calib-bar');
    if (bar) {
      bar.style.width = '100%';
      bar.style.opacity = '0.4';
      bar.style.animation = 'none'; // pulsing handled via opacity
    }

    // Add a tap-to-skip button so users on devices where devicemotion
    // never fires (iOS without DeviceMotionEvent permission, simulators,
    // desktop browsers that forwarded mobile UA) aren't stuck forever
    // at "Flugelschlag!". 8s hard timeout as extra safety net.
    const skipBtn = document.createElement('button');
    skipBtn.textContent = t('calib.skipShake') || 'Skip';
    skipBtn.style.cssText = `
      margin-top:28px; padding:10px 22px; font-size:14px;
      background:rgba(255,255,255,0.08); color:#88aacc;
      border:1px solid rgba(255,255,255,0.15); border-radius:8px;
      cursor:pointer;
    `;
    this._overlay.appendChild(skipBtn);

    return new Promise((resolve) => {
      let lastAccel = { x: 0, y: 0, z: 0 };
      let motionSeen = false;
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('devicemotion', handler, true);
        clearTimeout(timeoutId);
        skipBtn.remove();
        resolve(result);
      };

      const handler = (e) => {
        if (settled) return;
        const a = e.accelerationIncludingGravity;
        if (!a) return;
        motionSeen = true;

        const dx = a.x - lastAccel.x;
        const dy = a.y - lastAccel.y;
        const dz = a.z - lastAccel.z;
        const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
        lastAccel = { x: a.x, y: a.y, z: a.z };

        if (mag > 10) {
          // Flash success
          const h2 = this._overlay.querySelector('h2');
          if (h2) {
            h2.textContent = `${t('calib.detected')} ✓`;
            h2.style.color = '#44dd88';
          }
          setTimeout(() => finish({ threshold: clamp(mag * 0.6, 8, 18) }), 600);
        }
      };
      window.addEventListener('devicemotion', handler, true);

      skipBtn.addEventListener('click', () => finish({ threshold: 12 }));

      // 8s hard timeout: if we never saw ANY motion event, the permission
      // likely wasn't granted or this device doesn't fire them. Log and
      // fall through with a default threshold instead of hanging.
      const timeoutId = setTimeout(() => {
        if (!motionSeen) {
          console.warn('CalibrationWizard: no devicemotion events in 8s, using default shake threshold');
        }
        finish({ threshold: 12 });
      }, 8000);
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
