import { t } from '../i18n.js';

/**
 * Simple HTML-based HUD overlay for flight information.
 */
export class HUD {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      color: white;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 100;
      line-height: 1.6;
    `;
    document.body.appendChild(this.el);

    // Flap indicator
    this.flapIndicator = document.createElement('div');
    this.flapIndicator.id = 'flap-indicator';
    this.flapIndicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border: 2px solid rgba(255,255,255,0.5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 100;
      transition: background 0.2s;
    `;
    this.flapIndicator.textContent = '~';
    document.body.appendChild(this.flapIndicator);

    // Controls hint
    this.hint = document.createElement('div');
    this.hint.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,0.7);
      font-family: sans-serif;
      font-size: 13px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 100;
      text-align: center;
    `;
    this.hint.innerHTML = 'SPACE = Flap &nbsp;|&nbsp; A/D = Turn &nbsp;|&nbsp; W/S = Pitch &nbsp;|&nbsp; F = Toggle Flight Mode';
    document.body.appendChild(this.hint);
  }

  /**
   * @param {import('../flight/FlightState.js').FlightState} state
   * @param {boolean} isFlapping
   */
  update(state, isFlapping = false, inputSource = 'keyboard') {
    const alt = Math.round(state.altitude);
    const spd = Math.round(state.speed * 3.6); // m/s to km/h
    const heading = Math.round(((state.yaw * 180 / Math.PI) % 360 + 360) % 360);
    const aoa = Math.round(state.angleOfAttack * 180 / Math.PI);

    const stallWarning = state.isStalling
      ? '<span style="color:#ff4444;font-weight:bold">STALL</span><br>'
      : '';

    const modeLabel = inputSource === 'pose'
      ? '<span style="color:#44ff44">WEBCAM</span>'
      : '<span style="color:#ffaa44">KEYBOARD</span>';

    // Flight mode indicator (import-free — uses keys directly)
    const MODE_KEYS = ['hud.flying', 'hud.landing', 'hud.walking', 'hud.takeoff'];
    const MODE_LABELS = MODE_KEYS.map(k => t(k));
    const MODE_COLORS = ['#88aacc', '#ffaa44', '#44dd88', '#ffaa44'];
    const modeIdx = state.mode ?? 0;
    const flightModeLabel = `<span style="color:${MODE_COLORS[modeIdx]}">${MODE_LABELS[modeIdx]}</span>`;

    this.el.innerHTML = `
      ${stallWarning}
      ${modeLabel} · ${flightModeLabel}<br>
      ALT: ${alt}m<br>
      SPD: ${spd} km/h<br>
      HDG: ${heading}&deg;<br>
      AoA: ${aoa}&deg;
    `;

    // Flap indicator flash
    if (isFlapping) {
      this.flapIndicator.style.background = 'rgba(255, 200, 50, 0.5)';
      this.flapIndicator.textContent = '^';
    } else {
      this.flapIndicator.style.background = 'transparent';
      this.flapIndicator.textContent = '~';
    }
  }
}
