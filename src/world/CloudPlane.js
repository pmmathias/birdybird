import * as THREE from 'three';
import { CLOUD_HEIGHT, CLOUD_COUNT, WORLD_HALF } from '../constants.js';
import { randomRange } from '../utils/math.js';

const CLOUD_SPREAD = WORLD_HALF * 3;

/**
 * Generate a procedural cloud sprite texture.
 */
function generateCloudCanvas() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  const blobCount = 8 + Math.floor(Math.random() * 6);
  for (let i = 0; i < blobCount; i++) {
    const x = size / 2 + (Math.random() - 0.5) * size * 0.5;
    const y = size / 2 + (Math.random() - 0.5) * size * 0.3;
    const r = 30 + Math.random() * 50;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * Create multi-layer cloud system for depth and height feeling.
 * Low clouds (100-150m), mid clouds (200m), high clouds (350-500m).
 */
export function createCloudLayer() {
  const group = new THREE.Group();
  group.name = 'clouds';

  const cloudTextures = [];
  for (let i = 0; i < 4; i++) {
    cloudTextures.push(new THREE.CanvasTexture(generateCloudCanvas()));
  }

  const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  const mobileFactor = IS_MOBILE ? 0.3 : 1;

  // Cloud layers: low (wispy), mid (main), high (thin cirrus)
  const layers = [
    { count: Math.floor(60 * mobileFactor), yMin: 60, yMax: 130, scaleMin: 60, scaleMax: 200, opacity: 0.25, flat: 0.2 },
    { count: Math.floor(200 * mobileFactor), yMin: 140, yMax: 280, scaleMin: 100, scaleMax: 400, opacity: 0.5, flat: 0.3 },
    { count: Math.floor(120 * mobileFactor), yMin: 280, yMax: 420, scaleMin: 150, scaleMax: 500, opacity: 0.4, flat: 0.25 },
    { count: Math.floor(80 * mobileFactor), yMin: 420, yMax: 600, scaleMin: 250, scaleMax: 700, opacity: 0.2, flat: 0.15 },
  ];

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const tex = cloudTextures[Math.floor(Math.random() * cloudTextures.length)];
      const material = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: layer.opacity + Math.random() * 0.2,
        depthWrite: false,
      });

      const sprite = new THREE.Sprite(material);
      const scale = randomRange(layer.scaleMin, layer.scaleMax);
      sprite.scale.set(scale, scale * layer.flat, 1);
      sprite.position.set(
        randomRange(-CLOUD_SPREAD, CLOUD_SPREAD),
        randomRange(layer.yMin, layer.yMax),
        randomRange(-CLOUD_SPREAD, CLOUD_SPREAD),
      );

      group.add(sprite);
    }
  }

  // Drift speeds per cloud
  const driftSpeeds = group.children.map(() => ({
    x: randomRange(-2, 2),
    z: randomRange(-1, 1),
  }));

  function update(dt) {
    for (let i = 0; i < group.children.length; i++) {
      const cloud = group.children[i];
      const speed = driftSpeeds[i];
      cloud.position.x += speed.x * dt;
      cloud.position.z += speed.z * dt;

      if (cloud.position.x > CLOUD_SPREAD) cloud.position.x = -CLOUD_SPREAD;
      if (cloud.position.x < -CLOUD_SPREAD) cloud.position.x = CLOUD_SPREAD;
      if (cloud.position.z > CLOUD_SPREAD) cloud.position.z = -CLOUD_SPREAD;
      if (cloud.position.z < -CLOUD_SPREAD) cloud.position.z = CLOUD_SPREAD;
    }
  }

  return { group, update };
}
