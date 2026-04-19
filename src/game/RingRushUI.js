/**
 * Ring-Rush HUD and Game-Over modal. Creates its own DOM elements so main.js
 * doesn't need to know about styling details.
 */
export class RingRushUI {
  constructor(ringRush, onRestart) {
    this.ringRush = ringRush;
    this.onRestart = onRestart;
    this._modalShown = false;
    this._build();
  }

  _build() {
    // HUD pill at top-center — hidden by default (CSS), visible when .visible class is added
    const hud = document.createElement('div');
    hud.id = 'rr-hud';
    hud.innerHTML = `
      <div class="rr-timer" id="rr-timer">100</div>
      <div class="rr-score"><span id="rr-score">0</span> rings</div>
      <div class="rr-level">Level <span id="rr-level">1</span> · <span id="rr-level-prog">0</span>/<span id="rr-level-goal">100</span></div>
    `;
    document.body.appendChild(hud);
    this._hudEl = hud;

    // Level-up announcement overlay
    const levelUp = document.createElement('div');
    levelUp.id = 'rr-levelup';
    levelUp.innerHTML = `
      <div class="rr-levelup-inner">
        <div class="rr-levelup-label">Level</div>
        <div class="rr-levelup-num" id="rr-levelup-num">2</div>
        <div class="rr-levelup-biome" id="rr-levelup-biome"></div>
      </div>
    `;
    document.body.appendChild(levelUp);
    this._levelUpEl = levelUp;
    this._levelUpNumEl = document.getElementById('rr-levelup-num');
    this._levelUpBiomeEl = document.getElementById('rr-levelup-biome');

    // Game-over modal
    const modal = document.createElement('div');
    modal.id = 'rr-modal';
    modal.innerHTML = `
      <div class="rr-card">
        <div class="rr-title">Time's up!</div>
        <div class="rr-final" id="rr-final">0</div>
        <div class="rr-label">rings collected</div>
        <div class="rr-best">
          <span>Best</span>
          <span id="rr-best">0</span>
        </div>
        <button class="rr-retry" id="rr-retry">Tap to Retry</button>
      </div>
    `;
    document.body.appendChild(modal);

    this._timerEl = document.getElementById('rr-timer');
    this._scoreEl = document.getElementById('rr-score');
    this._levelEl = document.getElementById('rr-level');
    this._levelProgEl = document.getElementById('rr-level-prog');
    this._modal = modal;
    this._finalEl = document.getElementById('rr-final');
    this._bestEl = document.getElementById('rr-best');
    document.getElementById('rr-retry').addEventListener('click', () => {
      this._hideModal();
      this.onRestart();
    });
  }

  showLevelUp(level, biomeName = '') {
    this._levelUpNumEl.textContent = level;
    this._levelUpBiomeEl.textContent = biomeName;
    this._levelUpEl.classList.remove('visible');
    // force reflow to restart animation
    void this._levelUpEl.offsetWidth;
    this._levelUpEl.classList.add('visible');
    setTimeout(() => this._levelUpEl.classList.remove('visible'), 2400);
  }

  update() {
    const rr = this.ringRush;

    // Keep the HUD hidden until the game has really started
    // (mobile calibration wizard still running, or desktop hasn't fired start yet).
    if (!rr.started) {
      if (this._hudEl.classList.contains('visible')) this._hudEl.classList.remove('visible');
      return;
    }
    if (!this._hudEl.classList.contains('visible')) this._hudEl.classList.add('visible');

    const seconds = Math.max(0, Math.ceil(rr.timer));
    this._timerEl.textContent = seconds;
    this._timerEl.classList.toggle('warn', seconds <= 10 && !rr.gameOver);
    this._scoreEl.textContent = rr.score;
    this._levelEl.textContent = rr.level;
    this._levelProgEl.textContent = rr.ringsThisLevel;

    // Detect score change for ring-juice: pulse + bonus popup
    if (this._lastScore !== undefined && rr.score > this._lastScore) {
      this._flashRingCollect();
    }
    this._lastScore = rr.score;

    if (rr.gameOver && !this._modalShown) {
      this._finalEl.textContent = rr.score;
      this._bestEl.textContent = rr.highscore;
      this._modal.classList.add('visible');
      this._modalShown = true;
    }
  }

  _flashRingCollect() {
    // Timer pulse
    this._timerEl.classList.remove('hit');
    void this._timerEl.offsetWidth;
    this._timerEl.classList.add('hit');

    // "+ZEIT" bonus popup — the timer is reset to full (100s) on every ring
    const popup = document.createElement('div');
    popup.className = 'rr-bonus-popup';
    popup.textContent = '+ZEIT';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 900);
  }

  _hideModal() {
    this._modal.classList.remove('visible');
    this._modalShown = false;
  }
}
