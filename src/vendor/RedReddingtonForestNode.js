// TSL NodeMaterial variants of red-reddington's bark + leaf shaders for WebGPU.
//
// This is a *pragmatic v1* port: it reproduces the core look (texture + basic
// lighting + alpha cutoff) but drops several WebGL-only tricks:
//
//   - Root spread (vertex-shader outward bump based on tree-base Y)
//   - Wind sway (time-driven leaf wobble)
//   - LOD cull via NDC clip (`gl_Position = vec4(2,2,2,1)` for distant leaves)
//   - HSL per-instance color jitter on bark
//   - Distance-based leaf tinting (vLeafTint)
//
// All of the above are candidates for a richer v2 port once the basic
// visual-parity milestone is locked in. See T014 follow-ups.
//
// MIT — mirrors `src/vendor/RedReddingtonForest.js`, author: red-reddington.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn, float, vec3, vec4,
  uniform, texture, uv,
  positionWorld, normalWorld,
  mix, max, dot, normalize,
} from 'three/tsl';

export function createBarkNodeMaterial(barkTexture, config) {
  const mat = new MeshBasicNodeMaterial();

  const tex = texture(barkTexture);
  const uBarkColor = uniform(new THREE.Color(...config.BARK_COLOR));
  const uSunDir = uniform(new THREE.Vector3(0.5, 1.0, 0.3).normalize());
  const uAmbient = uniform(new THREE.Color(0.5, 0.52, 0.48));
  const uSunColor = uniform(new THREE.Color(1.0, 0.98, 0.9));

  mat.colorNode = Fn(() => {
    // Match the bark_texture-ish wrap by using world-space XZ + Y as UVs
    // (close enough to the GLSL's `vec2(uvAngle * 1.5, worldPos.y * 0.5)`
    // without recomputing the per-branch center).
    const barkUv = uv();
    const texColor = tex.sample(barkUv).rgb;
    const base = mix(uBarkColor, texColor, 0.7).mul(1.8);

    const N = normalize(normalWorld);
    const L = normalize(uSunDir);
    const NdotL = max(dot(N, L), 0.0);
    const lit = base.mul(uAmbient.add(uSunColor.mul(NdotL.mul(0.7))));
    return lit;
  })();

  return mat;
}

export function createLeafNodeMaterial(leafTexture, config) {
  const mat = new MeshBasicNodeMaterial({
    side: THREE.DoubleSide,
    transparent: false, // alpha cutoff, not blending
  });

  const tex = texture(leafTexture);
  const uSunDir = uniform(new THREE.Vector3(0.5, 1.0, 0.3).normalize());
  const uSunColor = uniform(new THREE.Color(1.0, 0.98, 0.9));
  const uAmbient = uniform(new THREE.Color(0.65, 0.7, 0.6));

  mat.colorNode = Fn(() => {
    const t = tex.sample(uv());
    // Alpha cutoff — discard ≠ available in TSL colorNode, use opacityNode
    const N = normalize(normalWorld);
    const L = normalize(uSunDir);
    const NdotL = max(dot(N, L), 0.0);
    const diffuse = NdotL.mul(0.8);
    const lit = t.rgb.mul(uAmbient.add(uSunColor.mul(diffuse)));
    return lit;
  })();
  // Alpha-cutoff via opacityNode — returned opacity < 0.5 triggers discard
  // when material.alphaTest is set.
  mat.opacityNode = texture(leafTexture).sample(uv()).a;
  mat.alphaTest = 0.5;

  return mat;
}
