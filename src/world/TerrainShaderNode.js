// TSL (Three.js Shading Language) port of TerrainShader.js for WebGPURenderer.
// Mirrors the GLSL version 1:1 — 5-layer height-based texture blend
// (sand → grass → earth/forest → rock → snow), slope-based rock override,
// procedural fbm noise to break up band edges, Lambertian sun lighting,
// linear fog.
//
// Why a separate file instead of branching inside TerrainShader.js:
// three/tsl imports are WebGPU-only and pull the full three/webgpu stack.
// Keeping them in a dedicated module makes dead-code elimination cleaner
// when bundlers that respect /* @__PURE__ */ get involved.

import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn, If, float, vec2, vec3, vec4, uv, uniform, texture,
  mix, smoothstep, fract, sin, floor, dot, max, normalize,
  positionWorld, normalWorld, cameraPosition, length,
  Loop,
} from 'three/tsl';

export function createTerrainMaterialNode(textures, params) {
  const sandTex   = texture(textures.sandTex);
  const grassTex  = texture(textures.grassTex);
  const rockTex   = texture(textures.rockTex);
  const snowTex   = texture(textures.snowTex);
  const forestTex = texture(textures.forestTex);

  const uWaterLevel = uniform(params.waterLevel);
  const uSandEnd    = uniform(params.sandEnd);
  const uGrassEnd   = uniform(params.grassEnd);
  const uRockEnd    = uniform(params.rockEnd);
  const uSunDir     = uniform(params.sunDirection);
  const uAmbient    = uniform(0.6);
  const uFogColor   = uniform(params.fogColor);
  const uFogNear    = uniform(params.fogNear);
  const uFogFar     = uniform(params.fogFar);

  // --- Hash + noise functions (exact port of the GLSL) ---
  const hash = Fn(([p]) => {
    return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
  });

  const noise = Fn(([p]) => {
    const i = floor(p);
    const f = fract(p);
    const smooth = f.mul(f).mul(vec2(3.0).sub(f.mul(2.0)));
    const a = hash(i);
    const b = hash(i.add(vec2(1.0, 0.0)));
    const c = hash(i.add(vec2(0.0, 1.0)));
    const d = hash(i.add(vec2(1.0, 1.0)));
    return mix(mix(a, b, smooth.x), mix(c, d, smooth.x), smooth.y);
  });

  const fbmNoise = Fn(([p]) => {
    return noise(p.mul(0.02)).mul(0.5)
      .add(noise(p.mul(0.05)).mul(0.3))
      .add(noise(p.mul(0.1)).mul(0.2));
  });

  const material = new MeshBasicNodeMaterial({ side: 2 /* DoubleSide */ });

  // Temporary debug path: dump just world-space height as a color to verify
  // the shader is actually running and varyings are populated correctly.
  // Toggle off once the full colorNode is proven.

  material.colorNode = Fn(() => {
    const h = positionWorld.y;
    const slope = float(1.0).sub(normalWorld.y);

    // Break up uniform height bands
    const n = fbmNoise(positionWorld.xz).mul(2.0).sub(1.0); // -1..1
    const hNoise = h.add(n.mul(10.0));

    // Sample textures at varying scales, same tints as GLSL
    const sand   = sandTex.sample(uv().mul(0.5)).rgb.mul(vec3(1.3, 1.2, 0.75));
    const forest = forestTex.sample(uv().mul(0.9)).rgb;
    const grass  = grassTex.sample(uv().mul(1.0)).rgb.mul(vec3(0.85, 1.1, 0.75));
    const rock   = rockTex.sample(uv().mul(1.3)).rgb;
    const snowSample = snowTex.sample(uv().mul(0.4)).rgb;
    const snow   = mix(vec3(0.95, 0.97, 1.0), snowSample, 0.25);

    // Earth zone sits midway between grass and rock
    const earthEnd = uGrassEnd.add(uRockEnd.sub(uGrassEnd).mul(0.5));

    // 5-layer factors
    const sandFactor0 = float(1.0).sub(
      smoothstep(uWaterLevel.sub(5.0), uSandEnd.add(5.0).add(n.mul(4.0)), hNoise)
    );
    const grassFactor0 = smoothstep(uSandEnd.sub(3.0), uSandEnd.add(5.0).add(n.mul(2.0)), hNoise)
      .mul(float(1.0).sub(smoothstep(uGrassEnd.sub(8.0), uGrassEnd.add(8.0), hNoise)));
    const earthFactor0 = smoothstep(uGrassEnd.sub(8.0), uGrassEnd.add(8.0), hNoise)
      .mul(float(1.0).sub(smoothstep(earthEnd.sub(5.0), earthEnd.add(5.0), hNoise)));
    const rockFactor0 = smoothstep(earthEnd.sub(5.0), earthEnd.add(5.0), hNoise)
      .mul(float(1.0).sub(smoothstep(uRockEnd.sub(8.0), uRockEnd.add(8.0), hNoise)));
    const snowFactor = smoothstep(uRockEnd.sub(8.0), uRockEnd.add(8.0), hNoise);

    // Steep slope → rock (below snow line only)
    const slopeRock = smoothstep(0.25, 0.55, slope);
    const belowSnowLine = float(1.0).sub(smoothstep(uRockEnd.sub(5.0), uRockEnd.add(5.0), h));
    const rockFactor = max(rockFactor0, slopeRock.mul(0.7).mul(belowSnowLine));
    const grassFactor = grassFactor0.mul(float(1.0).sub(slopeRock.mul(belowSnowLine)));
    const earthFactor = earthFactor0.mul(float(1.0).sub(slopeRock.mul(belowSnowLine).mul(0.5)));
    const sandFactor = sandFactor0.mul(float(1.0).sub(slopeRock.mul(0.5)));

    // Normalize (if total ~ 0 fallback to grass = 1)
    const total = sandFactor.add(grassFactor).add(earthFactor).add(rockFactor).add(snowFactor);
    // Avoid divide-by-zero: add tiny epsilon, effectively safe for our bands
    const safeTotal = max(total, float(0.01));

    const color = sand.mul(sandFactor.div(safeTotal))
      .add(grass.mul(grassFactor.div(safeTotal)))
      .add(forest.mul(earthFactor.div(safeTotal)))
      .add(rock.mul(rockFactor.div(safeTotal)))
      .add(snow.mul(snowFactor.div(safeTotal)));

    // Lambertian lighting
    const NdotL = max(dot(normalWorld, normalize(uSunDir)), 0.0);
    const light = uAmbient.add(float(1.0).sub(uAmbient).mul(NdotL));
    const lit = color.mul(light);

    // Linear fog based on view distance
    const viewDist = length(positionWorld.sub(cameraPosition));
    const fogFactor = smoothstep(uFogNear, uFogFar, viewDist);
    return mix(lit, uFogColor, fogFactor);
  })();

  // Expose uniforms for biome swap parity with the WebGL shader
  material.__terrainUniforms = {
    waterLevel: uWaterLevel, sandEnd: uSandEnd, grassEnd: uGrassEnd, rockEnd: uRockEnd,
    sunDirection: uSunDir, ambientIntensity: uAmbient,
    fogColor: uFogColor, fogNear: uFogNear, fogFar: uFogFar,
  };

  return material;
}
