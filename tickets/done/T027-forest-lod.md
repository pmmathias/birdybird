# T027: Forest LOD — Distance-Based Triangle Reduction
**Priority:** P1 | **Phase:** Perf | **Size:** M
**Depends on:** —

## Description

Bench (2026-04-27) zeigt: der Forest dominiert die Triangle-Last
(~6M tris) und macht 7-10 fps Unterschied in `air-over-land` und
`inside-forest`. p95 in `inside-forest` liegt bei 26.5 fps — d.h.
jeder 20. Frame braucht >38 ms. Genau das wahrgenommene "Ruckeln".

Aktuelle Struktur (`src/vendor/RedReddingtonForestNode.js`,
`RedReddingtonForest.js`): per-cluster InstancedMesh-Split für
Frustum-Culling (3× FPS-Win laut bestehenden Notizen). Aber jeder
Tree-Geometry hat volle Detailstufe — auch der 2 km entfernte Baum
hat alle L-System-Branch-Segmente.

## Goal

Distance-basierte LOD: nahe Bäume voll-detailliert, ferne Bäume mit
reduzierter Geometry. Konkret 2-3 Stufen, z.B. 100 % bei <300 m,
60 % bei 300-1000 m, 30 % bei >1000 m. Erwartung: 30-50 %
Triangle-Reduktion ohne sichtbaren Qualitätsverlust aus Chase-Cam.

## Acceptance Criteria

- [ ] Mindestens zwei LOD-Levels für L-System-Tree-Geometry
      (Branch-Segments + Leaf-Density reduziert).
- [ ] Per-Cluster auf passende LOD gewechselt (Cluster-Centroid
      vs. Camera-Distance einmal pro Frame, nicht pro Tree —
      Cluster sind ohnehin spatial gruppiert).
- [ ] `inside-forest` p95 ≥ 35 fps (vs. aktuelle 26.5).
- [ ] `air-over-land` Triangle-Count im Bench < 6M (vs. aktuelle 9.3M).
- [ ] LOD-Wechsel beim Cluster-Crossing nicht als Pop sichtbar
      (Hysterese oder Fade).

## Notes

- Der LOD-Switch sollte den Cluster nicht neu generieren, nur
  die Mesh-Geometry tauschen — die InstanceMatrix-Buffer bleiben
  gleich, also kein Allocator-Spike.
- Falls L-System-Generation pro Tree komplex ist: LOD-Geometries
  einmalig vorab generieren und nach Distanz wechseln.
- Bonus-Win: Low-LOD-Bäume sind so billig, dass wir die Anzahl
  steigern können (siehe T029).
