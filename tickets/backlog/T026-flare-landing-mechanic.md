# T026: Flare-Landing Mechanic
**Priority:** P3 (blocked behind asset work) | **Phase:** Polish | **Size:** L
**Depends on:** T024 (walking pose), T025 (takeoff) — both deferred
until Stork asset has Walk-/Idle-Morphs. See T024 for details.

## Description

Phil schlägt eine Flare-Landung vor (analog zum Kleinflugzeug-
Landing): "Get close to the ground, and let speed bleed off. And then
tilt the phone quickly in the upwards direction so that he tilts his
wings way back to slow down completely. ... If you do it just right
the airplane will stall just inches above the runway."

Das wäre eine Skill-basierte Landung, die belohnt wird (saubere
Touchdown-Animation, vielleicht Score-Bonus in Ring Rush / Nest Quest)
oder bestraft (harter Crash bei zu schneller / zu hoher Bird-Stall).

## Goal

Beim Anflug niedrig + langsam + scharfer Pull-Up:
- Wings flare nach hinten (visual)
- Speed sackt schnell ab (drag spike)
- Bei korrektem Timing: weicher Touchdown direkt am Boden
- Falsches Timing: hartes Aufschlagen oder Wieder-Aufsteigen

## Acceptance Criteria

- [ ] Detect "Flare-Intent": Altitude < ~5m, Speed < ~15 m/s, Pitch
      > +25° (steiler Pull-Up vom kalibrierten Mittel).
- [ ] Während Flare: Drag-Coefficient temporär verdreifacht, Speed
      bleed Rate steil.
- [ ] Wenn beim Stall Altitude < 0.5m: GROUNDED-Übergang in
      Walking-Pose, optional Score-Bonus + UI-Flash "Smooth landing!".
- [ ] Wenn beim Stall Altitude > 0.5m: Vogel kippt nach unten (free
      fall), normaler GROUNDED bei Bodenkontakt aber kein Bonus.
- [ ] Wenn beim Stall Altitude < 0 (in den Boden gerast): Crash-
      Effekt (Federn, Sound), Respawn-Modal mit Tipp "Try slower
      next time".

## Notes

- Größe L weil neue State-Machine (FLIGHT → FLARE → GROUNDED) +
  Animation-States + UI-Feedback.
- Tutorial-Step in Calibration / Onboarding nötig: "Pull up sharply
  near ground to flare-land."
- Reference: kleine Cessna-Landing — speed bleeds off, nose comes up,
  stall direkt über Asphalt.
