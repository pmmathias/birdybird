import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { FOG_NEAR, FOG_FAR } from '../constants.js';

/**
 * Build the scene with sky, env map, fog, and lights.
 *
 * Sky path is renderer-dependent:
 * - WebGL:  three/addons/objects/Sky.js         (GLSL ShaderMaterial)
 * - WebGPU: three/addons/objects/SkyMesh.js     (TSL NodeMaterial)
 *
 * Both ship with three@^0.184 and produce visually identical Preetham output.
 */
export async function createScene(renderer) {
  const scene = new THREE.Scene();
  const isWebGPU = !!renderer.isWebGPURenderer;

  // --- Sun position (shared) ---
  const sunElevation = 20;
  const sunAzimuth = 180;
  const phi = THREE.MathUtils.degToRad(90 - sunElevation);
  const theta = THREE.MathUtils.degToRad(sunAzimuth);
  const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);

  // --- Sky (renderer-specific module) ---
  const sky = await _createSky(isWebGPU, sunPosition);
  scene.add(sky);

  // --- Environment map via PMREM ---
  // PMREMGenerator works identically on both renderers in r184+. Key caveat:
  // call after renderer.init() has resolved (our createRenderer awaits init).
  // --- Environment map ---
  // PMREMGenerator + NodeMaterial-based SkyMesh crashes in Three.js r184
  // ("Cannot read properties of undefined (reading 'buffers')" inside PMREM
  // when fromScene() tries to render a TSL-material sky). On the WebGPU path
  // we therefore skip PMREM-baked env maps for now; SkyMesh itself provides
  // the visible background (it's a skydome mesh), and StandardNodeMaterial
  // lights the scene via the DirectionalLight below rather than an env probe.
  // Follow-up ticket: bake a pre-rendered equirectangular sky texture at
  // build time and load via RGBELoader for reflections parity with WebGL.
  if (!isWebGPU) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader?.();
    const skyScene = new THREE.Scene();
    skyScene.add(sky.clone());
    const envMap = pmremGenerator.fromScene(skyScene, 0, 0.1, 1000).texture;
    scene.background = envMap;
    scene.environment = envMap;
    pmremGenerator.dispose();
  }
  // On WebGPU: no PMREM env probe yet — SkyMesh itself is the backdrop.

  // --- Fog ---
  const fogColor = new THREE.Color(0xb0d0e8);
  scene.fog = new THREE.Fog(fogColor, FOG_NEAR, FOG_FAR);

  // --- Lights ---
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.copy(sunPosition).multiplyScalar(500);
  scene.add(sun);

  return scene;
}

async function _createSky(isWebGPU, sunPosition) {
  if (isWebGPU) {
    const sky = new SkyMesh();
    sky.scale.setScalar(450000);
    sky.turbidity.value = 10;
    sky.rayleigh.value = 3;
    sky.mieCoefficient.value = 0.005;
    sky.mieDirectionalG.value = 0.7;
    sky.sunPosition.value.copy(sunPosition);
    return sky;
  }
  const sky = new Sky();
  sky.scale.setScalar(450000);
  const u = sky.material.uniforms;
  u.turbidity.value = 10;
  u.rayleigh.value = 3;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.7;
  u.sunPosition.value.copy(sunPosition);
  return sky;
}
