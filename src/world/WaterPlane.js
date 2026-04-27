import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { WaterMesh } from 'three/addons/objects/WaterMesh.js';
import * as TSL from 'three/tsl';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { Ocean } from '../vendor/Ocean3.js';
import { Ocean as Ocean4 } from '../vendor/Ocean4.js';
import { WORLD_SIZE, WATER_LEVEL } from '../constants.js';

/**
 * Animated water plane — tri-path renderer support:
 *
 * 1. WebGL2 + iFFT-capable (desktop Chrome/Firefox/Safari 16+):
 *    Phil Crowther's Ocean3 iFFT waves with Water.js mirror
 *    (Ocean3 © Phil Crowther, CC BY-NC-SA 3.0)
 *
 * 2. WebGL2 without iFFT (older mobile Safari before iOS 16, some Androids):
 *    Gerstner wave GLSL injected into Water.js vertex shader
 *
 * 3. WebGPU (iOS 26+, modern Chrome/Safari):
 *    Phil Crowther's Ocean4 — WGSL compute-shader iFFT port of the same
 *    algorithm, displacement + normal textures fed into a TSL
 *    MeshStandardNodeMaterial. This is the whole point of the WebGPU
 *    migration: real iFFT waves on mobile GPUs that iOS Safari 26+ can
 *    finally run. (Ocean4 © Phil Crowther, CC BY-NC-SA 3.0 — non-commercial
 *    project, attribution kept in credits overlay.)
 *    Falls back to Gerstner if Ocean4 init fails (compute support missing).
 */
export async function createWaterPlane(sun, renderer) {
  const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || navigator.maxTouchPoints > 1;
  const isWebGPU = !!renderer.isWebGPURenderer;

  // Non-WebGPU paths: original 24km plane (WebGL Water.js adds its own mirror
  // pass, fog hides the distant seam). WebGPU iFFT path overrides these in
  // _createIFFTWaterWebGPU so vertex density matches Phil's demo where the
  // plane IS exactly the FFT tile (384 segs / 2400m = 6.25m per vertex).
  const PLANE_SIZE = WORLD_SIZE * 4;
  const SEGMENTS = IS_MOBILE ? 128 : 256;
  const REFLECTION_SIZE = IS_MOBILE ? 256 : 512;

  if (isWebGPU) {
    // Ocean-cascade decision: desktop defaults to cascaded ×3, mobile to
    // single for perf. `?ocean=single` opts desktop out; `?ocean=cascaded`
    // forces it (no effect on mobile — still single).
    const oceanParam = new URLSearchParams(location.search).get('ocean');
    const CASCADES_ENABLED = !IS_MOBILE && oceanParam !== 'single';
    // Try iFFT first; Gerstner is only the fallback.
    try {
      const water = _createIFFTWaterWebGPU(sun, renderer, PLANE_SIZE, SEGMENTS, IS_MOBILE, CASCADES_ENABLED);
      window.__waterPath = CASCADES_ENABLED ? 'iFFT ×3 (WebGPU)' : 'iFFT (WebGPU)';
      console.log(`Water: WebGPU → Ocean4 iFFT compute${CASCADES_ENABLED ? ' [cascaded, Attila-inspired]' : ''}`);
      return water;
    } catch (err) {
      console.warn('Ocean4 init failed, falling back to Gerstner:', err);
      window.__waterPath = 'Gerstner (WebGPU)';
      return _createWebGPUWater(sun, PLANE_SIZE, SEGMENTS, IS_MOBILE);
    }
  }

  // WebGL paths below
  const supportsIFFT = _checkIFFTSupport(renderer);
  window.__waterPath = supportsIFFT ? 'iFFT' : 'Gerstner';
  console.log(`Water: WebGL2 → iFFT ${supportsIFFT ? 'supported → Ocean3' : 'unavailable → Gerstner fallback'}`);

  if (supportsIFFT) {
    try {
      return await _createIFFTWater(sun, renderer, PLANE_SIZE, SEGMENTS, REFLECTION_SIZE, IS_MOBILE);
    } catch (err) {
      console.warn('Ocean3 init failed, falling back to Gerstner:', err);
      window.__waterPath = 'Gerstner';
    }
  }
  return await _createGerstnerWater(sun, PLANE_SIZE, SEGMENTS, REFLECTION_SIZE);
}

