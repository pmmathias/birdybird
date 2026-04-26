# T024: Walking Landing Pose
**Priority:** P2 | **Phase:** Polish | **Size:** M
**Depends on:** —

## Description

Phil meldet: "When the bird lands, I don't think you have to change
the orientation. Instead of stopping with his nose in the air, You
could have him running/walking with his wings in." Aktuell steht der
gelandete Vogel in Flight-Pose mit Schnabel hochgezogen — sieht
ungewollt aus wie ein Pinguin oder fragender Strauß.

## Goal

Beim GROUNDED-Modus: Vogel-Modell in Walking-Pose (Flügel angelegt,
Körper horizontal, Beine sichtbar bewegt). Während Yaw-Rotation:
laufende Animation. Stillstand: stehende Pose ohne Nose-up.

## Acceptance Criteria

- [ ] GROUNDED-Modus rotiert das Vogel-Model NICHT mehr in
      Flight-Pose (kein nose-up).
- [ ] Flügel sichtbar angelegt (separate Mesh-Bones oder simpler
      Mesh-Swap, je nach Storch-GLB-Struktur).
- [ ] Wenn der Vogel sich am Boden bewegt: Lauf-Animation (Beine
      pendeln, Körper dippt leicht).
- [ ] Idle-Stand: Vogel steht in natürlicher Storch-Pose, leicht
      bewegliche Idle-Animation (Kopf wackelt).
- [ ] Übergang Flight → Grounded: Flare-Phase (Flügel weit auf, Beine
      nach vorn) → Touchdown → Walking-Pose. Optional, mindestens
      sauberer Cut.

## Notes

- Stork-GLB: vermutlich Mixamo-rigged. Braucht Animation-Clips für
  walk + idle. Falls nicht im Asset enthalten: prozedurale Rotation
  der Flügel-Bones im Code.
- Datei: vermutlich `src/flight/Bird.js` o.ä. — beim Implementieren
  prüfen.
- Sister-Repo VogelSim hat eventuell schon Animation-State-Machine —
  prüfen ob portierbar.
