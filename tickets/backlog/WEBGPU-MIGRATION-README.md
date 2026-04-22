# WebGPU-Migration — Master-Übersicht

**Branch:** `webgpu-port` (niemals direkt in `main` pushen ohne T018)
**Ziel:** `WebGPURenderer` statt `WebGLRenderer`, schrittweise, ohne
Regression auf bestehendem WebGL-Pfad.

## Warum WebGPU?

- Moderne GPU-API (kein aufgeblähter OpenGL-Layer) → geringere CPU-Draw-Call-Kosten
- Compute-Shader verfügbar → zukünftig Flocking, Grass-Tile-Generation, iFFT
  direkt in GPU statt CPU-L-System
- TSL (Three.js Shading Language) als Shader-Abstraktion:
  gleiche Logik läuft auf WebGL2 und WebGPU, JS-typed statt GLSL-string-concatenation
- iOS Safari 18.2+ + Android Chrome 121+ stable, Desktop ubiquitär

## Risiken

- `three/addons/objects/Sky.js` + `Water.js` sind GLSL-intern → eigene Ports nötig
- Eigene ShaderMaterial-Instanzen (Terrain, Forest, Biomes) müssen portiert werden
- Ocean3 ist CC BY-NC-SA → kein einfacher Port (siehe T016)
- TSL ist noch in Entwicklung, manche Features (BatchedMesh + custom attribs)
  können Hürden sein
- Bundle-Delta ~150-300 kB durch WebGPU-Module

## Ticket-Sequenz

| # | Ticket | Abhängigkeit | Größe | Bemerkung |
|---|---|---|---|---|
| 1 | [T010 — WebGPU-Spike](T010-webgpu-spike-walking-skeleton.md) | — | S | Dual-Renderer, `?renderer=webgpu` opt-in |
| 2 | [T011 — Sky + PMREM](T011-webgpu-scene-baseline-sky-pmrem.md) | T010 | M | Szene-Baseline |
| 3 | [T012 — Terrain-Shader → TSL](T012-webgpu-terrain-shader-tsl.md) | T011 | M | Height-Blend Custom-Shader |
| 4 | [T013 — Clouds + Houses](T013-webgpu-clouds-houses-instanced.md) | T011 | S | Standard-Material, Verify-only |
| 5 | [T014 — Forest → TSL](T014-webgpu-forest-tsl-port.md) | T011 | **L** | Größtes einzelnes Ticket |
| 6 | [T015 — Water Gerstner-TSL](T015-webgpu-water-tsl-gerstner.md) | T011 | M-L | Gerstner-Port, Reflector-Node |
| 7 | [T016 — Ocean3-Entscheidung](T016-webgpu-ocean3-decision.md) | T010, T015 | S | CC-BY-NC-SA Lizenzfrage; verweist auf T007 |
| 7b | [T007 — Phil's WebGPU-Ocean-Upgrade](T007-webgpu-ocean-upgrade.md) | T010 | L | Bereits im Backlog, paralleler Ocean-Pfad via Phil's neues Modul |
| 8 | [T019 — Sekundäre Shader](T019-webgpu-secondary-shaders-biomes-underwater.md) | T011 | S-M | Biomes/Underwater/Landmarks |
| 9 | [T017 — Mobile-Safari-Verifikation](T017-webgpu-mobile-safari-verification.md) | T010-T015 | M | Real-Device-Matrix |
| 10 | [T018 — Benchmark + Merge](T018-webgpu-benchmark-merge-strategy.md) | T010-T017 | M | Tor-Ticket, Entscheidung zu main |

## Kritische Design-Entscheidungen

1. **Dual-Path, nicht Replace:** WebGL bleibt **immer** als Fallback im Code.
   WebGPU ist bis T018 opt-in via `?renderer=webgpu`.
2. **Ocean3 bleibt WebGL-only** (T016 Option A)
3. **Sky via pre-rendered EnvMap-Texture** (T011 Option A) — keine TSL-Sky-Portierung
4. **Forest-Port gedeckelt:** Falls nativer TSL-Port zu aufwendig → Fallback auf
   `WebGPURenderer.forceWebGL = true` für Forest-Assets (Übergangslösung)

## Nicht im Scope

- Compute-Shader-basierte Flocking / Grass-Tile-Generation (Follow-up-Phase)
- iOS <18.2 Support via WebGPU (fällt immer auf WebGL zurück)
- Devvit-Embedding-Kompatibilität (separate Strategie-B-Frage)

## Status

- [x] Branch `webgpu-port` erstellt
- [ ] T010 — WebGPU-Spike
- [ ] T011 — Sky + PMREM
- [ ] T012 — Terrain-Shader → TSL
- [ ] T013 — Clouds + Houses
- [ ] T014 — Forest → TSL
- [ ] T015 — Water Gerstner-TSL
- [ ] T016 — Ocean3-Entscheidung
- [ ] T019 — Sekundäre Shader
- [ ] T017 — Mobile-Safari-Verifikation
- [ ] T018 — Benchmark + Merge
