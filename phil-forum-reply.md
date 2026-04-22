FYI — Red's forest does port cleanly. We have it running on WebGPU in
birdybird (bird-flight sim, tilt-controlled mobile):
https://pmmathias.github.io/birdybird/

Source is dual-path so the same repo serves both renderers:

- **Original WebGL ShaderMaterial version** (kept as fallback):
  https://github.com/pmmathias/birdybird/blob/main/src/vendor/RedReddingtonForest.js
- **TSL NodeMaterial port for WebGPU** (bark colorNode + vertexNode for
  root-spread, leaf positionNode with distance-based LOD cull + sway,
  per-instance color tint):
  https://github.com/pmmathias/birdybird/blob/main/src/vendor/RedReddingtonForestNode.js

Two gotchas worth flagging for anyone else attempting this:

- WebGPU caps vertex buffers at 8. The original leaf ShaderMaterial uses
  five per-instance float attributes; combined with position+normal+uv+
  instanceMatrix that hits 9 → WGSL compile error. We packed
  `instanceRandom` + `instanceSwayPhase` into a single vec2
  `instanceRandSway` and dropped the static wobble attrs (cosmetic only
  at flight altitude).

- The monolithic InstancedMesh has a world-spanning boundingSphere, so
  three.js frustum culling never fires — the vertex shader ran for ~1M
  instances per frame regardless of camera angle. Post-processing the
  output into per-cluster InstancedMeshes (20 on desktop) gave a 3× FPS
  gain on WebGPU across most scenarios. ~80 lines in
  `splitForestByClusters()`:
  https://github.com/pmmathias/birdybird/blob/main/src/world/WorldBuilder.js#L227

Happy for Red to lift any of it back upstream.

Mathias