function _checkIFFTSupport(renderer) {
  const gl = renderer.getContext?.();
  if (!gl) return false;
  const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined'
    && gl instanceof WebGL2RenderingContext;
  if (!isWebGL2) return false;
  if (!gl.getExtension('EXT_color_buffer_float')) return false;
  if (!gl.getExtension('OES_texture_float_linear')) return false;
  return true;
}

// ------------------------------------------------------------------
// Path 3a: WebGPU iFFT via Phil Crowther's Ocean4 (compute shaders)
// ------------------------------------------------------------------
function _createIFFTWaterWebGPU(sun, renderer, _ignoredPlaneSize, _ignoredSegments, IS_MOBILE, CASCADES_ENABLED) {
  const {
    Fn, positionLocal, texture, normalMap, uv,
    vec2, vec3, float, uniform,
    positionWorld, cameraPosition, normalWorld,
    normalize, dot, max, mix, pow, smoothstep, reflector,
  } = TSL;

  // Phil's default tile + params verbatim (from sdem_ocean4_gpu.html):
  //   GrdSiz 2400, GrdRes 512, GrdSeg 384, WSp 20, Chp 2.
  // He uses PlaneGeometry(2400,2400,384,384) — 1 tile per plane, 6.25m between
  // vertices. With our previous 24000m plane × 256 segments (93.75m between
  // vertices) the geometry could only represent very low-frequency swell; the
  // high-freq crests in Ocean4's displacement map got averaged out because
  // there just weren't enough vertices to sample them. Match Phil's vertex
  // density instead.
  const WAVE_TILE  = 2400;
  const TILE_COUNT = 4;                         // 4×4 grid → 9600m visible water
  const PLANE_SIZE = WAVE_TILE * TILE_COUNT;    // 9600m
  const SEG_PER_TILE = IS_MOBILE ? 192 : 384;   // Phil's 384 on desktop; half on mobile
  const SEGMENTS     = SEG_PER_TILE * TILE_COUNT;

  // Poor man's cascaded ocean, inspired by Attila Schroeder's WebGPU-IFFT-Ocean
  // (https://spiri0.github.io/Threejs-WebGPU-IFFT-Ocean/). His implementation
  // runs 3 simultaneous FFT cascades with different tile sizes so that big
  // swell, mid wind-chop, and tiny ripples all coexist on the surface. His
  // full system is a multi-day integration (quadtree chunks + custom material);
  // we instead instantiate 3 Ocean4 instances at different scales and sum the
  // displacement textures in the vertex shader. Poor-man's version but delivers
  // most of the visual richness with a stack we already trust.
  //
  // Desktop defaults to cascaded ×3 (decided at the caller level); mobile
  // is always single. `?ocean=single` opts out on desktop.
  // Cascaded-mode inspired by Attila's WebGPU-IFFT-Ocean LENGTH_SCALES
  // [250, 17, 5]. His version cascades at GEOMETRY level (quadtree chunks
  // with varying vertex density per cascade). We have a flat uniform plane
  // (6.25m/vertex), so cascades below that spacing can't contribute to
  // geometry — they'd be below Nyquist and produce artifacts. Instead:
  //
  //   - Cascade A (250m tile): displacement + normal. Dominant swell/chop.
  //   - Cascade B (80m tile):  displacement + normal. Mid-freq wind-chop.
  //   - Cascade C (20m tile):  NORMAL MAP ONLY. Fine ripple sparkle for
  //     reflection distortion + specular, no geometric contribution.
  //
  // When cascaded mode is OFF we use the old single-cascade 2400m setup.
  // Cascade A is IDENTICAL in both single and cascaded modes — the user's
  // trusted baseline wave look. Cascaded mode then LAYERS two additional
  // spectra on top so the difference is obviously additive: "you see the
  // same waves you're used to, plus more stuff".
  // Lower wind speed on the dominant cascade A → smaller swell, energy
  // shifts toward higher frequencies. Choppiness bumped so the remaining
  // crests stay sharp. Cascade B and C wind speeds bumped slightly so
  // mid + high freq detail dominates the surface.
  const cascadeA = new Ocean4(renderer, {
    Res: IS_MOBILE ? 256 : 512,
    Siz: WAVE_TILE,                              // 2400m — same in both modes
    WSp: 5.5, WHd: 295, Chp: 3.4, Spd: 1.4,
  });
  // Cascade B at 300m — wind-chop layer.
  const cascadeB = CASCADES_ENABLED ? new Ocean4(renderer, {
    Res: 256,
    Siz: 300,
    WSp: 6.5, WHd: 240, Chp: 2.4, Spd: 1.9,
  }) : null;
  // Cascade C at 40m — ~6 vertices per tile, normal-only sparkle.
  const cascadeC = CASCADES_ENABLED ? new Ocean4(renderer, {
    Res: 256,
    Siz: 40,
    WSp: 3.5, WHd: 310, Chp: 2.0, Spd: 2.8,
  }) : null;

  const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, SEGMENTS, SEGMENTS);
  const uvAttr = geometry.attributes.uv;
  for (let i = 0; i < uvAttr.count; i++) {
    uvAttr.setXY(i, uvAttr.getX(i) * TILE_COUNT, uvAttr.getY(i) * TILE_COUNT);
  }

  const material = new MeshBasicNodeMaterial();
  // UV scales — each cascade's UV is scaled so the tile texture maps to
  // exactly `Siz` meters of world. Cascade A shares the base vertex UVs
  // (scale 1×) since it uses the same 2400m tile as the plane's UV layout.
  const uvScaleA = 1;                    // A is the base layer (2400m)
  const uvScaleB = WAVE_TILE / 300;      // 8× — cascade B repeats 8× per A tile
  const uvScaleC = WAVE_TILE / 40;       // 60× — cascade C repeats 60× per A tile
  const dispA = texture(cascadeA.dispMapTexture, uv().mul(uvScaleA));
  const dispB = CASCADES_ENABLED ? texture(cascadeB.dispMapTexture, uv().mul(uvScaleB)) : null;
  // Cascade C (20m tile) is intentionally NOT in the displacement sum — at
  // our 6.25m vertex spacing it's right at Nyquist and would cause aliasing.
  // C contributes only to the fragment-level normal for sparkle.

  // Weighted sum of geometry-contributing cascades. B at 0.8 (strong
  // enough to clearly layer visible chop on top of A). Y damped to 0.35
  // overall to avoid sea-sick vertical swell.
  // High-freq cascade B contributes more strongly to the displacement
  // sum so the surface reads as wind-chop dominated rather than swell.
  let sumDisp = dispA.xyz;
  if (CASCADES_ENABLED) sumDisp = sumDisp.add(dispB.xyz.mul(1.15));
  const dampedDisp = vec3(sumDisp.x, sumDisp.y.mul(0.35), sumDisp.z);
  material.positionNode = positionLocal.add(dampedDisp);

  const uSunDir     = uniform(new THREE.Vector3().copy(sun.position).normalize());
  const uSunColor   = uniform(new THREE.Color(0xfff0d4));
  // Sky-blue tint for wave crests (where normal points up) and deep water for
  // slopes. The previous single-color 0x003050 was so dark that top-down views
  // couldn't distinguish crests from troughs — the iFFT waves were there, just
  // invisible in the shading.
  const uDeepColor  = uniform(new THREE.Color(0x012238));
  const uSkyColor   = uniform(new THREE.Color(0x4d7eaa));

  const mirrorSampler = reflector();
  mirrorSampler.reflector.resolutionScale = IS_MOBILE ? 0.4 : 0.6;

  material.colorNode = Fn(() => {
    const wp = positionWorld;
    const V = normalize(cameraPosition.sub(wp));
    const L = normalize(uSunDir);

    // Sum normal maps across cascades to get shading that reflects the full
    // multi-scale surface. Each map is packed world-space normal (x, z, y).
    // Adding decoded normals and re-normalizing is an approximation — not
    // physically correct, but looks good in practice and way cheaper than
    // re-computing normals from the summed displacement via derivatives.
    const nA = texture(cascadeA.normMapTexture, uv()).xyz.mul(2.0).sub(1.0);
    let nSum = vec3(nA.x, nA.z, nA.y);
    if (CASCADES_ENABLED) {
      const nB = texture(cascadeB.normMapTexture, uv().mul(uvScaleB)).xyz.mul(2.0).sub(1.0);
      const nC = texture(cascadeC.normMapTexture, uv().mul(uvScaleC)).xyz.mul(2.0).sub(1.0);
      // Stronger B/C weights so the user CAN see the multi-scale texture.
      nSum = nSum
        .add(vec3(nB.x.mul(1.1), nB.z.mul(1.1), nB.y.mul(1.1)))
        .add(vec3(nC.x.mul(0.85), nC.z.mul(0.85), nC.y.mul(0.85)));
    }
    const N = normalize(nSum);

    // Distort the mirror UVs strongly by the normal's world XZ — this is what
    // makes crests/troughs visible as shimmer in the reflection.
    mirrorSampler.uvNode = mirrorSampler.uvNode.add(N.xz.mul(0.4));

    // "Upness" of the normal is 1 on flat water and < 1 on wave slopes. Used
    // to fade between sky-blue (calm crest) and deep-blue (tilted face) so
    // waves are clearly legible even from directly above.
    const upness = max(float(0.0), N.y);
    const base = mix(uDeepColor, uSkyColor, pow(upness, 2.0));

    // Lambert + sun — subtle but helps sculpt the waves with shadow on
    // sun-averted faces.
    const lambert = max(float(0.0), dot(N, L)).mul(0.45).add(0.55);
    const lit = base.mul(lambert);

    // Sun glint (specular) — bright highlight on crests that face the sun.
    const R = TSL.reflect(uSunDir.negate(), N);
    const glint = pow(max(float(0.0), dot(R, V)), 90.0).mul(uSunColor).mul(3.0);

    // Fresnel — at grazing angles, reflect sky/env; near-vertical view uses
    // the lit water base. 0.04 base reflectance per Schlick for water.
    const theta = max(float(0.0), dot(V, N));
    const rf0 = float(0.04);
    const reflectance = pow(float(1.0).sub(theta), 5.0).mul(float(1.0).sub(rf0)).add(rf0);

    const reflected = mirrorSampler.rgb.add(glint);
    return mix(lit.add(glint.mul(0.3)), reflected, reflectance);
  })();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WATER_LEVEL;
  // Attach the reflector's virtual camera to the mesh so it follows the water
  // plane automatically (same pattern WaterMesh uses internally).
  mesh.add(mirrorSampler.target);

  const waterGroup = new THREE.Group();
  waterGroup.add(mesh);

  // Cheap faked underwater cap — a downward-facing plane that simulates
  // Snell's window (bright overhead) + total-internal reflection (dark
  // seabed-mirror) near the horizon. No actual reflection pass: purely a
  // two-colour blend driven by the view ray's vertical component. Water
  // critical angle is ~48.6°, so cos ≈ 0.66; smoothstep transitions
  // around that value.
  const capGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 1, 1);
  const capMat = new MeshBasicNodeMaterial({ side: THREE.BackSide, fog: true });
  capMat.colorNode = Fn(() => {
    const viewRay = normalize(positionWorld.sub(cameraPosition));
    const t = smoothstep(float(0.50), float(0.92), viewRay.y);
    const snellColor = vec3(0.42, 0.68, 0.78);
    const tirColor   = vec3(0.02, 0.08, 0.10);
    return mix(tirColor, snellColor, t);
  })();
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = WATER_LEVEL - 0.05;
  cap.visible = false;
  waterGroup.add(cap);

  // FPS win: with default back-face culling the water plane is invisible
  // when viewed from below anyway. Hiding the mesh when the bird is under
  // water skips (a) the 2.36M-vertex shader and (b) the reflector render
  // pass. Ocean4 compute also paused — player won't notice waves freezing
  // while submerged. Also pauses B and C cascades if enabled.
  function update(_dt, birdAltitude) {
    const submerged = birdAltitude !== undefined && birdAltitude < WATER_LEVEL;
    mesh.visible = !submerged;
    cap.visible = submerged;
    if (!submerged) {
      cascadeA.update();
      if (cascadeB) cascadeB.update();
      if (cascadeC) cascadeC.update();
    }
  }
  return { mesh: waterGroup, update };
}

