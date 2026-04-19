import * as THREE from 'three';

/**
 * Per-level visual "biomes". Same terrain geometry, different mood — changing
 * sky, fog, lighting and environment map per level keeps the world feeling
 * new without needing to regenerate everything from scratch.
 *
 * True geometric regeneration (new terrain arcs, different tree distributions,
 * biome-specific textures) is a separate, larger ticket.
 */

export const BIOMES = [
  {
    name: 'Sunny Islands',
    sky: { turbidity: 10, rayleigh: 3.0, mieCoefficient: 0.005, mieDirectionalG: 0.7, sunElevation: 20, sunAzimuth: 180 },
    fog: 0xb0d0e8,
    ambient: { color: 0xffffff, intensity: 0.4 },
    sun: { color: 0xffffff, intensity: 1.2 },
    treeTint: 0xffffff,
    forest: { density: 1.0, types: ['oak', 'pine', 'birch', 'bush'] },
    waterColor: 0x3aa6b0, // tropical teal
  },
  {
    name: 'Golden Hour',
    sky: { turbidity: 3, rayleigh: 1.8, mieCoefficient: 0.010, mieDirectionalG: 0.82, sunElevation: 5, sunAzimuth: 180 },
    fog: 0xffb070,
    ambient: { color: 0xffd8a0, intensity: 0.5 },
    sun: { color: 0xffc088, intensity: 1.45 },
    treeTint: 0xffaa66, // autumn orange
    forest: { density: 0.9, types: ['oak', 'birch'] }, // deciduous autumn
    waterColor: 0xb77030, // warm amber
  },
  {
    name: 'Arctic Dawn',
    sky: { turbidity: 4, rayleigh: 4.0, mieCoefficient: 0.004, mieDirectionalG: 0.55, sunElevation: 12, sunAzimuth: 270 },
    fog: 0xc0d4e4,
    ambient: { color: 0xd0e0f0, intensity: 0.55 },
    sun: { color: 0xe0ecff, intensity: 1.05 },
    treeTint: 0xd8e8ff, // snow-frosted
    forest: { density: 0.5, types: ['pine', 'bush'] }, // sparse taiga
    waterColor: 0x6890b0, // icy pale blue
  },
  {
    name: 'Desert Noon',
    sky: { turbidity: 6, rayleigh: 1.0, mieCoefficient: 0.003, mieDirectionalG: 0.7, sunElevation: 55, sunAzimuth: 130 },
    fog: 0xe8d8b0,
    ambient: { color: 0xfff2d0, intensity: 0.55 },
    sun: { color: 0xfff4d0, intensity: 1.4 },
    treeTint: 0xbb9844, // parched / sand-dusted
    forest: { density: 0.15, types: ['bush'] }, // barely anything
    waterColor: 0x8a8a55, // oasis olive
  },
  {
    name: 'Stormy Dusk',
    sky: { turbidity: 20, rayleigh: 0.6, mieCoefficient: 0.02, mieDirectionalG: 0.85, sunElevation: 3, sunAzimuth: 220 },
    fog: 0x504050,
    ambient: { color: 0x707080, intensity: 0.35 },
    sun: { color: 0xff9060, intensity: 0.9 },
    treeTint: 0x8080a0, // muted cool
    forest: { density: 1.4, types: ['pine'] }, // dense dark pine
    waterColor: 0x241a30, // deep violet
  },
  {
    name: 'Night Sky',
    sky: { turbidity: 12, rayleigh: 0.3, mieCoefficient: 0.02, mieDirectionalG: 0.9, sunElevation: -3, sunAzimuth: 180 },
    fog: 0x0a1430,
    ambient: { color: 0x334266, intensity: 0.45 },
    sun: { color: 0x7090d0, intensity: 0.75 },
    treeTint: 0x334280, // deep blue
    forest: { density: 0.8, types: ['pine', 'oak'] },
    waterColor: 0x08122a, // obsidian midnight
  },
];

/** Cycle through biomes by level. Level 1 = index 0, level 7 = index 0 again. */
export function getBiomeForLevel(level) {
  return BIOMES[(level - 1) % BIOMES.length];
}

/**
 * Apply biome parameters in-place: sky uniforms, fog color, lights, env map.
 * Geometry (terrain, trees, houses) is not touched.
 */
export function applyBiome(scene, biome, renderer) {
  // Locate the relevant objects
  let sky = null, ambient = null, sun = null;
  scene.traverse((obj) => {
    if (!sky && obj.material && obj.material.uniforms && obj.material.uniforms.turbidity) sky = obj;
    if (!ambient && obj.isAmbientLight) ambient = obj;
    if (!sun && obj.isDirectionalLight) sun = obj;
  });

  let sunPos = null;

  if (sky) {
    const u = sky.material.uniforms;
    u.turbidity.value = biome.sky.turbidity;
    u.rayleigh.value = biome.sky.rayleigh;
    u.mieCoefficient.value = biome.sky.mieCoefficient;
    u.mieDirectionalG.value = biome.sky.mieDirectionalG;
    const phi = THREE.MathUtils.degToRad(90 - biome.sky.sunElevation);
    const theta = THREE.MathUtils.degToRad(biome.sky.sunAzimuth);
    sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(sunPos);
  }

  if (ambient) {
    ambient.color.set(biome.ambient.color);
    ambient.intensity = biome.ambient.intensity;
  }

  if (sun) {
    sun.color.set(biome.sun.color);
    sun.intensity = biome.sun.intensity;
    if (sunPos) sun.position.copy(sunPos).multiplyScalar(500);
  }

  if (scene.fog) scene.fog.color.setHex(biome.fog);

  // Water color — Three.js Water class exposes a waterColor uniform on both
  // the iFFT Ocean3 path and the Gerstner fallback.
  if (biome.waterColor !== undefined) {
    scene.traverse((obj) => {
      if (obj.material && obj.material.uniforms && obj.material.uniforms.waterColor) {
        obj.material.uniforms.waterColor.value.setHex(biome.waterColor);
      }
    });
  }

  // Tree-tint: multiplicative per-channel modulation over the baseline colors.
  // We remember the original color on the material once, then blend from it
  // each time so repeated biome switches don't compound.
  if (biome.treeTint !== undefined) {
    const forest = scene.getObjectByName('forest');
    if (forest) {
      const tint = new THREE.Color(biome.treeTint);
      forest.traverse((obj) => {
        if (obj.isMesh && obj.material && obj.material.color) {
          if (!obj.material.userData._baseColor) {
            obj.material.userData._baseColor = obj.material.color.clone();
          }
          obj.material.color.copy(obj.material.userData._baseColor).multiply(tint);
        }
      });
    }
  }

  // Regenerate env map from new sky so reflections match the mood
  if (renderer && sky) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const skyClone = sky.clone();
    const tmpScene = new THREE.Scene();
    tmpScene.add(skyClone);
    const envTex = pmrem.fromScene(tmpScene, 0, 0.1, 1000).texture;
    if (scene.environment && scene.environment !== envTex) {
      scene.environment.dispose?.();
    }
    scene.background = envTex;
    scene.environment = envTex;
    pmrem.dispose();
  }
}
