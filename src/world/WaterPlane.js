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

  const PLANE_SIZE = WORLD_SIZE * 4;
  const SEGMENTS = IS_MOBILE ? 128 : 256;
  const REFLECTION_SIZE = IS_MOBILE ? 256 : 512;

  if (isWebGPU) {
    // Try iFFT first; Gerstner is only the fallback.
    try {
      const water = _createIFFTWaterWebGPU(sun, renderer, PLANE_SIZE, SEGMENTS, IS_MOBILE);
      window.__waterPath = 'iFFT (WebGPU)';
      console.log('Water: WebGPU → Ocean4 iFFT compute');
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
function _createIFFTWaterWebGPU(sun, renderer, PLANE_SIZE, SEGMENTS, IS_MOBILE) {
  const {
    Fn, positionLocal, texture, normalMap, uv,
    vec2, vec3, float, uniform,
    positionWorld, cameraPosition, normalWorld,
    normalize, dot, max, mix, pow, reflector,
  } = TSL;

  const WAVE_TILE = 2400;
  const waves = new Ocean4(renderer, {
    Res: IS_MOBILE ? 256 : 512,
    Siz: WAVE_TILE,
    WSp: 18, WHd: 295, Chp: 1.5,
    Spd: 1.0,
  });

  // Tiled UVs for displacement wrapping
  const TILE_COUNT = PLANE_SIZE / WAVE_TILE;
  const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, SEGMENTS, SEGMENTS);
  const uvAttr = geometry.attributes.uv;
  for (let i = 0; i < uvAttr.count; i++) {
    uvAttr.setXY(i, uvAttr.getX(i) * TILE_COUNT, uvAttr.getY(i) * TILE_COUNT);
  }

  const material = new MeshBasicNodeMaterial();
  material.positionNode = positionLocal.add(texture(waves.dispMapTexture, uv()).xyz);
  material.normalNode = normalMap(texture(waves.normMapTexture, uv()), new THREE.Vector2(1, 1));

  const uSunDir     = uniform(new THREE.Vector3().copy(sun.position).normalize());
  const uSunColor   = uniform(new THREE.Color(0xfff0d4));
  const uWaterColor = uniform(new THREE.Color(0x003050));
  const uDistortion = uniform(IS_MOBILE ? 0.03 : 0.05);

  // Create a TSL reflector here, outside the Fn so we can attach its
  // virtual-camera target to the mesh below. The reflector renders the
  // scene from below the water plane into a texture that we then sample
  // distorted by the iFFT normal for the characteristic "wavy mirror" look.
  const mirrorSampler = reflector();
  mirrorSampler.reflector.resolutionScale = IS_MOBILE ? 0.4 : 0.6;

  material.colorNode = Fn(() => {
    const wp = positionWorld;
    const viewDir = normalize(cameraPosition.sub(wp));
    const N = normalize(normalWorld);
    const L = normalize(uSunDir);

    // Distort the mirror UVs by the world-space normal's XZ components so the
    // iFFT waves warp the reflection (copied from WaterMesh's approach).
    mirrorSampler.uvNode = mirrorSampler.uvNode.add(N.xz.mul(uDistortion));

    // Fresnel reflectance (Schlick approximation)
    const theta = max(dot(viewDir, N), 0.0);
    const rf0 = float(0.02);
    const reflectance = pow(float(1.0).sub(theta), 5.0).mul(float(1.0).sub(rf0)).add(rf0);

    // Specular sun highlight (still useful on top of the reflection)
    const R = TSL.reflect(uSunDir.negate(), N);
    const RdotV = max(dot(R, viewDir), 0.0);
    const specular = pow(RdotV, 120.0).mul(uSunColor).mul(2.0);

    // Water-from-below scattering (deep water color softened by sun tint)
    const diffuseLight = max(dot(L, N), 0.0).mul(uSunColor).mul(0.5);
    const scatter = max(0.0, dot(N, viewDir)).mul(uWaterColor);
    const albedo = mix(
      uSunColor.mul(diffuseLight).mul(0.3).add(scatter),
      mirrorSampler.rgb.add(specular),
      reflectance,
    );
    return albedo;
  })();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WATER_LEVEL;
  // Attach the reflector's virtual camera to the mesh so it follows the water
  // plane automatically (same pattern WaterMesh uses internally).
  mesh.add(mirrorSampler.target);

  const waterGroup = new THREE.Group();
  waterGroup.add(mesh);

  function update(/* dt */) {
    waves.update();
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

  function update(/* dt */) {
    // TSL `time` uniform auto-advances; nothing to do
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

  function update(dt) {
    ocean.update(dt);
    water.material.uniforms.time.value += dt;
    underWater.material.uniforms.time.value += dt;
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

  function update(dt) {
    water.material.uniforms.time.value += dt;
    water.material.uniforms.waveTime.value += dt;
    underWater.material.uniforms.time.value += dt;
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
