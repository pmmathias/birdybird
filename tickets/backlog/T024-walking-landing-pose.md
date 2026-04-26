# T024: Walking Landing Pose
**Priority:** P3 (deferred) | **Phase:** Polish | **Size:** M-L (asset work)
**Depends on:** new asset / morph-target authoring (Blender)

## Description

Phil meldet: "When the bird lands, I don't think you have to change
the orientation. Instead of stopping with his nose in the air, You
could have him running/walking with his wings in." Aktuell steht der
gelandete Vogel in Flight-Pose mit Schnabel hochgezogen — sieht
ungewollt aus wie ein Pinguin oder fragender Strauß.

## Status (2026-04-26): deferred

GLB-Inspektion (`scripts/parse-stork-glb.mjs`) ergab: das Stork-Asset
ist **nicht skeletal**, sondern morph-target-basiert.

**Stork.glb-Aufbau:**
- 0 Skins, 0 Bones, 1 Node, 1 Mesh
- 13 Morph-Targets (`storkFly_B_001` … `storkFly_B_013`)
- 1 Animation `storkFly_B_` mit 14 Keyframes, alle 0.1 s eine Pose
  mit Weight 1, alle anderen 0 — also stop-motion-Sequenz, keine
  echte Blend-Shape-Mischung
- Alle 13 Posen sind Flugposen, keine "wings folded against body"
  oder "walking" Pose dabei

**Konsequenz:**
- Bone-Animation im Code: ausgeschlossen, es gibt keine Bones.
- Mit nur 13 Flap-Posen können wir keine Walk-/Idle-Pose mischen.
- Echte Lösung: zusätzliche Morph-Targets ins GLB einbauen
  (Blender-Re-Export oder anderes Stork-Asset mit mehr Posen).
  Das ist Asset-Arbeit, kein Code.

Daher: **zurückgestellt bis ein Asset-Pass möglich ist.** T025
(Tilt-Takeoff) und T026 (Flare-Landing) hängen davon ab — die
Mechanik wäre vorhanden, aber visuell wäre der Vogel nach wie vor in
Flugpose während Boden-Phasen.

## Code-only Quick-Win (separates Sub-Ticket T024a, falls gewünscht)

Bevor das Asset gefixt ist, ginge ein 70%-Look:
- Body horizontal stellen (nose-up-Rotation in `BirdModel.js:103`
  entfernen)
- Aus den 13 Flap-Frames denjenigen finden, in dem Flügel am
  niedrigsten / nahesten am Körper sind, und dort parken statt bei
  `time = 0.95`
- Bestehenden Walking-Bob beibehalten

Sieht nicht nach echtem Walking aus, aber besser als der jetzige
Pinguin-Modus. Wäre ~30 Min Arbeit + visueller Frame-Vergleich.

## Goal (wenn Asset bereitsteht)

Beim GROUNDED-Modus: Vogel-Modell in Walking-Pose (Flügel angelegt,
Körper horizontal, Beine sichtbar bewegt). Während Yaw-Rotation:
laufende Animation. Stillstand: stehende Pose ohne Nose-up.

## Acceptance Criteria

- [ ] Asset-Refresh: Stork-GLB enthält zusätzliche Morph-Targets
      oder Skin/Bones für Walk- und Idle-Pose
- [ ] GROUNDED-Modus rotiert das Vogel-Model nicht mehr in
      Flight-Pose (kein nose-up)
- [ ] Wenn Vogel sich am Boden bewegt: Walk-Animation läuft
- [ ] Idle-Stand: natürliche Stork-Pose mit subtiler Idle-Animation
- [ ] Übergang Flight → Grounded: Flare-Phase → Touchdown →
      Walking-Pose, sauberer Cut

## Diagnostic / References

- `scripts/parse-stork-glb.mjs` — direkter GLB-Parser, dumpt
  Skins/Bones/Animations/Morph-Targets ohne Browser-Setup. Bei
  Asset-Refresh wieder ausführen, um neue Strukturen zu verifizieren.
- `src/flight/BirdModel.js:60-64` — Animation-Setup, wo neue Clips
  angedockt werden müssten
- Sister-Repo VogelSimulator hat dasselbe Asset-Constraint (geprüft).
