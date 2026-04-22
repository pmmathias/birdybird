# T015: Water + Underwater → TSL Gerstner-Port
**Priority:** P0 | **Phase:** WebGPU-Migration | **Size:** M-L
**Depends on:** T011

## Description

`three/addons/objects/Water.js` ist GLSL-basiert und funktioniert auf
`WebGPURenderer` nicht. Der aktuelle Code hat zwei Pfade:

1. **Ocean3 iFFT** (Phil Crowther, CC BY-NC-SA 3.0) — WebGL2-only, nutzt
   FBO + Float-Textures. **Darf aufgrund der NC-Lizenz nicht ohne weiteres
   nach WebGPU portiert werden** (non-commercial OK, aber Code-Modifikation
   braucht ShareAlike-Relicensing).
2. **Gerstner-Fallback** — einfache 3-Wave-Überlagerung via GLSL-Injection
   in `Water.js`. Das muss nach TSL portiert werden.

## Scope

- Neue Datei: `src/world/WaterPlaneNode.js`:
  - Eigene `MeshStandardNodeMaterial`-basierte Wasser-Plane (nicht mehr
    `three/addons/objects/Water.js`, da dessen Reflexions-Setup GLSL-intern ist)
  - Gerstner-Displacement in TSL:
    ```js
    const gerstner = Fn(([pos, amp, freq, speed, dir, steep]) => {
      const phase = freq.mul(dir.dot(pos)).sub(speed.mul(time));
      return vec3(
        steep.mul(amp).mul(dir.x).mul(cos(phase)),
        amp.mul(sin(phase)),
        steep.mul(amp).mul(dir.y).mul(cos(phase)),
      );
    });
    ```
  - 3 überlagerte Wellen (identische Parameter wie `GERSTNER_PARS` in `WaterPlane.js`)
  - Reflexion via `Reflector` addon (hat WebGPU-Äquivalent: `ReflectorNode`
    aus `three/examples/jsm/tsl/display/`)
  - Sun-Highlight, Wasser-Farbe, Distortion-Scale wie bisher
- `src/world/Underwater.js`:
  - Ebenfalls portieren, aber nur Desktop (Mobile: `UnderwaterWorld` ist null)
- **Ocean3-Entscheidung:** siehe T016 (eigenes Ticket)

## Acceptance Criteria

- [ ] Wasser rendert auf WebGPU mit Gerstner-Wellen
- [ ] Sun-Highlight sichtbar, Water-Color stimmt
- [ ] Reflexion (Himmel + nahes Terrain) funktioniert
- [ ] Underwater-Plane sichtbar beim Tauchen (Desktop)
- [ ] A/B-Screenshot WebGPU vs. WebGL-Gerstner-Pfad
- [ ] FPS bei Kamera über Wasser: WebGPU ≥ WebGL

## Nicht-Ziele

- Ocean3 iFFT auf WebGPU (siehe T016, ggf. nie)
- Wellen-Qualitätsverbesserung gegenüber dem aktuellen Gerstner-Modell
