import * as THREE from 'three';

// --- Shared helpers for realistic tree rendering ---

/** Draw a trunk with bark texture and taper */
function drawTrunk(ctx, cx, topY, botY, topW, botW, baseColor, darkColor) {
  // Tapered trunk shape
  ctx.beginPath();
  ctx.moveTo(cx - topW / 2, topY);
  ctx.lineTo(cx - botW / 2, botY);
  ctx.lineTo(cx + botW / 2, botY);
  ctx.lineTo(cx + topW / 2, topY);
  ctx.closePath();
  ctx.fillStyle = baseColor;
  ctx.fill();

  // Bark lines
  const trunkH = botY - topY;
  for (let i = 0; i < 15; i++) {
    const y = topY + Math.random() * trunkH;
    const t = (y - topY) / trunkH;
    const w = topW + (botW - topW) * t;
    const lx = cx - w / 2 + Math.random() * w;
    const ll = 2 + Math.random() * (w * 0.6);
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.globalAlpha = 0.3 + Math.random() * 0.3;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx + (Math.random() - 0.5) * 2, y + 3 + Math.random() * 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Draw branch hints extending from trunk */
function drawBranches(ctx, cx, trunkTop, trunkBot, spread, color) {
  const count = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const t = 0.15 + Math.random() * 0.5;
    const y = trunkTop + t * (trunkBot - trunkTop);
    const dir = Math.random() > 0.5 ? 1 : -1;
    const len = spread * (0.3 + Math.random() * 0.5);
    const endY = y - 5 - Math.random() * 15;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(cx + dir * len * 0.6, y - 5, cx + dir * len, endY);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Draw a cluster of leaf blobs with irregular edges */
function drawLeafCluster(ctx, x, y, radius, colors, density = 60) {
  // Background shadow
  const shadowGrad = ctx.createRadialGradient(x + 2, y + 3, 0, x + 2, y + 3, radius * 1.05);
  shadowGrad.addColorStop(0, 'rgba(0, 20, 0, 0.3)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.arc(x + 2, y + 3, radius * 1.05, 0, Math.PI * 2);
  ctx.fill();

  // Main foliage mass — irregular edge via many small overlapping circles
  for (let i = 0; i < density; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius * 0.85;
    const lx = x + Math.cos(angle) * dist;
    const ly = y + Math.sin(angle) * dist * 0.9; // slightly flattened
    const lr = 3 + Math.random() * (radius * 0.25);
    const color = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Highlights on top half
  for (let i = 0; i < density * 0.3; i++) {
    const angle = -Math.PI * 0.8 + Math.random() * Math.PI * 0.6;
    const dist = Math.random() * radius * 0.7;
    const lx = x + Math.cos(angle) * dist;
    const ly = y + Math.sin(angle) * dist;
    const lr = 2 + Math.random() * (radius * 0.15);
    ctx.fillStyle = 'rgba(120, 200, 80, 0.3)';
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Generate a realistic oak/deciduous tree texture (256x512).
 */
export function generateTreeCanvas(width = 256, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const trunkTop = height * 0.42;
  const trunkBot = height * 0.98;

  // Trunk
  drawTrunk(ctx, cx, trunkTop, trunkBot, width * 0.06, width * 0.09, '#5a3a1a', '#3a2510');

  // Branch hints
  drawBranches(ctx, cx, trunkTop, trunkTop + (trunkBot - trunkTop) * 0.4, width * 0.3, '#4a2a12');

  // Crown — multiple overlapping clusters for organic shape
  const greens = [
    'rgb(35, 85, 25)', 'rgb(45, 105, 30)', 'rgb(55, 120, 35)',
    'rgb(40, 95, 28)', 'rgb(60, 130, 40)', 'rgb(30, 75, 20)',
  ];

  // Large base clusters
  drawLeafCluster(ctx, cx - width * 0.08, height * 0.32, width * 0.28, greens, 80);
  drawLeafCluster(ctx, cx + width * 0.1, height * 0.28, width * 0.25, greens, 70);
  drawLeafCluster(ctx, cx, height * 0.2, width * 0.22, greens, 60);
  drawLeafCluster(ctx, cx - width * 0.05, height * 0.12, width * 0.16, greens, 40);
  // Small asymmetric accents
  drawLeafCluster(ctx, cx + width * 0.18, height * 0.35, width * 0.12, greens, 25);
  drawLeafCluster(ctx, cx - width * 0.2, height * 0.25, width * 0.1, greens, 20);

  return canvas;
}

/**
 * Generate a realistic pine/conifer texture (256x512).
 */
export function generatePineCanvas(width = 256, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;

  // Trunk — thin, dark, tapered
  drawTrunk(ctx, cx, height * 0.12, height * 0.98, width * 0.03, width * 0.05, '#3a2008', '#2a1505');

  // Conical crown: stacked drooping branch layers
  const layers = 8;
  const darkGreens = [
    'rgb(15, 55, 15)', 'rgb(20, 65, 20)', 'rgb(25, 75, 25)',
    'rgb(18, 60, 18)', 'rgb(30, 80, 28)',
  ];

  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const layerY = height * 0.08 + t * height * 0.6;
    const layerW = width * 0.06 + (1 - t) * width * 0.2;
    const layerH = height * 0.08;

    // Draw each layer as a cluster of small triangular needles
    const needles = 20 + Math.floor((1 - t) * 15);
    for (let n = 0; n < needles; n++) {
      const nx = cx + (Math.random() - 0.5) * layerW * 2;
      const ny = layerY + Math.random() * layerH;
      const nw = 3 + Math.random() * 6;
      const nh = 4 + Math.random() * 8;
      const color = darkGreens[Math.floor(Math.random() * darkGreens.length)];
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.moveTo(nx, ny - nh);
      ctx.lineTo(nx - nw, ny + nh * 0.3);
      ctx.lineTo(nx + nw, ny + nh * 0.3);
      ctx.closePath();
      ctx.fill();
    }

    // Drooping branch silhouette
    ctx.fillStyle = darkGreens[i % darkGreens.length];
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, layerY - layerH * 0.5);
    // Left droop
    ctx.quadraticCurveTo(cx - layerW * 0.8, layerY, cx - layerW, layerY + layerH * 0.6);
    ctx.lineTo(cx + layerW, layerY + layerH * 0.6);
    // Right droop
    ctx.quadraticCurveTo(cx + layerW * 0.8, layerY, cx, layerY - layerH * 0.5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Snow caps on top layers (subtle)
  for (let i = 0; i < 8; i++) {
    const sx = cx + (Math.random() - 0.5) * width * 0.15;
    const sy = height * 0.05 + Math.random() * height * 0.15;
    ctx.fillStyle = 'rgba(220, 230, 240, 0.15)';
    ctx.beginPath();
    ctx.arc(sx, sy, 3 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * Generate a realistic birch tree texture (256x512).
 */
export function generateBirchCanvas(width = 256, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;

  // White trunk with characteristic dark marks
  const trunkTop = height * 0.3;
  const trunkBot = height * 0.98;
  const topW = width * 0.04;
  const botW = width * 0.06;

  // Base trunk
  ctx.beginPath();
  ctx.moveTo(cx - topW / 2, trunkTop);
  ctx.lineTo(cx - botW / 2, trunkBot);
  ctx.lineTo(cx + botW / 2, trunkBot);
  ctx.lineTo(cx + topW / 2, trunkTop);
  ctx.closePath();
  ctx.fillStyle = '#e8e0d0';
  ctx.fill();

  // Birch bark: horizontal dark bands
  const trunkH = trunkBot - trunkTop;
  for (let i = 0; i < 20; i++) {
    const y = trunkTop + Math.random() * trunkH;
    const t = (y - trunkTop) / trunkH;
    const w = topW + (botW - topW) * t;
    ctx.fillStyle = `rgba(50, 40, 35, ${0.2 + Math.random() * 0.4})`;
    const bandH = 1 + Math.random() * 2;
    ctx.fillRect(cx - w / 2, y, w, bandH);
  }

  // Peeling bark texture
  for (let i = 0; i < 6; i++) {
    const y = trunkTop + Math.random() * trunkH;
    const t = (y - trunkTop) / trunkH;
    const w = topW + (botW - topW) * t;
    ctx.strokeStyle = 'rgba(180, 170, 155, 0.5)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    const curl = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3);
    ctx.moveTo(cx - w / 2, y);
    ctx.quadraticCurveTo(cx - w / 2 - curl, y + 5, cx - w / 2, y + 10);
    ctx.stroke();
  }

  // Branch hints
  drawBranches(ctx, cx, trunkTop, trunkTop + trunkH * 0.3, width * 0.2, '#b0a090');

  // Crown — lighter, more airy than oak
  const birchGreens = [
    'rgb(80, 160, 50)', 'rgb(90, 175, 60)', 'rgb(100, 185, 70)',
    'rgb(110, 190, 75)', 'rgb(70, 145, 45)', 'rgb(120, 200, 80)',
  ];

  // Airy clusters — smaller and more scattered
  drawLeafCluster(ctx, cx - width * 0.06, height * 0.24, width * 0.18, birchGreens, 50);
  drawLeafCluster(ctx, cx + width * 0.08, height * 0.2, width * 0.16, birchGreens, 45);
  drawLeafCluster(ctx, cx, height * 0.14, width * 0.14, birchGreens, 35);
  drawLeafCluster(ctx, cx + width * 0.15, height * 0.28, width * 0.1, birchGreens, 20);
  drawLeafCluster(ctx, cx - width * 0.14, height * 0.17, width * 0.08, birchGreens, 15);

  return canvas;
}

/**
 * Generate a realistic bush texture (256x256).
 */
export function generateBushCanvas(width = 256, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height * 0.55;

  const bushGreens = [
    'rgb(30, 70, 18)', 'rgb(40, 85, 25)', 'rgb(50, 100, 30)',
    'rgb(35, 78, 22)', 'rgb(55, 110, 35)', 'rgb(25, 62, 15)',
  ];

  // Dense, rounded mass
  drawLeafCluster(ctx, cx, cy, width * 0.38, bushGreens, 100);
  drawLeafCluster(ctx, cx - width * 0.1, cy - height * 0.05, width * 0.25, bushGreens, 50);
  drawLeafCluster(ctx, cx + width * 0.12, cy + height * 0.03, width * 0.2, bushGreens, 40);

  // Some flowers/berries for realism
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * width * 0.25;
    const bx = cx + Math.cos(angle) * dist;
    const by = cy + Math.sin(angle) * dist * 0.7;
    ctx.fillStyle = Math.random() > 0.5
      ? `rgba(200, 60, 40, ${0.4 + Math.random() * 0.3})`
      : `rgba(220, 200, 60, ${0.3 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(bx, by, 1.5 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * Create 3D tree geometry (trunk cylinder + crown).
 * Type determines crown shape: 'oak'=sphere, 'pine'=cone, 'birch'=ellipsoid, 'bush'=flat sphere
 */
export function createTreeGeometry(treeHeight = 1, treeWidth = 0.8, type = 'oak') {
  const parts = [];
  const trunkH = treeHeight * 0.5;
  const crownH = treeHeight * 0.55;
  const trunkR = treeWidth * 0.06;

  // Trunk (low-poly cylinder)
  const trunk = new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 5);
  trunk.translate(0, trunkH / 2, 0);
  parts.push(trunk);

  if (type === 'pine') {
    // Pine: stacked cones
    for (let i = 0; i < 3; i++) {
      const t = i / 3;
      const coneR = treeWidth * (0.35 - t * 0.1);
      const coneH = crownH * 0.45;
      const cone = new THREE.ConeGeometry(coneR, coneH, 6);
      cone.translate(0, trunkH + t * crownH * 0.35 + coneH * 0.4, 0);
      parts.push(cone);
    }
  } else if (type === 'birch') {
    // Birch: elongated ellipsoid crown
    const crown = new THREE.SphereGeometry(treeWidth * 0.25, 6, 5);
    crown.scale(1, 1.4, 1);
    crown.translate(0, trunkH + crownH * 0.35, 0);
    parts.push(crown);
  } else if (type === 'bush') {
    // Bush: flat wide sphere, no visible trunk
    const bush = new THREE.SphereGeometry(treeWidth * 0.5, 6, 4);
    bush.scale(1, 0.5, 1);
    bush.translate(0, treeHeight * 0.25, 0);
    parts.push(bush);
  } else {
    // Oak: round crown (2 overlapping spheres for organic look)
    const crown1 = new THREE.SphereGeometry(treeWidth * 0.35, 6, 5);
    crown1.translate(0, trunkH + crownH * 0.3, 0);
    parts.push(crown1);
    const crown2 = new THREE.SphereGeometry(treeWidth * 0.25, 5, 4);
    crown2.translate(treeWidth * 0.1, trunkH + crownH * 0.5, treeWidth * 0.05);
    parts.push(crown2);
  }

  return mergeGeometries(parts);
}

/**
 * Simple geometry merge (no dependency on BufferGeometryUtils).
 */
function mergeGeometries(geometries) {
  let totalVertices = 0;
  let totalIndices = 0;

  for (const geo of geometries) {
    totalVertices += geo.attributes.position.count;
    totalIndices += geo.index ? geo.index.count : 0;
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const uvs = new Float32Array(totalVertices * 2);
  const indices = [];

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const geo of geometries) {
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const uv = geo.attributes.uv;

    for (let i = 0; i < pos.count; i++) {
      positions[(vertexOffset + i) * 3] = pos.getX(i);
      positions[(vertexOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertexOffset + i) * 3 + 2] = pos.getZ(i);

      normals[(vertexOffset + i) * 3] = norm.getX(i);
      normals[(vertexOffset + i) * 3 + 1] = norm.getY(i);
      normals[(vertexOffset + i) * 3 + 2] = norm.getZ(i);

      uvs[(vertexOffset + i) * 2] = uv.getX(i);
      uvs[(vertexOffset + i) * 2 + 1] = uv.getY(i);
    }

    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) {
        indices.push(geo.index.array[i] + vertexOffset);
      }
    }

    vertexOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (indices.length > 0) {
    merged.setIndex(indices);
  }

  return merged;
}
