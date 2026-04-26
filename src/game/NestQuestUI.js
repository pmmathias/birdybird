/**
 * HUD + victory/loss modal for Nest Quest.
 * Hidden until game starts. Shows timer, sticks, worms, rings.
 */
export class NestQuestUI {
  constructor(nestQuest, onRestart, onNextLevel) {
    this.nq = nestQuest;
    this.onRestart = onRestart;
    this.onNextLevel = onNextLevel || null;
    this._modalShown = false;
    this._lastSticks = 0;
    this._lastWorms = 0;
    this._build();
  }

  _build() {
    const hud = document.createElement('div');
    hud.id = 'nq-hud';
    hud.innerHTML = `
      <div class="nq-hint" id="nq-hint">Find a glowing tree + a worm, return to the nest</div>
      <div class="nq-row">
        <span class="nq-chip nq-chip-time" id="nq-timer-chip"><span id="nq-time">5:00</span></span>
        <span class="nq-chip nq-chip-lvl">L<b id="nq-level">1</b></span>
        <span class="nq-chip nq-slot" id="nq-slot-stick">🪵 <b id="nq-sticks">0</b>/<b id="nq-sticks-need">1</b></span>
        <span class="nq-chip nq-slot" id="nq-slot-worm">🪱 <b id="nq-worms">0</b>/<b id="nq-worms-need">1</b></span>
        <span class="nq-chip nq-slot" id="nq-slot-clock">⏰ <b id="nq-clocks">0</b></span>
        <span class="nq-chip nq-chip-boost" id="nq-boost-chip" style="display:none">⚡ <b id="nq-boost-time">0</b>s</span>
      </div>
    `;
    document.body.appendChild(hud);
    this._hud = hud;
    this._timeEl = document.getElementById('nq-time');
    this._timerChipEl = document.getElementById('nq-timer-chip');
    this._sticksEl = document.getElementById('nq-sticks');
    this._sticksNeedEl = document.getElementById('nq-sticks-need');
    this._wormsEl = document.getElementById('nq-worms');
    this._wormsNeedEl = document.getElementById('nq-worms-need');
    this._clocksEl = document.getElementById('nq-clocks');
    this._boostChipEl = document.getElementById('nq-boost-chip');
    this._boostTimeEl = document.getElementById('nq-boost-time');
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
        <button class="nq-retry" id="nq-next" style="display:none">Next level →</button>
        <button class="nq-retry" id="nq-retry">Try again</button>
      </div>
    `;
    document.body.appendChild(modal);
    this._modal = modal;
    document.getElementById('nq-retry').addEventListener('click', () => {
      this._hideModal();
      this.onRestart();
    });
    document.getElementById('nq-next').addEventListener('click', () => {
      this._hideModal();
      if (this.onNextLevel) this.onNextLevel();
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
    this._timerChipEl.classList.toggle('warn', total <= 30 && !nq.gameOver);

    this._sticksEl.textContent = nq.sticks;
    this._wormsEl.textContent = nq.worms;
    this._clocksEl.textContent = nq.rings;
    this._sticksNeedEl.textContent = nq.sticksRequired;
    this._wormsNeedEl.textContent = nq.wormsRequired;
    document.getElementById('nq-level').textContent = nq.level;

    // Speed-boost countdown chip — show multiplier + remaining seconds
    const boostT = nq.flightState?.speedBoostT || 0;
    const stack = nq.flightState?.speedBoostStack || 0;
    if (boostT > 0) {
      this._boostChipEl.style.display = '';
      this._boostTimeEl.textContent = `${stack + 1}× ${Math.ceil(boostT)}s`;
    } else {
      this._boostChipEl.style.display = 'none';
    }

    this._slotStick.classList.toggle('done', nq.sticks >= nq.sticksRequired);
    this._slotWorm.classList.toggle('done', nq.worms >= nq.wormsRequired);

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
    const nextBtn = document.getElementById('nq-next');
    const retryBtn = document.getElementById('nq-retry');
    document.getElementById('nq-mod-title').textContent = nq.won
      ? `Level ${nq.level} complete!`
      : 'Time ran out';
    document.getElementById('nq-mod-score').textContent = nq.won ? nq.totalScore : 0;
    document.getElementById('nq-mod-best').textContent = nq.highscore;
    const breakdown = document.getElementById('nq-mod-breakdown');
    if (nq.won) {
      const remaining = Math.ceil(nq.timer);
      breakdown.innerHTML = `L${nq.level}: ${remaining}s + ${nq.level * 50} bonus = <b>${nq.finalScore}</b>`;
      nextBtn.style.display = '';
      nextBtn.textContent = `Level ${nq.level + 1} → ${nq.sticksRequired + 1} 🪵 + ${nq.wormsRequired + 1} 🪱`;
      // Win = forward only. No "Try again" — every level is a fresh
      // procedural world, so replaying the same level is meaningless.
      retryBtn.style.display = 'none';
    } else {
      breakdown.innerHTML = nq.questComplete
        ? 'You had everything but didn\'t reach the nest in time.'
        : `You collected ${nq.sticks} stick${nq.sticks === 1 ? '' : 's'} and ${nq.worms} worm${nq.worms === 1 ? '' : 's'}.`;
      nextBtn.style.display = 'none';
      retryBtn.style.display = '';
    }
    this._modal.classList.add('visible');
  }

  /** Big centred "⚡ SPEED BOOST" pop on speed-arrow pickup. */
  flashSpeedBoost(seconds, multiplier = 2) {
    const flash = document.createElement('div');
    flash.className = 'nq-boost-flash';
    const subtitle = multiplier > 2
      ? `${seconds}s · ${multiplier}× SPEED!!`
      : `${seconds}s · ${multiplier}× speed`;
    flash.innerHTML = `<b>⚡ SPEED BOOST</b><br><span>${subtitle}</span>`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1700);
  }

  /** Brief "+30s" flash next to the timer chip on a clock pickup. */
  flashTimerRecharge(seconds) {
    const chip = document.getElementById('nq-timer-chip');
    if (!chip) return;
    chip.classList.remove('pulse');
    void chip.offsetWidth;
    chip.classList.add('pulse');
    const flash = document.createElement('div');
    flash.className = 'nq-recharge-flash';
    flash.textContent = `+${seconds}s`;
    chip.appendChild(flash);
    setTimeout(() => flash.remove(), 1100);
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
