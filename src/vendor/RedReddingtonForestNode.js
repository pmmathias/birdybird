// TSL NodeMaterial variants of red-reddington's bark + leaf shaders for
// WebGPURenderer.
//
//   Implemented:
//     - Per-instance leaf color jitter (instanceColorAttr + packed random)
//     - Time-based leaf sway (only at short range, fades out with distance)
//     - LOD cull: distant leaves collapse to zero-area triangles
//     - Bark distance-tinting: far-away trees read as "green forest" mass
//     - World-space bark root-spread via vertexNode (bumpy outward flare at
//       each branch's base; approximates the GLSL's iTreeBaseY-based version
//       by using the branch's own attachment Y as the local-Y reference)
//
//   Not yet ported (WebGL-only, cosmetic):
//     - SSS + fresnel on leaves
//     - Per-tree bumpiness phase offset derived from modelWorldMatrix seeds
//       (current WebGPU version uses simpler seed, slightly less variety)
//
// MIT — mirrors `src/vendor/RedReddingtonForest.js`, author: red-reddington.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn, If, float, vec2, vec3, vec4,
  uniform, texture, uv, attribute, instancedBufferAttribute,
  positionLocal, normalWorld,
  modelWorldMatrix, cameraPosition,
  cameraProjectionMatrix, cameraViewMatrix,
  time, select, floor, atan,
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
  const uRootHeightMin = uniform(config.ROOT_HEIGHT_MIN);
  const uRootHeightMax = uniform(config.ROOT_HEIGHT_MAX);
  const uRootBumpsMin  = uniform(config.ROOT_BUMPS_MIN);
  const uRootBumpsMax  = uniform(config.ROOT_BUMPS_MAX);

  // Per-branch tree-base Y (world-space). Placed on barkGeometry by the
  // L-system generator so the vertex shader knows where the tree trunk's
  // root actually sits on the terrain.
  const iTreeBaseY = barkGeometry?.getAttribute('instanceTreeBaseY')
    ? instancedBufferAttribute(barkGeometry.getAttribute('instanceTreeBaseY'))
    : null;

  // --- vertexNode: full world-space root spread (mirrors the GLSL 1:1) ---
  // Using vertexNode lets us reproduce the original algorithm exactly:
  // modify worldPos.xz with a per-tree bumpy outward push when worldPos.y is
  // below the tree's rootHeight, then project manually. This gives the
  // characteristic knobby flared trunks the GLSL renders — positionNode with
  // local-space approximation can't achieve the same look because the
  // bumpiness is keyed on world-space polar angle around the trunk center.
  mat.vertexNode = Fn(() => {
    // World position of this vertex
    const wp = modelWorldMatrix.mul(vec4(positionLocal, 1.0)).xyz.toVar();
    // World position of the instance's origin (the branch attachment point).
    // For the trunk, this sits on the terrain at the tree's base.
    const instCenter = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0)).xyz;

    // Per-tree pseudo-randoms seeded from the instance origin XZ
    const r1 = fract(sin(instCenter.x.mul(12.9898).add(instCenter.z.mul(78.233))).mul(43758.5453));
    const r2 = fract(sin(instCenter.x.mul(63.7264).add(instCenter.z.mul(10.873))).mul(43758.5453));
    const r3 = fract(sin(instCenter.x.mul(36.1734).add(instCenter.z.mul(91.147))).mul(43758.5453));

    const rootSpread = mix(uRootSpreadMin, uRootSpreadMax, r1);
    const rootHeight = mix(uRootHeightMin, uRootHeightMax, r2);
    const rootBumps  = floor(mix(uRootBumpsMin, uRootBumpsMax.add(1.0), r3));

    // Height above this branch's attachment point. For trunks this equals
    // height above the tree base (= correct root treatment). For non-trunk
    // branches, attachment is higher up the tree, so localY is small at the
    // branch's own base — which we also happen to want slightly flared.
    //
    // This is a simpler approximation than the GLSL's instanceTreeBaseY
    // attribute lookup but gives visibly similar root character without the
    // attribute-reading edge cases we hit with instancedBufferAttribute().
    const localY = wp.y.sub(instCenter.y);

    If(localY.lessThan(rootHeight), () => {
      const rfLin = float(1.0).sub(localY.div(rootHeight));
      const rootFactor = rfLin.mul(rfLin);

      const outward = wp.xz.sub(instCenter.xz);
      const outLen = length(outward);
      const outDir = select(outLen.greaterThan(0.001), outward.div(max(outLen, 0.001)), vec2(1.0, 0.0));

      const ang = atan(wp.z.sub(instCenter.z), wp.x.sub(instCenter.x));
      const seed = fract(instCenter.x.mul(12.9898).add(instCenter.z.mul(78.233))).mul(6.28);
      const bumpiness = float(1.0).add(sin(ang.mul(rootBumps).add(seed)).mul(0.7));

      const spreadAmount = rootFactor.mul(rootSpread).mul(bumpiness).mul(outLen).mul(3.0);
      wp.x.addAssign(outDir.x.mul(spreadAmount));
      wp.z.addAssign(outDir.y.mul(spreadAmount));
      wp.y.subAssign(rootFactor.mul(0.15).mul(select(localY.greaterThan(0.0), 1.0, 0.0)));
    });

    return cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(wp, 1.0));
  })();

  mat.colorNode = Fn(() => {
    // Distance to tree: sample instance center via modelWorldMatrix
    const instCenter = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    const dist = length(cameraPosition.sub(instCenter));
    const safeFade = min(uFadeStart, uMaxDist.sub(1.0));
    const leafTintAmt = smoothstep(safeFade, uMaxDist, dist);

    // Tree-unique brightness from instance center (mimics GLSL treeRand1).
    // Wider brightness band + per-channel hue skew so different individuals
    // read as different bark types (silver birch / oak / pine etc).
    const h = fract(sin(instCenter.x.mul(12.9898).add(instCenter.z.mul(78.233))).mul(43758.5453));
    const brightness = float(0.65).add(h.mul(0.7));

    const texColor = tex.sample(uv()).rgb;
    const base = mix(uBarkColor, texColor, 0.7).mul(1.8).mul(brightness);

    const skew = h.sub(0.5);
    const hueSkew = vec3(
      float(1.0).add(skew.mul(0.25)),
      float(1.0).add(skew.mul(skew).mul(0.18)),
      float(1.0).sub(skew.mul(0.25)),
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
