const MAX_DELTA = 1 / 30; // cap at ~33ms to avoid spiral of death

export class GameLoop {
  constructor() {
    this._callbacks = [];
    this._running = false;
    this._lastTime = 0;
  }

  /** Register an update callback: fn(deltaSeconds) */
  onUpdate(fn) {
    this._callbacks.push(fn);
  }

  start() {
    this._running = true;
    this._lastTime = performance.now();
    this._tick();
  }

  stop() {
    this._running = false;
  }

  _tick() {
    if (!this._running) return;
    requestAnimationFrame(() => this._tick());

    const now = performance.now();
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;

    // Clamp delta to avoid huge jumps after tab switch
    if (dt > MAX_DELTA) dt = MAX_DELTA;

    for (const fn of this._callbacks) {
      fn(dt);
    }
  }
}