// ------------------------------------------------------------------
// Path 3b: WebGPU Gerstner fallback via WaterMesh
// ------------------------------------------------------------------
async function _createWebGPUWater(sun, PLANE_SIZE, SEGMENTS, IS_MOBILE) {
  const { Fn, float, vec2, vec3, cos, sin, normalize, positionLocal, time } = TSL;

  // Water normals texture — reused from Gerstner WebGL path
  const waterNormals = new THREE.TextureLoader().load(
    'textures/waternormals.jpg',
    (tex) => { tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; },
  );

  const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, SEGMENTS, SEGMENTS);
  const water = new WaterMesh(geometry, {
    waterNormals,
    sunDirection: new THREE.Vector3().copy(sun.position).normalize(),
    sunColor: 0xffeedd,
    waterColor: 0x003050,
    distortionScale: IS_MOBILE ? 1.5 : 2.5,
  });

  // Gerstner displacement via positionNode override — mirrors the GLSL
  // GERSTNER_PARS in the WebGL Gerstner path.
  const gerstner = Fn(([pos2]) => {
    const d = vec3(0).toVar();
    const waves = [
      { amp: 0.35, freq: 0.04, speed: 1.0, dx: 1.0,  dy:  0.3, steep: 0.4  },
      { amp: 0.25, freq: 0.07, speed: 1.4, dx: -0.5, dy:  1.0, steep: 0.35 },
      { amp: 0.15, freq: 0.11, speed: 1.8, dx: 0.7,  dy: -0.6, steep: 0.3  },
    ];
    for (const w of waves) {
      const dir = normalize(vec2(w.dx, w.dy));
      const phase = float(w.freq).mul(dir.dot(pos2)).sub(float(w.speed).mul(time));
      const c = cos(phase);
      const s = sin(phase);
      d.addAssign(vec3(
        float(w.steep).mul(w.amp).mul(dir.x).mul(c),
        float(w.amp).mul(s),
        float(w.steep).mul(w.amp).mul(dir.y).mul(c),
      ));
    }
    return d;
  });
  water.material.positionNode = Fn(() => {
    const disp = gerstner(positionLocal.xy);
    return positionLocal.add(disp);
  })();

  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;

  const waterGroup = new THREE.Group();
  waterGroup.add(water);
  // Note: underwater plane skipped on WebGPU for V1 (T019 follow-up)

  function update(_dt, birdAltitude) {
    // TSL `time` uniform auto-advances; just toggle visibility.
    water.visible = birdAltitude === undefined || birdAltitude >= WATER_LEVEL;
  }
  return { mesh: waterGroup, update };
}

