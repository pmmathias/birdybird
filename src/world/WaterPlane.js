import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Ocean } from '../vendor/Ocean3.js';
import { WORLD_SIZE, WATER_LEVEL } from '../constants.js';

/**
 * Animated water plane.
 *
 * Feature-detects iFFT support (WebGL2 + float color buffers).
 * - If supported: uses Phil Crowther's Ocean3 iFFT waves
 * - If not (e.g. iOS Safari without EXT_color_buffer_float):
 *   falls back to Gerstner waves via shader injection
 *
 * Ocean3.js © Phil Crowther — CC BY-NC-SA 3.0
 */

/**
 * Gerstner wave GLSL fallback — injected into the Water vertex shader.
 * 3 overlapping waves with different directions for realism.
 */
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

/**
 * Check if the renderer supports the features Ocean3 needs.
 * Ocean3 requires WebGL2, EXT_color_buffer_float, OES_texture_float_linear.
 */
function _checkIFFTSupport(renderer) {
  const gl = renderer.getContext();
  if (!gl) return false;

  // WebGL2 check (Ocean3 uses GLSL3)
  const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined'
    && gl instanceof WebGL2RenderingContext;
  if (!isWebGL2) return false;

  // Float color buffer — Ocean3 renders into Float32 framebuffers
  if (!gl.getExtension('EXT_color_buffer_float')) return false;

  // Linear filtering on float textures
  if (!gl.getExtension('OES_texture_float_linear')) return false;

  return true;
}

export function createWaterPlane(sun, renderer) {
  const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || navigator.maxTouchPoints > 1;

  const supportsIFFT = _checkIFFTSupport(renderer);
  console.log(`Water: iFFT ${supportsIFFT ? 'supported → Ocean3' : 'unavailable → Gerstner fallback'}`);
  // Expose to top bar
  window.__waterPath = supportsIFFT ? 'iFFT' : 'Gerstner';

  const PLANE_SIZE = WORLD_SIZE * 4;
  const SEGMENTS = IS_MOBILE ? 128 : 256;
  const REFLECTION_SIZE = IS_MOBILE ? 256 : 512;

  // --- Path A: iFFT via Ocean3 ---
  if (supportsIFFT) {
    try {
      return _createIFFTWater(sun, renderer, PLANE_SIZE, SEGMENTS, REFLECTION_SIZE, IS_MOBILE);
    } catch (err) {
      console.warn('Ocean3 init failed, falling back to Gerstner:', err);
      window.__waterPath = 'Gerstner'; // update indicator
    }
  }

  // --- Path B: Gerstner fallback ---
  return _createGerstnerWater(sun, PLANE_SIZE, SEGMENTS, REFLECTION_SIZE);
}

/** Full iFFT ocean via Phil Crowther's Ocean3 module. */
function _createIFFTWater(sun, renderer, PLANE_SIZE, SEGMENTS, REFLECTION_SIZE, IS_MOBILE) {
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

  const underWater = _createUnderwaterPlane(sun, PLANE_SIZE, normalMap);
  const waterGroup = new THREE.Group();
  waterGroup.add(water);
  waterGroup.add(underWater);

  function update(dt) {
    ocean.update(dt);
    water.material.uniforms.time.value += dt;
    underWater.material.uniforms.time.value += dt;
  }
  return { mesh: waterGroup, update };
}

/** Gerstner wave fallback — works on any WebGL1/WebGL2 renderer. */
function _createGerstnerWater(sun, PLANE_SIZE, SEGMENTS, REFLECTION_SIZE) {
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

  // Inject Gerstner displacement into the Water vertex shader
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

  const underWater = _createUnderwaterPlane(sun, PLANE_SIZE, waterNormals);
  const waterGroup = new THREE.Group();
  waterGroup.add(water);
  waterGroup.add(underWater);

  function update(dt) {
    water.material.uniforms.time.value += dt;
    water.material.uniforms.waveTime.value += dt;
    underWater.material.uniforms.time.value += dt;
  }
  return { mesh: waterGroup, update };
}

/** Simple flat underwater-side plane viewed from below when diving. */
function _createUnderwaterPlane(sun, PLANE_SIZE, normalsTexture) {
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
