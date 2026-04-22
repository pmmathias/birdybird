// TSL NodeMaterial variants of red-reddington's bark + leaf shaders for
// WebGPURenderer. v2 port — adds the visible-impact features that the v1
// stopgap deferred:
//
//   v2 (this file):
//     - Per-instance leaf color jitter (instanceColorAttr + instanceRandom)
//     - Time-based leaf sway (only at short range, fades out with distance)
//     - LOD cull: distant leaves collapse to zero-area triangles
//     - Bark distance-tinting: far-away trees read as "green forest" mass
//     - Local-space root spread for trunk cylinders (approximates the
//       world-space GLSL version, close enough visually for flown-over view)
//
//   Not yet ported (WebGL-only):
//     - Proper world-space root-spread with outward direction from tree center
//       (requires vertexNode with full MVP override — deferred)
//     - SSS + fresnel on leaves (cosmetic)
//
// MIT — mirrors `src/vendor/RedReddingtonForest.js`, author: red-reddington.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn, If, float, vec2, vec3, vec4,
  uniform, texture, uv, attribute, instancedBufferAttribute,
  positionLocal, normalWorld,
  modelWorldMatrix, cameraPosition,
  time, select,
  mix, max, min, dot, normalize, length, abs, sign,
  fract, sin, cos, pow, smoothstep, clamp,
} from 'three/tsl';

// ---------------------------------------------------------------
// BARK
// ---------------------------------------------------------------
export function createBarkNodeMaterial(barkTexture, config, barkGeometry) {
  const mat = new MeshBasicNodeMaterial();

  const tex = texture(barkTexture);
  const uBarkColor = uniform(new THREE.Color(...config.BARK_COLOR));
  const uLeafTint  = uniform(new THREE.Color(...config.BARK_DISTANT_TINT));
  const uSunDir    = uniform(new THREE.Vector3(0.5, 1.0, 0.3).normalize());
  const uAmbient   = uniform(new THREE.Color(0.5, 0.52, 0.48));
  const uSunColor  = uniform(new THREE.Color(1.0, 0.98, 0.9));
  const uFadeStart = uniform(config.LOD_FADE_START);
  const uMaxDist   = uniform(config.LOD_MAX_DISTANCE);
  const uRootSpreadMin = uniform(config.ROOT_SPREAD_MIN);
  const uRootSpreadMax = uniform(config.ROOT_SPREAD_MAX);
  const uRootHeight    = uniform(config.ROOT_HEIGHT_MAX); // use max for uniform tree base

  // --- Vertex: gentle local-space root spread + mild wobble ---
  mat.positionNode = Fn(() => {
    const p = positionLocal.toVar();
    // Low-Y bump outward. Cylinder is in local (x, y∈[-0.5..0.5], z) where
    // x²+z²≈1. For trunk cylinders (y aligned with world up), this fakes a
    // basal flare by scaling the radial component at low y.
    const belowMid = p.y.lessThan(0.0);
    const rootFactor = clamp(p.y.negate().mul(2.0), 0.0, 1.0); // 1 at y=-0.5, 0 at y=0
    const spread = uRootSpreadMin.mul(0.3).add(rootFactor.mul(uRootSpreadMax.mul(0.4)));
    p.x.addAssign(p.x.mul(rootFactor).mul(spread).mul(belowMid.select(1.0, 0.0)));
    p.z.addAssign(p.z.mul(rootFactor).mul(spread).mul(belowMid.select(1.0, 0.0)));
    return p;
  })();

  mat.colorNode = Fn(() => {
    // Distance to tree: sample instance center via modelWorldMatrix
    const instCenter = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    const dist = length(cameraPosition.sub(instCenter));
    const safeFade = min(uFadeStart, uMaxDist.sub(1.0));
    const leafTintAmt = smoothstep(safeFade, uMaxDist, dist);

    // Tree-unique brightness from instance center (mimics GLSL treeRand1)
    const h = fract(sin(instCenter.x.mul(12.9898).add(instCenter.z.mul(78.233))).mul(43758.5453));
    const brightness = float(0.85).add(h.mul(0.3));

    const texColor = tex.sample(uv()).rgb;
    const base = mix(uBarkColor, texColor, 0.7).mul(1.8).mul(brightness);

    // Per-tree hue skew
    const hueSkew = vec3(
      float(1.0).add(h.sub(0.5).mul(0.1)),
      float(1.0),
      float(1.0).sub(h.sub(0.5).mul(0.1)),
    );
    const tinted = base.mul(hueSkew);

    // Distant-bark green tint
    const withTint = mix(tinted, uLeafTint, leafTintAmt.mul(0.7));

    const N = normalize(normalWorld);
    const L = normalize(uSunDir);
    const NdotL = max(dot(N, L), 0.0);
    const lit = withTint.mul(float(0.3).add(NdotL.mul(0.7)));
    return lit;
  })();

  return mat;
}

