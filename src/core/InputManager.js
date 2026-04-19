/**
 * Abstracts control input from keyboard and pose detection.
 * T toggles between pose and keyboard mode.
 * Exposes normalized values: lift (0-1), roll (-1..1), pitch (-1..1), wingSpread (0..1).
 */
export class InputManager {
  constructor() {
    this.lift = 0;
    this.roll = 0;
    this.pitch = 0;
    this.wingSpread = 1.0;

    // Source tracking
    this.source = 'keyboard'; // 'keyboard' or 'pose'
    this.forceKeyboard = false; // T toggles this
    this.poseAvailable = false; // set true when webcam+pose is ready
    this.onModeChange = null;  // callback when mode changes

    this._keys = {};

    // Pose input (set externally by ArmAnalyzer)
    this._poseInput = null;

    window.addEventListener('keydown', (e) => {
      this._keys[e.code] = true;
      if (e.code === 'KeyT') {
        this.forceKeyboard = !this.forceKeyboard;
        const mode = this.forceKeyboard ? 'KEYBOARD' : 'WEBCAM';
        console.log(`Input mode: ${mode}`);
        // Show brief overlay notification
        let overlay = document.getElementById('mode-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'mode-overlay';
          overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:white;font-size:32px;font-family:sans-serif;text-shadow:2px 2px 4px rgba(0,0,0,0.8);pointer-events:none;z-index:200;transition:opacity 0.5s;';
          document.body.appendChild(overlay);
        }
        overlay.textContent = `Mode: ${mode}`;
        overlay.style.opacity = '1';
        setTimeout(() => { overlay.style.opacity = '0'; }, 1500);
        // Notify main.js to show/hide webcam overlay
        if (this.onModeChange) this.onModeChange(this.forceKeyboard);
      }
    });
    window.addEventListener('keyup', (e) => { this._keys[e.code] = false; });
    // Track jump as single press (not held)
    this._jumpPressed = false;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) this._jumpPressed = true;
    });
  }

  /**
   * Set pose input from ArmAnalyzer.
   * @param {{ flapStrength: number, roll: number, pitch: number, wingSpread: number }|null} poseData
   */
  setPoseInput(poseData) {
    this._poseInput = poseData;
  }

  update(dt) {
    // Pose mode: ALWAYS active when webcam is available and not forced to keyboard
    // No activation threshold — ArmAnalyzer always provides sensible defaults (GLIDE)
    if (!this.forceKeyboard && this.poseAvailable && this._poseInput) {
      this.source = 'pose';
      this.lift = this._poseInput.flapStrength;
      this.roll = this._poseInput.roll;
      this.pitch = this._poseInput.pitch;
      this.wingSpread = this._poseInput.wingSpread ?? 1.0;
      // No override — pitch and wingSpread are already stufenlos from ArmAnalyzer
      return;
    }

    // Keyboard mode — simulate bird gestures
    this.source = 'keyboard';

    // Space = flap (FlightPhysics.flap() handles its own cooldown)
    this.lift = this._keys['Space'] ? 1 : 0;

    // A/D = roll (banking turns)
    this.roll = 0;
    if (this._keys['KeyA'] || this._keys['ArrowLeft']) this.roll = 1;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) this.roll = -1;

    // W = tuck wings + dive (arms down)
    // S = spread wings + lean back (climbing glide)
    // Nothing = spread wings, neutral pitch (gliding descent)
    if (this._keys['KeyW'] || this._keys['ArrowUp']) {
      this.wingSpread = 0;    // wings tucked → nosedive
      this.pitch = -0.5;      // slight nose-down assist
    } else if (this._keys['KeyS'] || this._keys['ArrowDown']) {
      this.wingSpread = 1.0;  // wings fully spread
      this.pitch = 0.6;       // lean back → climb
    } else {
      this.wingSpread = 1.0;  // wings spread
      this.pitch = 0;         // neutral → gentle glide
    }
  }

  /**
   * Ground movement input (WASD + arrows + space + shift).
   * W/S = forward/back, A/D = strafe, Arrows L/R = turn, Space = jump, Shift = sprint.
   */
  getGroundInput() {
    let forward = 0, strafe = 0, turn = 0;
    if (this._keys['KeyW'] || this._keys['ArrowUp']) forward = 1;
    if (this._keys['KeyS'] || this._keys['ArrowDown']) forward = -1;
    if (this._keys['KeyA']) strafe = 1;
    if (this._keys['KeyD']) strafe = -1;
    if (this._keys['ArrowLeft']) turn = 1;
    if (this._keys['ArrowRight']) turn = -1;
    const sprint = this._keys['ShiftLeft'] || this._keys['ShiftRight'];
    return { forward, strafe, turn, sprint };
  }
}
