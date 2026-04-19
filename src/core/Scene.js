import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { FOG_NEAR, FOG_FAR } from '../constants.js';

export function createScene(renderer) {
  const scene = new THREE.Scene();

  // --- Procedural Sky ---
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 10;
  skyUniforms.rayleigh.value = 3;
  skyUniforms.mieCoefficient.value = 0.005;
  skyUniforms.mieDirectionalG.value = 0.7;

  // Sun position from elevation/azimuth
  const sunElevation = 20; // degrees
  const sunAzimuth = 180;  // degrees
  const phi = THREE.MathUtils.degToRad(90 - sunElevation);
  const theta = THREE.MathUtils.degToRad(sunAzimuth);
  const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  skyUniforms.sunPosition.value.copy(sunPosition);

  // Generate environment map from sky for reflections + background
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const skyScene = new THREE.Scene();
  skyScene.add(sky.clone());
  const envMap = pmremGenerator.fromScene(skyScene, 0, 0.1, 1000).texture;
  scene.background = envMap;
  scene.environment = envMap;
  pmremGenerator.dispose();
  scene.add(sky); // keep sky in main scene too

  // Fog with warm horizon tint
  const fogColor = new THREE.Color(0xb0d0e8);
  scene.fog = new THREE.Fog(fogColor, FOG_NEAR, FOG_FAR);

  // Ambient light
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  // Directional light (sun) — aligned to sky sun position
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.copy(sunPosition).multiplyScalar(500);
  scene.add(sun);

  return scene;
}