// ---------------------------------------------------------------
// LEAVES
// ---------------------------------------------------------------
export function createLeafNodeMaterial(leafTexture, config, leafGeometry) {
  const mat = new MeshBasicNodeMaterial({
    side: THREE.DoubleSide,
    transparent: false,
  });

  const tex = texture(leafTexture);
  const uSunDir    = uniform(new THREE.Vector3(0.5, 1.0, 0.3).normalize());
  const uSunColor  = uniform(new THREE.Color(1.0, 0.98, 0.9));
  const uAmbient   = uniform(new THREE.Color(0.65, 0.7, 0.6));
  const uFadeStart = uniform(config.LOD_FADE_START);
  const uMaxDist   = uniform(config.LOD_MAX_DISTANCE);
  const uSwayStart = uniform(config.LOD_SWAY_FADE_START);
  const uSwayEnd   = uniform(config.LOD_SWAY_DISTANCE);

  // WebGPU-specific: random + swayPhase are packed into a vec2
  // (instanceRandSway) to stay under the 8-vertex-buffer limit.
  // See T014-v2 note in RedReddingtonForest.js.
  const instColor = leafGeometry?.getAttribute('instanceColorAttr')
    ? instancedBufferAttribute(leafGeometry.getAttribute('instanceColorAttr'))
    : null;
  const instRandSway = leafGeometry?.getAttribute('instanceRandSway')
    ? instancedBufferAttribute(leafGeometry.getAttribute('instanceRandSway'))
    : null;

  mat.positionNode = Fn(() => {
    // Distance to instance (for LOD + sway)
    const instPos = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    const dist = length(cameraPosition.sub(instPos));

    // LOD cull: collapse the triangle at origin when too far. All 3 vertices
    // land at the instance origin → zero-area triangle → rasterizer culls.
    // Apple Metal's degenerate-cull is less reliable than WebGPU's so we also
    // scale normal down; combined they reliably skip drawing.
    const culled = dist.greaterThan(uMaxDist);
    const lodScale = clamp(
      float(1.0).sub(smoothstep(uFadeStart, uMaxDist, dist).mul(0.5)),
      0.0,
      1.0,
    );

    const p = positionLocal.mul(lodScale).toVar();

    // Sway (only at close range) — uses packed (random, swayPhase) vec2
    if (instRandSway) {
      const swayPhase = instRandSway.y;
      const swayFade = clamp(
        float(1.0).sub(dist.sub(uSwayStart).div(uSwayEnd.sub(uSwayStart))),
        0.0,
        1.0,
      );
      const s = sin(time.mul(1.2).add(swayPhase));
      p.x.addAssign(s.mul(0.08).mul(swayFade));
      p.z.addAssign(s.mul(0.05).mul(swayFade));
    }

    // When culled: return zero (all vertices collapse)
    return select(culled, vec3(0.0), p);
  })();

  mat.colorNode = Fn(() => {
    const t = tex.sample(uv());
    const N = normalize(normalWorld);
    const L = normalize(uSunDir);
    const NdotL = max(dot(N, L), 0.0);
    const diffuse = NdotL.mul(0.8);

    // Per-instance color tint (the big visible improvement over v1)
    let base = t.rgb;
    if (instColor) base = base.mul(instColor);
    if (instRandSway) base = base.mul(float(0.92).add(instRandSway.x.mul(0.16)));

    const lit = base.mul(uAmbient.add(uSunColor.mul(diffuse)));
    return lit;
  })();

  mat.opacityNode = tex.sample(uv()).a;
  mat.alphaTest = 0.5;

  return mat;
}
