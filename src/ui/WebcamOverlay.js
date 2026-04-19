/**
 * Webcam overlay with gesture guide — shows camera feed surrounded by
 * stick figure gesture reference cards. Active gesture is highlighted.
 */

// Gesture definitions with stick figure drawing functions
const GESTURES = [
  { id: 'FLAP!', label: 'Flap', desc: 'Hands up+down', color: '#ffdd00' },
  { id: 'GLIDE', label: 'Glide', desc: 'Hands above', color: '#66ccff' },
  { id: 'DIVE', label: 'Dive', desc: 'Hands below', color: '#ff4444' },
  { id: 'CLIMB', label: 'Climb', desc: 'Arms high', color: '#44ff88' },
  { id: 'TURN LEFT', label: 'Turn L', desc: 'Left arm up', color: '#ff88ff' },
  { id: 'TURN RIGHT', label: 'Turn R', desc: 'Right arm up', color: '#ffaa44' },
];

function drawStickFigure(ctx, x, y, w, h, gestureId) {
  const cx = x + w / 2;
  const headY = y + h * 0.15;
  const shoulderY = y + h * 0.3;
  const hipY = y + h * 0.6;
  const footY = y + h * 0.9;
  const armLen = w * 0.35;

  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  // Head
  ctx.beginPath();
  ctx.arc(cx, headY, h * 0.08, 0, Math.PI * 2);
  ctx.stroke();

  // Spine
  ctx.beginPath();
  ctx.moveTo(cx, headY + h * 0.08);
  ctx.lineTo(cx, hipY);
  ctx.stroke();

  // Legs
  ctx.beginPath();
  ctx.moveTo(cx, hipY);
  ctx.lineTo(cx - w * 0.15, footY);
  ctx.moveTo(cx, hipY);
  ctx.lineTo(cx + w * 0.15, footY);
  ctx.stroke();

  // Arms (gesture-specific)
  const lsx = cx, rsx = cx; // shoulder x
  let lax, lay, rax, ray; // arm end positions

  switch (gestureId) {
    case 'FLAP!': // arms angled up with motion arrows
      lax = cx - armLen; lay = shoulderY - h * 0.15;
      rax = cx + armLen; ray = shoulderY - h * 0.15;
      break;
    case 'GLIDE': // arms horizontal
      lax = cx - armLen; lay = shoulderY;
      rax = cx + armLen; ray = shoulderY;
      break;
    case 'DIVE': // ducking down — figure crouched lower
      lax = cx - armLen * 0.7; lay = shoulderY + h * 0.15;
      rax = cx + armLen * 0.7; ray = shoulderY + h * 0.15;
      // Draw downward arrow to indicate "duck"
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.02);
      ctx.lineTo(cx, y + h * 0.15);
      ctx.moveTo(cx - 3, y + h * 0.11);
      ctx.lineTo(cx, y + h * 0.15);
      ctx.lineTo(cx + 3, y + h * 0.11);
      ctx.stroke();
      break;
    case 'CLIMB': // arms spread, body leaned back
      lax = cx - armLen; lay = shoulderY - h * 0.1;
      rax = cx + armLen; ray = shoulderY - h * 0.1;
      break;
    case 'TURN LEFT': // left arm up, right arm horizontal
      lax = cx - armLen * 0.7; lay = shoulderY - h * 0.25;
      rax = cx + armLen; ray = shoulderY + h * 0.05;
      break;
    case 'TURN RIGHT': // right arm up, left arm horizontal
      lax = cx - armLen; lay = shoulderY + h * 0.05;
      rax = cx + armLen * 0.7; ray = shoulderY - h * 0.25;
      break;
    default:
      lax = cx - armLen; lay = shoulderY;
      rax = cx + armLen; ray = shoulderY;
  }

  ctx.beginPath();
  ctx.moveTo(lsx, shoulderY);
  ctx.lineTo(lax, lay);
  ctx.moveTo(rsx, shoulderY);
  ctx.lineTo(rax, ray);
  ctx.stroke();

  // Motion arrows for flap
  if (gestureId === 'FLAP!') {
    const arrowY1 = shoulderY - h * 0.25;
    const arrowY2 = shoulderY + h * 0.05;
    for (const dx of [-armLen * 0.6, armLen * 0.6]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, arrowY2);
      ctx.lineTo(cx + dx, arrowY1);
      ctx.moveTo(cx + dx - 3, arrowY1 + 5);
      ctx.lineTo(cx + dx, arrowY1);
      ctx.lineTo(cx + dx + 3, arrowY1 + 5);
      ctx.stroke();
    }
  }
}

export class WebcamOverlay {
  constructor(video) {
    this.video = video;
    this._currentGesture = 'GLIDE';

    // Main container — bottom center
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 200;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);

