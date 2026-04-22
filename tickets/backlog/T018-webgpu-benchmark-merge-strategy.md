# T018: Benchmark + Merge-Entscheidung — `webgpu-port` → `main`?
**Priority:** P0 | **Phase:** WebGPU-Migration | **Size:** M
**Depends on:** T010-T017

## Description

Das Tor-Ticket: Benchmarks auf beiden Renderern, dann Entscheidung,
**ob und wie** `webgpu-port` nach `main` gemerged wird.

## Scope

### Benchmark

- `scripts/forest-bench.mjs` erweitern um Renderer-Achse:
  - Matrix: {2000 Bäume × {Desktop, Mobile-UA} × {WebGL, WebGPU}}
  - Metriken: FPS (avg + p95), Draw-Calls, GPU-Memory (wenn via
    `adapter.requestAdapterInfo()` zugänglich), Bundle-Größe
- Zusätzliche Benchmarks: Water-Plane (iFFT vs. Gerstner), Terrain-heavy-View
- Ergebnis als Tabelle + kurzes Narrativ

### Entscheidungsmatrix

| Fall | Aktion |
|---|---|
| WebGPU ≥ +20% FPS auf beiden Plattformen + stabil | Flip `AUTO_PREFER_WEBGPU = true`, WebGPU wird Default, WebGL Fallback |
| WebGPU parität (-10% bis +10%) | `AUTO_PREFER_WEBGPU = false`, WebGPU als opt-in via `?renderer=webgpu` behalten |
| WebGPU langsamer oder unstabil auf Mobile | Branch in `main` nicht mergen, als `webgpu-experiment`-Branch belassen, dokumentieren |

### Merge-Strategie (wenn grünes Licht)

- Dual-Path bleibt im Code; Feature-Flag steuert Default.
- WebGL-Code-Pfad wird **nicht** entfernt (Fallback für Alt-Geräte)
- Release-Notes in ROADMAP.md
- Neue Sektion in CLAUDE.md: "Renderer-Architecture Dual-Path"

## Acceptance Criteria

- [ ] Benchmark-Tabelle im Ticket eingetragen (6+ Datenpunkte)
- [ ] Entscheidung dokumentiert mit Begründung
- [ ] Falls Merge: `webgpu-port` in `main` gemerged, ohne Regression auf WebGL-Default
- [ ] Falls kein Merge: Branch bleibt erhalten, README/ROADMAP erwähnt experimentellen Stand
- [ ] Keine Performance-Regression auf WebGL-Default-Pfad (±5%)
- [ ] Bundle-Size-Delta nach Merge dokumentiert (Three.js WebGPU-Module ~150-300 kB extra)
