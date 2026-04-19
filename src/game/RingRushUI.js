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
    // HUD pill at top-center
    const hud = document.createElement('div');
    hud.id = 'rr-hud';
    hud.innerHTML = `
      <div class="rr-timer" id="rr-timer">60</div>
      <div class="rr-score"><span id="rr-score">0</span> rings</div>
    `;
    document.body.appendChild(hud);

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
    this._modal = modal;
    this._finalEl = document.getElementById('rr-final');
    this._bestEl = document.getElementById('rr-best');
    document.getElementById('rr-retry').addEventListener('click', () => {
      this._hideModal();
      this.onRestart();
    });
  }

  update() {
    const rr = this.ringRush;
    const seconds = Math.max(0, Math.ceil(rr.timer));
    this._timerEl.textContent = seconds;
    this._timerEl.classList.toggle('warn', seconds <= 10 && !rr.gameOver);
    this._scoreEl.textContent = rr.score;

    if (rr.gameOver && !this._modalShown) {
      this._finalEl.textContent = rr.score;
      this._bestEl.textContent = rr.highscore;
      this._modal.classList.add('visible');
      this._modalShown = true;
    }
  }

  _hideModal() {
    this._modal.classList.remove('visible');
    this._modalShown = false;
  }
}
