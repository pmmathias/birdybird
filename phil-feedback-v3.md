# Phil — Ocean4 & Forest shipped on birdybird

Hi Phil,

quick update from the birdybird side (a bird-flight simulator, VogelSim
sister project with tilt controls for mobile browsers — now at
https://pmmathias.github.io/birdybird/). We migrated the whole renderer to
WebGPU on a feature branch and both your Ocean4 module and red-reddington's
forest are now running as first-class citizens on the WebGPU path. Full
attribution carried in the credits overlay and in the vendor source files
(CC BY-NC-SA 3.0 for Ocean4, MIT for the forest).

What we wired up and the handful of small adaptations we had to make —
in case any of these are useful for your own reference implementations
or you spot something we got wrong.

## Ocean4 integration on a bird-sim world

**Context.** The game is played from the air. The player looks *down* at the
water more often than *along* it. The water plane covers ~9600m so the
player can drift out over the sea during level transitions. These two
constraints surfaced a few surprises that aren't obvious from your
sdem_ocean4_gpu demo (which looks along the surface from a low vantage).

**Geometry density matched to the FFT tile.** Our first pass used a 24000m
plane × 256 segments (≈94m/vertex). The displacement texture was populated
correctly but the high-frequency crests in `dispMapTexture` simply couldn't
be represented in vertices that far apart — the surface read as flat low-
frequency swell. Dropping to a 9600m plane × 1536 segments (≈6.25m/vertex,
matching your demo's Siz=2400 / Seg=384) = 1 WAVE_TILE × 4×4 grid was what
made wave detail reappear.

**Wave parameters tuned for "wind-chop, not open ocean".** Your demo defaults
(`WSp: 20, Chp: 2`) gave a beautiful stormy sea but felt too tsunami-like
from bird altitude — sea level visibly rose and fell by several meters. We
settled on `WSp: 9, WHd: 295, Chp: 2.8, Spd: 1.3` — the Phillips-spectrum
peak wavelength works out to ~52m, which reads as busy Baltic-Sea
wind-chop from altitude.

**Vertical-only displacement damping.** Kept all horizontal choppiness
(dispSample.x and dispSample.z) at full amplitude, but multiply dispSample.y
by 0.35 before adding to positionLocal. Your permutation shader pre-
amplifies the real/vertical component by 2.25× which is gorgeous for a
stormy-ocean fly-over but caused the horizon to feel sea-sick in a
bird-sim context where the player is 100-300m up.

**Normal map caveat — not tangent space!** This was the main integration
gotcha. Your `compNormal` WGSL stores world-space normals packed as
`(nrm3.x, nrm3.z, nrm3.y)` in RGB, 0..1 range. We originally fed that
through TSL's `normalMap()` helper, which expects a *tangent-space* normal
map and applies a tangent transform. Result: the transform flattened the
perturbation and waves rendered as a perfect mirror on WebGPU. Fix was to
bypass `normalMap()` entirely and decode the map directly inside `colorNode`:

```js
const nTex = texture(waves.normMapTexture, uv()).xyz.mul(2.0).sub(1.0);
const N = normalize(vec3(nTex.x, nTex.z, nTex.y));  // world-space
```

This is worth flagging in your README if anyone else ports Ocean4 into a
project that also uses TSL's lighting nodes — we lost about an hour to it.

**Reflection via TSL reflector().** Standard `reflector()` node with
`resolutionScale: 0.6` (0.4 on mobile), mirror UV perturbed by `N.xz.mul(0.4)`.
Works perfectly and costs about one-half of a full extra scene pass at
viewport res.

**Underwater culling.** Since the water mesh uses default back-face culling,
it's invisible from below — we skip Ocean4.update() and hide the mesh when
the bird is submerged. Saves the full compute pass + reflector pass when
the player dives under. Roughly 4.4× FPS gain in submerged scenarios on
WebGPU in our perf-bench.

**Storage texture import note.** One tiny patch to Ocean4.js in our copy:
`StorageTexture` had to be imported from `'three/webgpu'` rather than
`'three'` — that changed in modern bundlers (Vite + Three r184). If you
want I can PR that upstream as a one-liner conditional import; let me know
your preference. The file sits in `src/vendor/Ocean4.js` with your original
header and CC BY-NC-SA 3.0 notice intact.

## red-reddington's forest — cluster-split speedup

Also relevant since you mentioned cross-pollination with ocean: we ported
red-reddington's procedural L-system forest to TSL NodeMaterials
(src/vendor/RedReddingtonForestNode.js), and found a big perf win orthogonal
to the shader port.

**Problem:** one monolithic `InstancedMesh` for all ~289k bark instances and
another for all ~782k leaves, with a world-spanning bounding sphere. Three.js
frustum culling never kicked in. The vertex shader ran for every instance
every frame, even when the camera looked at an empty quadrant.

**Fix:** post-process rr.generate()'s output, bucket instances by nearest
cluster center, and rebuild each cluster as its own InstancedMesh with a
tight per-instance geometry sphere. `InstancedMesh.computeBoundingSphere()`
then expands that by each cluster's matrices → cluster-sized sphere → frustum
culling works. Non-instance vertex attributes (position/normal/uv) shared
by reference across sub-meshes, so memory cost is ~20 extra InstancedBuffer-
Attributes, not 20 extra geometries.

WebGPU FPS before → after across 5 benchmark scenarios:

| scenario        | before | after | factor |
|-----------------|--------|-------|--------|
| air-over-land   | 35 fps | 62 fps| +75%   |
| air-over-ocean  | 36 fps | 124 fps| +243%  |
| skim-ocean      | 36 fps | 106 fps| +195%  |
| submerged       | 44 fps | 126 fps| +188%  |
| inside-forest   | 34 fps | 71 fps| +108%  |

The code is straightforward (~80 lines in src/world/WorldBuilder.js,
function `splitForestByClusters`) and independent of any Ocean4 stuff —
happy to share if you or red-reddington want to apply a similar trick.

## What's still open

- Mobile Safari 26+ real-device verification (simulator checks only so far).
- PMREM / environment map on WebGPU still skipped due to the r184
  `PMREMGenerator.fromScene()` crash on NodeMaterial skies — waiting on
  r185+ to re-enable.
- Tangent-space conversion or an alternative foam signal for true
  shore-foam (sampling scene depth through `viewportDepthTexture`) —
  a nice-to-have but not blocking.

Thanks again for Ocean4 — it's the centerpiece of the WebGPU port and
reads beautifully from any altitude. Attribution lives in the live credits
modal at https://pmmathias.github.io/birdybird/ and the vendor file keeps
your CC BY-NC-SA 3.0 header.

All the best,
Mathias
