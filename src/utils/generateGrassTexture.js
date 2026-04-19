/**
 * Generates a procedural seamless grass texture on a canvas.
 * Returns a canvas element that can be used as a Three.js texture source.
 */
export function generateGrassCanvas(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base green
  ctx.fillStyle = '#3a7d32';
  ctx.fillRect(0, 0, size, size);

  // Random grass blades
  const bladeCount = 3000;
  for (let i = 0; i < bladeCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = 3 + Math.random() * 8;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;

    const green = 80 + Math.floor(Math.random() * 80);
    const red = 30 + Math.floor(Math.random() * 40);
    ctx.strokeStyle = `rgb(${red}, ${green}, 20)`;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  // Some darker patches for variation
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 10 + Math.random() * 25;
    ctx.fillStyle = `rgba(20, 60, 15, ${0.1 + Math.random() * 0.15})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}
