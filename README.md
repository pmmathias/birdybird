# birdybird

[![Blog](https://img.shields.io/badge/Blog-ki--mathias.de-22d3ee?style=flat-square)](https://ki-mathias.de/en/flight-simulator.html)

**Tilt-controlled bird flight arcade, built on Three.js + WebGPU.** Fly a
stork across a procedural world with your phone as the stick — lean left to
bank left, shake to flap. Works on desktop too, with a webcam-pose mode
(your arms become the wings) and keyboard fallback.

[**▶ Play live**](https://pmmathias.github.io/birdybird/) ·
[try a specific world](https://pmmathias.github.io/birdybird/?seed=42) ·
[single-cascade ocean (lighter)](https://pmmathias.github.io/birdybird/?ocean=single)

> 📖 **Read the story** — [Fourier, Ocean Waves and 65,536 Frequencies](https://ki-mathias.de/en/flight-simulator.html)
> ([German version](https://ki-mathias.de/vogelsimulator.html)): how the iFFT ocean works, the WebGPU migration,
> and the rest of the tech under the hood. Part of the blog at
> [**ki-mathias.de**](https://ki-mathias.de) — mathematical and AI-related writing.

Sister repo to [VogelSimulator](https://github.com/pmmathias/VogelSimulator);
birdybird is where the experimental game layer and WebGPU port live. The
flight physics + world generator come from VogelSim.

---

## Features

- **Mobile-first tilt flight.** Calibration wizard learns your device's
  axis orientation (left/right/climb/dive/shake) so it works regardless of
  how you hold the phone. iOS 13.4+ motion-permission handling included.
- **WebGPU is the default renderer,** with automatic fallback to WebGL2 for
  browsers that don't support it (older iOS Safari, locked-down corporate
  browsers). Swap at runtime from the Options dialog or via `?renderer=…`.
- **Phil Crowther's Ocean4 iFFT ocean** running as a WGSL compute shader on
  the WebGPU path — real Phillips-spectrum iFFT waves with mirror
  reflections. **Desktop WebGPU defaults to a 3×-cascaded layered
  spectrum** (Attila Schroeder-inspired) for richer multi-scale surface
  detail; mobile + `?ocean=single` fall back to the lighter single
  cascade (~60 % less FPS cost).
- **Procedural L-system forest** (red-reddington) with per-cluster
  `InstancedMesh` splitting for frustum culling — ~3× FPS on WebGPU over
  the naive single-mesh version.
- **Two game modes.** **Nest Quest** (default): find a glowing stick + a
  worm, return to the nest, level up to the next biome. **Ring Rush**
  (`?game=ringrush`): classic timer-reset score chase. **Free flight**
  (`?game=free`) for pure exploration.
- **Reproducible worlds** via `?seed=N` — share a specific procedural map
  with someone, identical terrain + tree placement every time.
- **Options dialog** (top bar) for runtime renderer + ocean-quality
  switching; unsupported options are greyed out with a reason.

---

## Controls

| Action        | Mobile (tilt)          | Desktop (keyboard) | Webcam (pose)                       |
| ------------- | ---------------------- | ------------------ | ----------------------------------- |
| Steer L/R     | Tilt device sideways   | `A` / `D` / arrows | Tilt both arms as wings             |
| Climb / dive  | Tilt back / forward    | `S` / `W`          | Raise / lower both arms             |
| Flap          | Shake the phone        | `Space`            | Flap both arms down                 |
| Reset center  | Double-tap the screen  | —                  | —                                   |
| Debug camera  | —                      | `F`                | —                                   |
| Autopilot     | —                      | `P`                | —                                   |

Pose detection uses MediaPipe Tasks Vision in-browser; the webcam image
never leaves the device.

---

## URL parameters

Handy for debugging and sharing specific scenarios.

| Param                  | Meaning                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `?seed=N`              | Deterministic world generation (same seed = same terrain).   |
| `?game=nest\|ringrush\|free` | Start in a specific game mode.                          |
| `?level=N`             | Jump to a later biome (default 1).                            |
| `?renderer=webgpu\|webgl\|auto` | Force a renderer path; default `auto`.               |
| `?ocean=single\|cascaded` | Override ocean cascades (desktop WebGPU = cascaded default). |
| `?skipcalib=1`         | Skip the mobile tilt-calibration wizard (testing only).       |
| `?x=…&y=…&z=…&yaw=…`   | Spawn at a specific position/heading.                         |
| `?speed=…`             | Spawn with a specific initial forward velocity.               |

---

## Development

```bash
npm install
npm run dev         # vite dev server on http://localhost:5173/birdybird/
npm run build       # production build → dist/
npm run preview     # serve the dist/ build at http://localhost:4173/
```

Node 18+ recommended. Deploys automatically to GitHub Pages on push to
`main` via `.github/workflows/`.

### Perf benchmarking

```bash
npm run dev                    # start server first
node scripts/perf-bench.mjs    # headless Playwright, 5 scenarios × 2 renderers
```

Writes `perf-report.md` with FPS per scenario and bottleneck toggles
(which subsystem costs the most in each view).

---

## Architecture

The renderer path is decided up front by
[`src/core/Renderer.js`](src/core/Renderer.js): it prefers WebGPU when
`navigator.gpu` is available and `WebGPURenderer.init()` succeeds,
otherwise falls back to WebGL2. A single string (`window.__rendererPath`)
is used everywhere downstream to branch per-path behavior.

All shader-heavy systems come in two flavours:

- **WebGL2 path** — classic `ShaderMaterial` / `Water.js` / `Sky`. Stable,
  fast, mobile-safe.
- **WebGPU path** — TSL `NodeMaterial` ports of the same effects. See
  `src/world/TerrainShaderNode.js` for terrain, `src/vendor/
  RedReddingtonForestNode.js` for the forest, and
  `_createIFFTWaterWebGPU()` in `src/world/WaterPlane.js` for the water.

The ocean integrates [Phil Crowther's Ocean4](https://discourse.threejs.org/t/ifft-ocean-wave-generator-module/51800)
module (WGSL compute shader iFFT; bundled in `src/vendor/Ocean4.js`). In
cascaded mode three Ocean4 instances at different tile scales run in
parallel and their displacement + normal maps are summed in the
fragment/vertex nodes — a "poor man's" version of
[Attila Schroeder's quadtree-cascaded Ocean](https://spiri0.github.io/Threejs-WebGPU-IFFT-Ocean/).

Development is ticket-driven. See [`tickets/done/`](tickets/done/) for the
story of the WebGPU migration (T010 – T016) and game-mode work (T003
tilt-fly, T005 Ring Rush, T008 world regeneration).

---

## Relationship to VogelSimulator

[VogelSimulator](https://github.com/pmmathias/VogelSimulator) is the
stable upstream — flight physics, terrain generator, MediaPipe pose
detection. birdybird borrows from it but ships experimental features
(mobile tilt UX, WebGPU port, game modes) that aren't ready for or aren't
in scope of the upstream main. Breaking changes happen here without
disturbing the VogelSim `main` branch or its Pages deployment.

---

## Credits

**Ocean waves.** [Phil Crowther](https://discourse.threejs.org/u/phil_crowther/summary)
and [Attila Schroeder](https://discourse.threejs.org/u/attila_schroeder/summary)
built both the WebGL2 (`Ocean3.js`) and WebGPU (`Ocean4.js`) iFFT wave
generators, descending from earlier work by David Li, Aleksandr Albert,
and Jérémy Bouny. Licensed under **CC BY-NC-SA 3.0**.

**Procedural forest.** The L-system instanced tree architecture is from
[red-reddington's](https://discourse.threejs.org/u/red-reddington/summary)
generous Three.js CodePens — high-performance procedural trees in two
draw calls, [discourse thread](https://discourse.threejs.org/t/procedural-instanced-forest-high-performance-real-trees/88610).
Shared under MIT.

**Assets.** Terrain and building textures from
[Poly Haven](https://polyhaven.com) (CC0). Stork 3D model from a free
community asset.

**Engines.** [Three.js](https://threejs.org) (MIT),
[MediaPipe Tasks Vision](https://developers.google.com/mediapipe) (Apache
2.0), [Vite](https://vitejs.dev) (MIT), [lil-gui](https://lil-gui.georgealways.com)
(MIT).

The live credits overlay (top-bar "Credits" button) carries the same
attribution.

---

## License

MIT for birdybird's own code. See [`LICENSE`](LICENSE) for the full text
and the third-party notices — in particular, `src/vendor/Ocean3.js` and
`Ocean4.js` are **CC BY-NC-SA 3.0**, which means birdybird-with-Ocean*-
enabled is non-commercial. Commercial deployments need to swap to the
built-in Gerstner-wave fallback (`_createGerstnerWater` in
`src/world/WaterPlane.js`), which is MIT along with the rest of the repo.

---

More of my writing on maths, graphics and AI tooling lives at
[**ki-mathias.de**](https://ki-mathias.de) · [Fourier &amp; Ocean Waves blog post (EN)](https://ki-mathias.de/en/flight-simulator.html) · [DE](https://ki-mathias.de/vogelsimulator.html).
