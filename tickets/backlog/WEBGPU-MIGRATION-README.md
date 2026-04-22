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

## Status (Stand 2026-04-22)

- [x] Branch `webgpu-port` erstellt (Commit c02b3fc)
- [x] T010 — WebGPU-Spike (f069319)
- [x] T011 — Sky + PMREM (SkyMesh, PMREM skipped auf WebGPU — 4a4887b)
- [x] T012 — TerrainShader → TSL NodeMaterial (ee620d8)
- [x] T014 — Forest → TSL (v1 ohne Root-Spread/Sway/LOD-Cull — 7e58800)
- [x] T015 — Water Gerstner-TSL (WaterMesh + positionNode — 4a4887b)
- [x] T016 — Ocean3-Entscheidung (skip auf WebGPU — 4a4887b)
- [x] T013 — Clouds + Houses — verified ohne Änderung (Standard-Materials)
- [x] T019 — Sekundäre Shader — verified keine Fehler auf WebGPU-Pfad
- [x] T018 — Benchmark in Headless Chromium: WebGL 55 FPS, WebGPU 43 FPS
  - Headless Chromium bevorzugt WebGL2; echte Device-Perf-Messung = T017
- [ ] T017 — Mobile-Safari Real-Device-Verifikation (iOS 26+ Ziel)
- [ ] **Merge `webgpu-port` → `main`**: Branch bleibt als Experiment erhalten,
      WebGL-Pfad auf `main` bleibt führend. Merge nach T017.

## Ergebnis-Summary

Die komplette App läuft auf beiden Renderern:

**Funktioniert auf WebGPU:**
- Sky (SkyMesh), Terrain (TSL 5-Layer-Blend), Water (WaterMesh + Gerstner),
  Forest (bark + leaves, grundlegendes Material), Houses, Hotel-Pools,
  Clouds, Bird-Model, Rings, Flock, HUD, NestQuest, RingRush

**V2-Kandidaten (aktuell nur auf WebGL):**
- Forest: Root-Spread, Sway, LOD-Cull, HSL-Instance-Jitter, Distance-Tint
- PMREM-Environment-Map (SkyMesh crasht Three.js r184 PMREM)
- Ocean3 iFFT (CC BY-NC-SA — bleibt WebGL-exklusiv bis T007)

**Bundle-Kosten:** +150 kB gzip durch eager three/webgpu-Import (statische
Imports nötig wegen Race-Condition mit top-level await + dynamic import
`'three/webgpu'` in der main.js Bootkette). Refactor zu `manualChunks` +
`import.meta.glob` als Follow-up.
