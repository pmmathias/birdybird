# T029: Mehr Bäume — Dichteren Forest
**Priority:** P2 | **Phase:** Polish | **Size:** S
**Depends on:** T027 (LOD first, dann auf das Triangle-Budget setzen)

## Description

Aktuelle Tree-Count: **400** (`RedReddingtonForest.js:30`,
`TREE_COUNT: 400`). Mit per-cluster Frustum-Culling rendert davon
oft nur ein Bruchteil. Mathias' Wunsch: "MEHR von den Instanced
Trees darstellen, das würde die Szene MEGA aufwerten!" — die
Insel wirkt aktuell oft leerer als sie könnte.

## Goal

Sobald T027 (LOD) das Triangle-Budget freischaufelt, Tree-Count
hochziehen. Erste Schätzung: 700-1000 Bäume bei vergleichbarer
oder besserer Performance gegenüber heute.

## Acceptance Criteria

- [ ] Tree-Count auf mind. 700 erhöht.
- [ ] `air-over-land` p95 fps ≥ 32 (= aktuelle Baseline-FPS oder
      besser, dank LOD).
- [ ] Inseln sehen visuell deutlich bewaldeter aus —
      Vorher/Nachher-Screenshot in PR.
- [ ] Per-Cluster-Splitting greift weiterhin sauber, kein
      Memory-Spike.

## Notes

- Wenn T027 erfolgreich, könnten auch 1000+ Bäume drin sein.
  Iterativ steigern + benchmarken.
- Achten auf Cluster-Verteilung: gleichmäßig auf der Insel,
  kein Beach-Cluster mit dutzenden Bäumen.
- Bench-Vergleich: vor + nach mit `scripts/perf-bench.mjs`.