    // Left gesture cards
    this._leftCards = this._createCardColumn(GESTURES.slice(0, 3));
    this.container.appendChild(this._leftCards);

    // Webcam feed (center)
    this._videoContainer = document.createElement('div');
    this._videoContainer.style.cssText = `
      width: 220px;
      height: 165px;
      border: 2px solid rgba(255,255,255,0.4);
      border-radius: 8px;
      overflow: hidden;
      position: relative;
      background: rgba(0,0,0,0.5);
    `;
    if (video) {
      const vid = video.cloneNode();
      vid.srcObject = video.srcObject;
      vid.style.cssText = 'width:100%;height:100%;object-fit:cover;transform:scaleX(-1);';
      vid.play();
      this._videoContainer.appendChild(vid);
    }
    // Skeleton canvas on top of video
    this.canvas = document.createElement('canvas');
    this.canvas.width = 220;
    this.canvas.height = 165;
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    this._videoContainer.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this._videoContainer);

    // Right gesture cards
    this._rightCards = this._createCardColumn(GESTURES.slice(3, 6));
    this.container.appendChild(this._rightCards);

    // Card elements map for highlighting
    this._cardElements = {};
    this.container.querySelectorAll('[data-gesture]').forEach(el => {
      this._cardElements[el.dataset.gesture] = el;
    });
  }

  _createCardColumn(gestures) {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    for (const g of gestures) {
      const card = document.createElement('div');
      card.dataset.gesture = g.id;
      card.style.cssText = `
        width: 80px;
        height: 70px;
        border: 2px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(0,0,0,0.4);
        padding: 2px;
        transition: border-color 0.2s, background 0.2s;
        position: relative;
      `;

      // Stick figure canvas
      const fc = document.createElement('canvas');
      fc.width = 76;
      fc.height = 45;
      fc.style.cssText = 'width:100%;display:block;';
      const fctx = fc.getContext('2d');
      fctx.strokeStyle = 'rgba(255,255,255,0.7)';
      drawStickFigure(fctx, 0, 0, 76, 45, g.id);
      card.appendChild(fc);

      // Label
      const label = document.createElement('div');
      label.style.cssText = `
        text-align:center;font-size:9px;color:rgba(255,255,255,0.7);
        font-family:sans-serif;line-height:1.1;
      `;
      label.innerHTML = `<b>${g.label}</b><br>${g.desc}`;
      card.appendChild(label);

      col.appendChild(card);
    }
    return col;
  }

  drawSkeleton(landmarks) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!landmarks) {
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff6666';
      ctx.fillText('No tracking', w / 2, h / 2);
      return;
    }

    const connections = [
      [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 12], [11, 23], [12, 24], [23, 24],
    ];

    ctx.strokeStyle = 'rgba(0, 255, 128, 0.8)';
    ctx.lineWidth = 2;
    for (const [a, b] of connections) {
      const la = landmarks[a], lb = landmarks[b];
      if (!la || !lb) continue;
      ctx.beginPath();
      ctx.moveTo((1 - la.x) * w, la.y * h);
      ctx.lineTo((1 - lb.x) * w, lb.y * h);
      ctx.stroke();
    }

    // Wrists: green = visible, red = out of frame
    for (const idx of [15, 16]) {
      const lm = landmarks[idx];
      if (!lm) continue;
      const vis = (lm.visibility ?? 1) > 0.4 && lm.x > 0.01 && lm.x < 0.99;
      ctx.fillStyle = vis ? 'rgba(50,255,100,1)' : 'rgba(255,50,50,1)';
      ctx.beginPath();
      ctx.arc((1 - lm.x) * w, lm.y * h, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const idx of [11, 12, 13, 14]) {
      const lm = landmarks[idx];
      if (!lm) continue;
      ctx.fillStyle = 'rgba(255,200,50,0.9)';
      ctx.beginPath();
      ctx.arc((1 - lm.x) * w, lm.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  showGesture(gesture) {
    this._currentGesture = gesture;

    // Highlight active card, dim others
    for (const [id, el] of Object.entries(this._cardElements)) {
      if (id === gesture) {
        const g = GESTURES.find(g => g.id === id);
        el.style.borderColor = g ? g.color : '#fff';
        el.style.background = 'rgba(255,255,255,0.15)';
      } else {
        el.style.borderColor = 'rgba(255,255,255,0.2)';
        el.style.background = 'rgba(0,0,0,0.4)';
      }
    }

    // Gesture label on video
    const ctx = this.ctx;
    const w = this.canvas.width;
    const g = GESTURES.find(g => g.id === gesture);
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = g ? g.color : '#fff';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText(gesture, w / 2, 20);
    ctx.shadowBlur = 0;
  }

  show() { this.container.style.display = 'flex'; }
  hide() { this.container.style.display = 'none'; }
}
