import * as THREE from 'three';

const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vViewDist;

void main() {
  vUv = uv;
  // World-space normal (NOT view-space!) so slope is camera-independent
  vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vec4 viewPos = viewMatrix * worldPos;
  vViewDist = length(viewPos.xyz); // linear distance from camera
  gl_Position = projectionMatrix * viewPos;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D sandTex;
uniform sampler2D grassTex;
uniform sampler2D rockTex;
uniform sampler2D snowTex;
uniform sampler2D forestTex;
uniform sampler2D gravelTex;

uniform float waterLevel;
uniform float sandEnd;
uniform float grassEnd;
uniform float rockEnd;

uniform vec3 sunDirection;
uniform float ambientIntensity;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vViewDist;

// Hash-based procedural noise (no texture needed)
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Multi-octave noise for natural variation
float fbmNoise(vec2 p) {
  float v = 0.0;
  v += noise(p * 0.02) * 0.5;
  v += noise(p * 0.05) * 0.3;
  v += noise(p * 0.1) * 0.2;
  return v; // 0..1
}

void main() {
  float h = vWorldPos.y;
  float slope = 1.0 - vNormal.y; // 0 = flat, 1 = vertical cliff

  // Procedural noise for breaking up uniform height bands
  float n = fbmNoise(vWorldPos.xz) * 2.0 - 1.0; // -1..1
  float hNoise = h + n * 10.0; // ±10 units variation on blend thresholds

  // Sample textures at different scales for variety
  vec3 sand = texture2D(sandTex, vUv * 0.5).rgb * vec3(1.3, 1.2, 0.75); // strong warm yellow tint
  vec3 forest = texture2D(forestTex, vUv * 0.9).rgb;
  vec3 grass = texture2D(grassTex, vUv * 1.0).rgb * vec3(0.85, 1.1, 0.75); // boost green channel
  vec3 rock = texture2D(rockTex, vUv * 1.3).rgb;
  vec3 gravel = texture2D(gravelTex, vUv * 1.1).rgb;
  // Snow: mix texture with strong white to ensure it reads as "snow"
  vec3 snowSample = texture2D(snowTex, vUv * 0.4).rgb;
  vec3 snow = mix(vec3(0.95, 0.97, 1.0), snowSample, 0.25); // 75% white + 25% texture detail

  // 5-layer height blending: Sand → Grass → Earth → Rock → Snow
  // Earth zone sits between grass and rock
  float earthEnd = grassEnd + (rockEnd - grassEnd) * 0.5; // midpoint between grass and rock

  float sandFactor  = 1.0 - smoothstep(waterLevel - 5.0, sandEnd + 5.0 + n * 4.0, hNoise);
  float grassFactor = smoothstep(sandEnd - 3.0, sandEnd + 5.0 + n * 2.0, hNoise)
                    * (1.0 - smoothstep(grassEnd - 8.0, grassEnd + 8.0, hNoise));
  float earthFactor = smoothstep(grassEnd - 8.0, grassEnd + 8.0, hNoise)
                    * (1.0 - smoothstep(earthEnd - 5.0, earthEnd + 5.0, hNoise));
  float rockFactor  = smoothstep(earthEnd - 5.0, earthEnd + 5.0, hNoise)
                    * (1.0 - smoothstep(rockEnd - 8.0, rockEnd + 8.0, hNoise));
  float snowFactor  = smoothstep(rockEnd - 8.0, rockEnd + 8.0, hNoise);

  // Steep slopes become rock (below snow line only)
  float slopeRock = smoothstep(0.25, 0.55, slope);
  float belowSnowLine = 1.0 - smoothstep(rockEnd - 5.0, rockEnd + 5.0, h);
  rockFactor = max(rockFactor, slopeRock * 0.7 * belowSnowLine);
  grassFactor *= (1.0 - slopeRock * belowSnowLine);
  earthFactor *= (1.0 - slopeRock * belowSnowLine * 0.5);
  sandFactor *= (1.0 - slopeRock * 0.5);

  // Normalize (fallback to grass if all factors are zero)
  float total = sandFactor + grassFactor + earthFactor + rockFactor + snowFactor;
  if (total < 0.01) {
    grassFactor = 1.0;
    total = 1.0;
  }
  sandFactor /= total;
  grassFactor /= total;
  earthFactor /= total;
  rockFactor /= total;
  snowFactor /= total;

  vec3 color = sand * sandFactor + grass * grassFactor + forest * earthFactor
             + rock * rockFactor + snow * snowFactor;

  // Lambertian lighting
  float NdotL = max(dot(vNormal, sunDirection), 0.0);
  float light = ambientIntensity + (1.0 - ambientIntensity) * NdotL;
  color *= light;

  // Fog — linear view distance (view-angle independent)
  float fogFactor = smoothstep(fogNear, fogFar, vViewDist);
  color = mix(color, fogColor, fogFactor);

  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * Create the terrain ShaderMaterial.
 * @param {{ sandTex, grassTex, rockTex, snowTex }} textures
 * @param {{ waterLevel, sandEnd, grassEnd, rockEnd, sunDirection, fogColor, fogNear, fogFar }} params
 */
export function createTerrainMaterial(textures, params) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      sandTex: { value: textures.sandTex },
      grassTex: { value: textures.grassTex },
      rockTex: { value: textures.rockTex },
      snowTex: { value: textures.snowTex },
      forestTex: { value: textures.forestTex },
      gravelTex: { value: textures.gravelTex },
      waterLevel: { value: params.waterLevel },
      sandEnd: { value: params.sandEnd },
      grassEnd: { value: params.grassEnd },
      rockEnd: { value: params.rockEnd },
      sunDirection: { value: params.sunDirection },
      ambientIntensity: { value: 0.6 },
      fogColor: { value: params.fogColor },
      fogNear: { value: params.fogNear },
      fogFar: { value: params.fogFar },
    },
    side: THREE.DoubleSide,
  });
}
