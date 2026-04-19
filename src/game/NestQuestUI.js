/**
 * HUD + victory/loss modal for Nest Quest.
 * Hidden until game starts. Shows timer, sticks, worms, rings.
 */
export class NestQuestUI {
  constructor(nestQuest, onRestart) {
    this.nq = nestQuest;
    this.onRestart = onRestart;
    this._modalShown = false;
    this._lastSticks = 0;
    this._lastWorms = 0;
    this._build();
  }

  _build() {
    const hud = document.createElement('div');
    hud.id = 'nq-hud';
    hud.innerHTML = `
      <div class="nq-timer"><span id="nq-time">5:00</span></div>
      <div class="nq-inv">
        <span class="nq-slot" id="nq-slot-stick">🪵 <b id="nq-sticks">0</b>/<b id="nq-sticks-need">1</b></span>
        <span class="nq-slot" id="nq-slot-worm">🪱 <b id="nq-worms">0</b>/<b id="nq-worms-need">1</b></span>
        <span class="nq-slot" id="nq-slot-ring">💍 <b id="nq-rings">0</b></span>
      </div>
      <div class="nq-hint" id="nq-hint">Find a glowing tree + a worm, return to the nest</div>
    `;
    document.body.appendChild(hud);
    this._hud = hud;
    this._timeEl = document.getElementById('nq-time');
    this._sticksEl = document.getElementById('nq-sticks');
    this._sticksNeedEl = document.getElementById('nq-sticks-need');
    this._wormsEl = document.getElementById('nq-worms');
    this._wormsNeedEl = document.getElementById('nq-worms-need');
    this._ringsEl = document.getElementById('nq-rings');
    this._hintEl = document.getElementById('nq-hint');
    this._slotStick = document.getElementById('nq-slot-stick');
    this._slotWorm = document.getElementById('nq-slot-worm');

    const modal = document.createElement('div');
    modal.id = 'nq-modal';
    modal.innerHTML = `
      <div class="nq-card">
        <div class="nq-title" id="nq-mod-title">You made it!</div>
        <div class="nq-result" id="nq-mod-score">0</div>
        <div class="nq-result-label">final score</div>
        <div class="nq-best"><span>Best</span><span id="nq-mod-best">0</span></div>
        <div class="nq-breakdown" id="nq-mod-breakdown"></div>
        <button class="nq-retry" id="nq-retry">Try again</button>
      </div>
    `;
    document.body.appendChild(modal);
    this._modal = modal;
    document.getElementById('nq-retry').addEventListener('click', () => {
      this._hideModal();
      this.onRestart();
    });
  }

  update() {
    const nq = this.nq;

    if (!nq.started) {
      if (this._hud.classList.contains('visible')) this._hud.classList.remove('visible');
      return;
    }
    if (!this._hud.classList.contains('visible')) this._hud.classList.add('visible');

    const total = Math.max(0, Math.ceil(nq.timer));
    const mm = Math.floor(total / 60);
    const ss = total % 60;
    this._timeEl.textContent = mm + ':' + String(ss).padStart(2, '0');
    this._timeEl.classList.toggle('warn', total <= 30 && !nq.gameOver);

    this._sticksEl.textContent = nq.sticks;
    this._wormsEl.textContent = nq.worms;
    this._ringsEl.textContent = nq.rings;

    this._slotStick.classList.toggle('done', nq.sticks >= parseInt(this._sticksNeedEl.textContent, 10));
    this._slotWorm.classList.toggle('done', nq.worms >= parseInt(this._wormsNeedEl.textContent, 10));

    // Pulse inventory slot on pickup
    if (nq.sticks > this._lastSticks) { this._pulse(this._slotStick); this._lastSticks = nq.sticks; }
    if (nq.worms > this._lastWorms) { this._pulse(this._slotWorm); this._lastWorms = nq.worms; }

    // Hint text shifts with progress
    if (nq.questComplete && !nq.won) {
      this._hintEl.textContent = 'Fly back to the nest!';
      this._hintEl.classList.add('urgent');
    } else if (nq.sticks >= 1 && nq.worms < 1) {
      this._hintEl.textContent = 'Now find a worm near the ground';
    } else if (nq.worms >= 1 && nq.sticks < 1) {
      this._hintEl.textContent = 'Now find a glowing tree for a stick';
    } else {
      this._hintEl.textContent = 'Find a glowing tree + a worm, return to the nest';
      this._hintEl.classList.remove('urgent');
    }

    if (nq.gameOver && !this._modalShown) {
      this._showModal();
      this._modalShown = true;
    }
  }

  _pulse(el) {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  _showModal() {
    const nq = this.nq;
    document.getElementById('nq-mod-title').textContent = nq.won ? 'You made it home!' : 'Time ran out';
    document.getElementById('nq-mod-score').textContent = nq.won ? nq.finalScore : 0;
    document.getElementById('nq-mod-best').textContent = nq.highscore;
    const breakdown = document.getElementById('nq-mod-breakdown');
    if (nq.won) {
      const remaining = Math.ceil(nq.timer);
      breakdown.innerHTML = `${remaining}s remaining + ${nq.rings} rings × 10 = <b>${nq.finalScore}</b>`;
    } else {
      breakdown.innerHTML = nq.questComplete
        ? 'You had everything but didn\'t reach the nest in time.'
        : `You collected ${nq.sticks} stick${nq.sticks === 1 ? '' : 's'} and ${nq.worms} worm${nq.worms === 1 ? '' : 's'}.`;
    }
    this._modal.classList.add('visible');
  }

  _hideModal() {
    this._modal.classList.remove('visible');
    this._modalShown = false;
  }

  /** Announce quest completion with a flash — same slot as level-up */
  flashQuestComplete() {
    const flash = document.createElement('div');
    flash.className = 'nq-complete-flash';
    flash.innerHTML = '<b>GOT IT!</b><br><span>Now fly home</span>';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 2200);
  }
}
