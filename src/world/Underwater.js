import * as THREE from 'three';
import { randomRange } from '../utils/math.js';
import { getTerrainHeight } from './Terrain.js';
import { WORLD_HALF, WATER_LEVEL } from '../constants.js';

// === PROCEDURAL TEXTURE GENERATORS ===

function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { canvas: c, ctx: c.getContext('2d') };
}

/** Colorful tropical fish */
function genTropicalFish(hue) {
  const { canvas, ctx } = createCanvas(128, 64);
  // Body
  const bodyGrad = ctx.createLinearGradient(20, 10, 20, 54);
  bodyGrad.addColorStop(0, `hsl(${hue}, 80%, 65%)`);
  bodyGrad.addColorStop(0.5, `hsl(${hue}, 90%, 50%)`);
  bodyGrad.addColorStop(1, `hsl(${hue + 20}, 70%, 40%)`);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(55, 32, 35, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Stripes (glittering effect)
  for (let i = 0; i < 5; i++) {
    const sx = 30 + i * 12;
    ctx.strokeStyle = `hsla(${hue + 40}, 100%, 80%, 0.4)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, 18); ctx.lineTo(sx + 3, 46);
    ctx.stroke();
  }
  // Tail
  ctx.fillStyle = `hsl(${hue + 10}, 85%, 55%)`;
  ctx.beginPath();
  ctx.moveTo(90, 32); ctx.lineTo(120, 12); ctx.lineTo(120, 52); ctx.closePath();
  ctx.fill();
  // Fins
  ctx.fillStyle = `hsla(${hue - 10}, 70%, 60%, 0.7)`;
  ctx.beginPath();
  ctx.ellipse(50, 14, 15, 8, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(30, 28, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(31, 28, 2.5, 0, Math.PI * 2); ctx.fill();
  // Glitter spots
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `hsla(${hue + 60}, 100%, 90%, ${0.3 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(35 + Math.random() * 40, 20 + Math.random() * 24, 1 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/** Shark silhouette */
function genShark() {
  const { canvas, ctx } = createCanvas(192, 64);
  // Body
  const grad = ctx.createLinearGradient(0, 10, 0, 54);
  grad.addColorStop(0, '#556677');
  grad.addColorStop(0.6, '#445566');
  grad.addColorStop(1, '#e8e8e8');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(10, 32);
  ctx.quadraticCurveTo(50, 10, 120, 20);
  ctx.lineTo(165, 30);
  ctx.lineTo(185, 15); ctx.lineTo(180, 35);
  ctx.lineTo(185, 55); ctx.lineTo(165, 38);
  ctx.lineTo(120, 44);
  ctx.quadraticCurveTo(50, 54, 10, 32);
  ctx.fill();
  // Dorsal fin
  ctx.fillStyle = '#445566';
  ctx.beginPath();
  ctx.moveTo(80, 20); ctx.lineTo(95, 2); ctx.lineTo(110, 20); ctx.closePath();
  ctx.fill();
  // Eye
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(28, 30, 3, 0, Math.PI * 2); ctx.fill();
  // Gill slits
  ctx.strokeStyle = '#334455';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(42 + i * 5, 26); ctx.lineTo(42 + i * 5, 38); ctx.stroke();
  }
  return canvas;
}

/** Whale (large, majestic) */
function genWhale(type) {
  const { canvas, ctx } = createCanvas(256, 96);
  const isHumpback = type === 'humpback';
  // Body
  const grad = ctx.createLinearGradient(0, 10, 0, 86);
  grad.addColorStop(0, isHumpback ? '#3a4a5a' : '#2a3a4a');
  grad.addColorStop(0.7, isHumpback ? '#4a5a6a' : '#3a4a5a');
  grad.addColorStop(1, '#8a9aaa');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(15, 48);
  ctx.quadraticCurveTo(60, 12, 160, 25);
  ctx.quadraticCurveTo(200, 35, 220, 40);
  ctx.lineTo(250, 25); ctx.lineTo(245, 48); ctx.lineTo(250, 70);
  ctx.lineTo(220, 55);
  ctx.quadraticCurveTo(200, 60, 160, 70);
  ctx.quadraticCurveTo(60, 82, 15, 48);
  ctx.fill();
  // Belly
  ctx.fillStyle = isHumpback ? '#8a9aaa' : '#7a8a9a';
  ctx.beginPath();
  ctx.ellipse(100, 65, 70, 15, 0, 0, Math.PI);
  ctx.fill();
  // Eye
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(35, 44, 3, 0, Math.PI * 2); ctx.fill();
  // Humpback: bumps on head
  if (isHumpback) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#4a5a6a';
      ctx.beginPath();
      ctx.arc(20 + i * 8, 35 + Math.random() * 8, 2 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Pectoral fin
  ctx.fillStyle = isHumpback ? '#3a4a5a' : '#2a3a4a';
  ctx.beginPath();
  ctx.ellipse(80, 68, isHumpback ? 35 : 20, 8, 0.2, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

/** Spongebob-style coral — colorful, cartoonish */
function genCoral(type) {
  const { canvas, ctx } = createCanvas(64, 96);
  const colors = {
    pink: ['#ff69b4', '#ff1493', '#ff85c8'],
    green: ['#32cd32', '#228b22', '#7cfc00'],
    orange: ['#ff8c00', '#ff6347', '#ffa500'],
    purple: ['#9370db', '#8a2be2', '#ba55d3'],
    red: ['#dc143c', '#b22222', '#ff4444'],
  };
  const palette = colors[type] || colors.pink;

  if (type === 'pink' || type === 'red') {
    // Branching coral
    const cx = 32;
    ctx.strokeStyle = palette[1];
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    // Main stem
    ctx.beginPath(); ctx.moveTo(cx, 90); ctx.lineTo(cx, 40); ctx.stroke();
    // Branches
    const branches = [[cx, 40, cx - 15, 20], [cx, 40, cx + 18, 15],
      [cx, 55, cx - 20, 38], [cx, 55, cx + 16, 42],
      [cx, 65, cx - 12, 55], [cx, 65, cx + 14, 50]];
    for (const [x1, y1, x2, y2] of branches) {
      ctx.strokeStyle = palette[Math.floor(Math.random() * palette.length)];
      ctx.lineWidth = 2 + Math.random() * 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      // Bulb at tip
      ctx.fillStyle = palette[0];
      ctx.beginPath(); ctx.arc(x2, y2, 3 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
    }
  } else if (type === 'green') {
    // Seaweed / kelp
    ctx.strokeStyle = palette[0];
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let s = 0; s < 3; s++) {
      const sx = 15 + s * 17;
      ctx.strokeStyle = palette[s % palette.length];
      ctx.lineWidth = 2 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(sx, 90);
      for (let y = 85; y > 10; y -= 10) {
        ctx.lineTo(sx + Math.sin(y * 0.1 + s) * 8, y);
      }
      ctx.stroke();
      // Leaves
      for (let y = 70; y > 15; y -= 15) {
        ctx.fillStyle = palette[1];
        ctx.beginPath();
        ctx.ellipse(sx + Math.sin(y * 0.1 + s) * 6, y, 5, 3, Math.sin(y) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // Tube/mushroom coral
    const cx = 32;
    // Stem
    ctx.fillStyle = palette[1];
    ctx.fillRect(cx - 5, 50, 10, 40);
    // Cap
    const capGrad = ctx.createRadialGradient(cx, 40, 0, cx, 40, 25);
    capGrad.addColorStop(0, palette[0]);
    capGrad.addColorStop(1, palette[2]);
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.ellipse(cx, 40, 25, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Spots
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(255,255,255,0.3)`;
      ctx.beginPath();
      ctx.arc(cx + (Math.random() - 0.5) * 30, 35 + Math.random() * 15, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

// === UNDERWATER WORLD ===

export class UnderwaterWorld {
  constructor(scene, arcs) {
    this.scene = scene;
    this._arcs = arcs;
    this.group = new THREE.Group();
    this.group.name = 'underwater';
    scene.add(this.group);

    this._isUnderwater = false;
    this._overlay = null;
    this._originalFogColor = null;
    this._originalFogNear = 0;
    this._originalFogFar = 0;

    this._createSeabedArcs();
    this._createOverlay();
    this._createFish();
    this._createWhalesAndSharks();
    this._createCoral();
  }

  /**
   * Add underwater canyon arcs — positive-opening parabolas that carve
   * canyons/trenches into the seabed for interesting underwater topography.
   */
  _createSeabedArcs() {
    const canyonCount = 80;
    this._seabedArcs = [];
    for (let i = 0; i < canyonCount; i++) {
      // Place canyons in ocean areas (near edges)
      const angle = Math.random() * Math.PI * 2;
      const dist = WORLD_HALF * (0.5 + Math.random() * 0.4);
      this._seabedArcs.push({
        cx: Math.cos(angle) * dist,
        cz: Math.sin(angle) * dist,
        radius: 40 + Math.random() * 150,
        depth: 10 + Math.random() * 30, // how deep the canyon carves
      });
    }
  }

  /**
   * Get seabed height including underwater canyons.
   * Normal terrain + canyon depressions below water.
   */
  _getSeabedHeight(x, z) {
    let h = getTerrainHeight(x, z, this._arcs);
    // Only apply canyons below water level
    if (h < WATER_LEVEL) {
      for (const arc of this._seabedArcs) {
        const dx = x - arc.cx;
        const dz = z - arc.cz;
        const distSq = dx * dx + dz * dz;
        const rSq = arc.radius * arc.radius;
        const contribution = 1 - distSq / rSq;
        if (contribution > 0) {
          h -= arc.depth * contribution; // carve downward
        }
      }
    }
    return h;
  }

  _createOverlay() {
    this._overlay = document.createElement('div');
    this._overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(180deg, rgba(5,20,50,0.5) 0%, rgba(10,40,80,0.35) 50%, rgba(5,30,60,0.5) 100%);
      pointer-events: none; z-index: 50;
      transition: opacity 0.5s;
      opacity: 0;
    `;
    document.body.appendChild(this._overlay);
  }

  /**
   * Find a valid ocean position (not inland ponds).
   * Ocean = terrain well below water AND near island edge (dist from center > 40% world)
   * or terrain very deep (seabed < WATER_LEVEL - 8, clearly ocean not puddle)
   */
  /**
   * Find a valid ocean position with minimum depth.
   * Uses seabed height (with canyon arcs) for accurate depth.
   * @param {number} minDepth - minimum water depth required (default 5m)
   */
  _validOceanPos(spread = 0.85, minDepth = 5) {
    for (let i = 0; i < 80; i++) {
      const x = randomRange(-WORLD_HALF * spread, WORLD_HALF * spread);
      const z = randomRange(-WORLD_HALF * spread, WORLD_HALF * spread);
      const seabed = this._getSeabedHeight(x, z);
      const depth = WATER_LEVEL - seabed;
      if (depth < minDepth) continue; // not deep enough

      const distFromCenter = Math.sqrt(x * x + z * z);
      const isOcean = distFromCenter > WORLD_HALF * 0.4 || depth > 8;
      if (isOcean) return { x, z, seabed, depth };
    }
    return null;
  }

  /** Valid water pos including ponds (for coral) — uses canyon seabed */
  _validWaterPos(spread = 0.85) {
    for (let i = 0; i < 50; i++) {
      const x = randomRange(-WORLD_HALF * spread, WORLD_HALF * spread);
      const z = randomRange(-WORLD_HALF * spread, WORLD_HALF * spread);
      const seabed = this._getSeabedHeight(x, z);
      if (seabed < WATER_LEVEL - 2) return { x, z, seabed };
    }
    return null;
  }

  _createFish() {
    // Generate 6 fish species with different colors
    const fishHues = [0, 30, 60, 180, 210, 300]; // red, orange, yellow, cyan, blue, magenta
    const fishTextures = fishHues.map(hue => {
      const tex = new THREE.CanvasTexture(genTropicalFish(hue));
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    });

    const fishGeo = new THREE.PlaneGeometry(1, 0.5);
    this._fishData = [];
    this._fishMeshes = [];

    // Create instanced mesh per species
    for (let s = 0; s < fishTextures.length; s++) {
      const mat = new THREE.SpriteMaterial({ map: fishTextures[s], transparent: true, fog: false });
      const positions = [];
      const target = 800;

      for (let a = 0; a < target * 4 && positions.length < target; a++) {
        const pos = this._validOceanPos(0.85, 15); // fish only in deep ocean
        if (!pos) continue;
        // Depth bias: deeper = more fish (quadratic)
        const depthChance = Math.pow(Math.min(pos.depth / 30, 1), 2);
        if (Math.random() > depthChance) continue;
        const y = randomRange(Math.max(pos.seabed + 1, WATER_LEVEL - pos.depth), WATER_LEVEL - 1);
        positions.push({ ...pos, y });
      }

      for (const p of positions) {
        const sprite = new THREE.Sprite(mat);
        const scale = 1 + Math.random() * 2.5;
        sprite.scale.set(scale * 2, scale, 1);
        sprite.position.set(p.x, p.y, p.z);
        this.group.add(sprite);
        this._fishData.push({
          obj: sprite, speed: 2 + Math.random() * 5,
          dir: Math.random() * Math.PI * 2, wobble: Math.random() * 6,
        });
      }
    }
  }

  _createWhalesAndSharks() {
    // Sharks
    const sharkTex = new THREE.CanvasTexture(genShark());
    sharkTex.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 8; i++) {
      const pos = this._validOceanPos(0.7, 20); // sharks: deep water only
      if (!pos) continue;
      const mat = new THREE.SpriteMaterial({ map: sharkTex, transparent: true, fog: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(12, 4, 1);
      sprite.position.set(pos.x, randomRange(WATER_LEVEL - 10, WATER_LEVEL - 3), pos.z);
      this.group.add(sprite);
      this._fishData.push({
        obj: sprite, speed: 3 + Math.random() * 3,
        dir: Math.random() * Math.PI * 2, wobble: Math.random() * 6,
      });
    }

    // Whales
    for (const type of ['humpback', 'sperm']) {
      const tex = new THREE.CanvasTexture(genWhale(type));
      tex.colorSpace = THREE.SRGBColorSpace;
      const count = type === 'humpback' ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const pos = this._validOceanPos(0.6, 30); // whales: deep ocean only
        if (!pos) continue;
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false });
        const sprite = new THREE.Sprite(mat);
        const scale = type === 'humpback' ? 25 : 20;
        sprite.scale.set(scale, scale * 0.375, 1);
        sprite.position.set(pos.x, randomRange(WATER_LEVEL - 12, WATER_LEVEL - 5), pos.z);
        this.group.add(sprite);
        this._fishData.push({
          obj: sprite, speed: 1 + Math.random() * 1.5,
          dir: Math.random() * Math.PI * 2, wobble: Math.random() * 6,
        });
      }
    }
  }

  _createCoral() {
    const coralTypes = ['pink', 'green', 'orange', 'purple', 'red'];
    const coralTextures = coralTypes.map(type => {
      const tex = new THREE.CanvasTexture(genCoral(type));
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    });

    for (let i = 0; i < 4000; i++) {
      const pos = this._validWaterPos(0.75);
      if (!pos) continue;
      // Depth bias: more coral in deeper water
      const depth = WATER_LEVEL - pos.seabed;
      if (depth < 3) continue; // skip very shallow
      const depthChance = Math.min(depth / 12, 1);
      if (Math.random() > depthChance) continue;

      const texIdx = Math.floor(Math.random() * coralTextures.length);
      const mat = new THREE.SpriteMaterial({
        map: coralTextures[texIdx],
        transparent: true,
        fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      const scale = 2 + Math.random() * 5;
      sprite.scale.set(scale * 0.7, scale, 1);
      sprite.position.set(pos.x, pos.seabed + scale * 0.4, pos.z);
      this.group.add(sprite);
    }
  }

  update(dt, birdAltitude) {
    const wasUnderwater = this._isUnderwater;
    this._isUnderwater = birdAltitude < WATER_LEVEL;

    // Hide all underwater objects when above water (massive perf gain: 8000+ sprites)
    this.group.visible = this._isUnderwater;

    if (this._isUnderwater !== wasUnderwater) {
      this._overlay.style.opacity = this._isUnderwater ? '1' : '0';
      if (this.scene.fog) {
        if (this._isUnderwater) {
          this._originalFogColor = this.scene.fog.color.clone();
          this._originalFogNear = this.scene.fog.near;
          this._originalFogFar = this.scene.fog.far;
          this.scene.fog.color.set(0x051430);
          this.scene.fog.near = 5;
          this.scene.fog.far = 80;
        } else {
          this.scene.fog.color.copy(this._originalFogColor);
          this.scene.fog.near = this._originalFogNear;
          this.scene.fog.far = this._originalFogFar;
        }
      }
    }

    // Animate fish, sharks, whales
    if (this._isUnderwater) {
      const lim = WORLD_HALF * 0.85;
      for (const f of this._fishData) {
        f.wobble += dt * 2;
        const obj = f.obj;
        obj.position.x += Math.cos(f.dir) * f.speed * dt;
        obj.position.z += Math.sin(f.dir) * f.speed * dt;
        obj.position.y += Math.sin(f.wobble) * 0.3 * dt;
        if (Math.random() < 0.003) f.dir += (Math.random() - 0.5) * 0.5;
        if (obj.position.x > lim) obj.position.x = -lim;
        if (obj.position.x < -lim) obj.position.x = lim;
        if (obj.position.z > lim) obj.position.z = -lim;
        if (obj.position.z < -lim) obj.position.z = lim;
      }
    }
  }
}
