/**
 * Procedural sound effects via Web Audio API.
 * No assets to download — we synthesize everything inline with oscillators.
 * AudioContext must be unlocked on a user gesture (iOS Safari requirement),
 * so call .unlock() from a tap/click handler before playing.
 */
export class SoundFX {
  constructor() {
    this._ctx = null;
    this._master = null;
    this.muted = false;
    this.masterVolume = 0.7;
  }

  unlock() {
    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this._ctx = new Ctx();
      this._master = this._ctx.createGain();
      this._master.gain.value = this.masterVolume;
      this._master.connect(this._ctx.destination);
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  setMuted(m) {
    this.muted = !!m;
    if (this._master) this._master.gain.value = this.muted ? 0 : this.masterVolume;
  }

  /** Generic tone with ADSR envelope. */
  _tone(freq, duration, opts = {}) {
    if (this.muted || !this._ctx) return;
    const type = opts.type || 'sine';
    const volume = (opts.volume ?? 0.2);
    const attack = opts.attack ?? 0.004;
    const release = opts.release ?? 0.08;
    const freqEnd = opts.freqEnd ?? null;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.setValueAtTime(volume, now + duration - release);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(gain).connect(this._master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  /** Ring collect: bright two-note chime. */
  ringDing() {
    this._tone(880, 0.18, { type: 'sine', volume: 0.18 });
    setTimeout(() => this._tone(1320, 0.24, { type: 'sine', volume: 0.12 }), 40);
  }

  /** Stick collect: short woody knock. */
  stickPickup() {
    this._tone(380, 0.14, { type: 'triangle', volume: 0.2, freqEnd: 180 });
    setTimeout(() => this._tone(220, 0.08, { type: 'sawtooth', volume: 0.08 }), 20);
  }

  /** Worm collect: soft wet bloop. */
  wormPickup() {
    this._tone(540, 0.16, { type: 'sine', volume: 0.18, freqEnd: 320 });
    setTimeout(() => this._tone(380, 0.12, { type: 'sine', volume: 0.1, freqEnd: 240 }), 30);
  }

  /** Chirp: short high-pitched pip from the nest. */
  chirp(volumeScale = 1.0) {
    if (!this._ctx) return;
    const v = 0.08 * Math.max(0, Math.min(1, volumeScale));
    if (v < 0.005) return;
    this._tone(2600, 0.06, { type: 'sine', volume: v, attack: 0.001, release: 0.02 });
    setTimeout(() => this._tone(2200, 0.05, { type: 'sine', volume: v * 0.7, attack: 0.001, release: 0.02 }), 45);
  }

  /** Quest complete: ascending three-note tease. */
  questComplete() {
    const notes = [659, 880, 1175];
    notes.forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.18, { type: 'triangle', volume: 0.2 }), i * 110);
    });
  }

  /** Win: four-note fanfare + sparkle. */
  winFanfare() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._tone(f, 0.35, { type: 'triangle', volume: 0.22 });
        this._tone(f * 2, 0.18, { type: 'sine', volume: 0.07 });
      }, i * 140);
    });
  }

  /** Loss: sad falling tone. */
  loseToot() {
    this._tone(440, 0.5, { type: 'sawtooth', volume: 0.16, freqEnd: 110 });
  }
}
