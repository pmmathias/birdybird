# Phil — Ocean4 shipped on birdybird

Hi Phil,

Ocean4 is now live in birdybird, a bird-flight simulator with tilt controls
for mobile browsers: https://pmmathias.github.io/birdybird/ — WebGPU path
kicks in automatically on modern Chrome/Safari (append `?renderer=webgl`
for the pre-Ocean4 Gerstner fallback if you want a quick A/B). Attribution
in the credits overlay and in `src/vendor/Ocean4.js` (CC BY-NC-SA 3.0
header preserved).

Two things you may find useful, since birdybird stresses the module
differently than your sdem_ocean4_gpu demo (we look *down* at the sea from
100–300m rather than along it):

**Normal-map is world-space, not tangent-space.** Your `compNormal` WGSL
stores world-space normals packed `(nrm3.x, nrm3.z, nrm3.y)` in RGB. Feeding
that into TSL's `normalMap()` helper was our first instinct — which applies
a tangent-space transform and flattens the perturbation → the ocean rendered
as a perfect mirror. Fix was to decode directly in `colorNode`:

```js
const nTex = texture(waves.normMapTexture, uv()).xyz.mul(2.0).sub(1.0);
const N = normalize(vec3(nTex.x, nTex.z, nTex.y));  // world-space
```

Probably worth a sentence in your README for anyone combining Ocean4 with
TSL lighting nodes. Cost us about an hour of head-scratching.

**StorageTexture import.** One patch to Ocean4.js in our vendor copy —
modern bundlers (Vite + Three r184) require `StorageTexture` from
`'three/webgpu'`, not `'three'`. Happy to PR upstream as a one-liner if
you'd like.

Also: geometry density has to match the FFT tile for wave detail to land
in vertices (we started with ≈94m/vertex and saw only low-frequency swell
— dropping to your demo's 6.25m/vertex fixed it), and for a bird-sim view
we scale `dispSample.y` by 0.35 to damp the vertical swell from 2.25× —
both obvious in hindsight, mention here only in case anyone else builds
on your demo from altitude.

Thanks again — Ocean4 is the centerpiece of the WebGPU port and reads
beautifully at any height. Bird-sim players fly low over the water now
just to watch it.

Cheers,
Mathias