// ------------------------------------------------------------------
// Path 1: iFFT via Ocean3 (WebGL2)
// ------------------------------------------------------------------
async function _createIFFTWater(sun, renderer, PLANE_SIZE, SEGMENTS, REFLECTION_SIZE, IS_MOBILE) {
  const WAVE_TILE = 2400;
  const ocean = new Ocean(renderer, {
    Res: IS_MOBILE ? 256 : 512,
    Siz: WAVE_TILE,
    WSp: 18, WHd: 295, Chp: 1.5,
  });

  const TILE_COUNT = PLANE_SIZE / WAVE_TILE;
  const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, SEGMENTS, SEGMENTS);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * TILE_COUNT, uv.getY(i) * TILE_COUNT);
  }

  const normalMap = ocean.normalMapFramebuffer.texture;
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  const displacementMap = ocean.displacementMapFramebuffer.texture;
  displacementMap.wrapS = displacementMap.wrapT = THREE.RepeatWrapping;

  const water = new Water(geometry, {
    textureWidth: REFLECTION_SIZE,
    textureHeight: REFLECTION_SIZE,
    waterNormals: normalMap,
    sunDirection: new THREE.Vector3().copy(sun.position).normalize(),
    sunColor: 0xffeedd,
    waterColor: 0x003050,
    distortionScale: IS_MOBILE ? 1.5 : 2.5,
    fog: false,
  });

  water.material.uniforms.oceanDisplacement = { value: displacementMap };
  water.material.vertexShader =
    'uniform sampler2D oceanDisplacement;\n' +
    water.material.vertexShader.replace(
      'void main() {',
      'void main() {\n vec3 oceanDisp = texture2D(oceanDisplacement, uv).rgb;\n',
    ).replace(
      /vec4\s*\(\s*position\s*,\s*1\.0\s*\)/g,
      'vec4(position + oceanDisp, 1.0)',
    );
  water.material.needsUpdate = true;

  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;

  const underWater = await _createUnderwaterPlane(sun, PLANE_SIZE, normalMap);
  const waterGroup = new THREE.Group();
  waterGroup.add(water);
  waterGroup.add(underWater);

  function update(dt, birdAltitude) {
    const submerged = birdAltitude !== undefined && birdAltitude < WATER_LEVEL;
    // Skip the ocean iFFT compute + reflector pass while underwater, and
    // likewise skip the underwater mirror plane while above water.
    water.visible = !submerged;
    underWater.visible = submerged;
    if (!submerged) {
      ocean.update(dt);
      water.material.uniforms.time.value += dt;
    } else {
      underWater.material.uniforms.time.value += dt;
    }
  }
  return { mesh: waterGroup, update };
}

// ------------------------------------------------------------------
// Path 2: Gerstner fallback (WebGL2 without iFFT extensions)
// ------------------------------------------------------------------
const GERSTNER_PARS = /* glsl */ `
  uniform float waveTime;

  vec3 gerstnerWave(vec2 pos, float amp, float freq, float speed, vec2 dir, float steep) {
    float phase = freq * dot(dir, pos) - speed * waveTime;
    float c = cos(phase);
    float s = sin(phase);
    return vec3(
      steep * amp * dir.x * c,
      amp * s,
      steep * amp * dir.y * c
    );
  }

  vec3 gerstnerDisplace(vec2 pos) {
    vec3 d = vec3(0.0);
    d += gerstnerWave(pos, 0.35, 0.04, 1.0, normalize(vec2(1.0, 0.3)), 0.4);
    d += gerstnerWave(pos, 0.25, 0.07, 1.4, normalize(vec2(-0.5, 1.0)), 0.35);
    d += gerstnerWave(pos, 0.15, 0.11, 1.8, normalize(vec2(0.7, -0.6)), 0.3);
    return d;
  }
`;

async function _createGerstnerWater(sun, PLANE_SIZE, SEGMENTS, REFLECTION_SIZE) {
  const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, SEGMENTS, SEGMENTS);

  const waterNormals = new THREE.TextureLoader().load(
    'textures/waternormals.jpg',
    (tex) => { tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; },
  );

  const water = new Water(geometry, {
    textureWidth: REFLECTION_SIZE,
    textureHeight: REFLECTION_SIZE,
    waterNormals,
    sunDirection: new THREE.Vector3().copy(sun.position).normalize(),
    sunColor: 0xffeedd,
    waterColor: 0x003050,
    distortionScale: 1.5,
    fog: false,
  });

  water.material.uniforms.waveTime = { value: 0 };
  water.material.vertexShader = water.material.vertexShader.replace(
    'void main() {',
    GERSTNER_PARS + '\nvoid main() {\n vec3 oceanDisp = gerstnerDisplace(position.xy);\n',
  ).replace(
    /vec4\s*\(\s*position\s*,\s*1\.0\s*\)/g,
    'vec4(position + oceanDisp, 1.0)',
  );
  water.material.needsUpdate = true;

  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;

  const underWater = await _createUnderwaterPlane(sun, PLANE_SIZE, waterNormals);
  const waterGroup = new THREE.Group();
  waterGroup.add(water);
  waterGroup.add(underWater);

  function update(dt, birdAltitude) {
    const submerged = birdAltitude !== undefined && birdAltitude < WATER_LEVEL;
    water.visible = !submerged;
    underWater.visible = submerged;
    if (!submerged) {
      water.material.uniforms.time.value += dt;
      water.material.uniforms.waveTime.value += dt;
    } else {
      underWater.material.uniforms.time.value += dt;
    }
  }
  return { mesh: waterGroup, update };
}

async function _createUnderwaterPlane(sun, PLANE_SIZE, normalsTexture) {
  const underWater = new Water(new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE), {
    textureWidth: 256,
    textureHeight: 256,
    waterNormals: normalsTexture,
    sunDirection: new THREE.Vector3().copy(sun.position).normalize(),
    sunColor: 0xffffff,
    waterColor: 0x001e0f,
    distortionScale: 3.7,
    fog: false,
  });
  underWater.rotation.x = Math.PI / 2;
  underWater.position.y = WATER_LEVEL - 0.05;
  return underWater;
}
