# T025: Tilt-To-Takeoff Mechanic
**Priority:** P3 (blocked behind asset work) | **Phase:** Polish | **Size:** M
**Depends on:** T024 (walking pose) — currently deferred until Stork
asset has Walk-/Idle-Morphs. See T024 status for details.

## Description

Phil schlägt vor: "To take off, you could tilt the phone downward to
start him moving faster and, when he is going fast enough, tilt the
phone upward to have him take off." Aktuell gibt es nur Shake-zum-
Flap-Takeoff aus dem GROUNDED-Modus. Tilt-Takeoff wäre eine zweite,
realistischere Methode — Vogel rennt mit nach-vorn-tilt los, hebt bei
genug Speed und Pull-Up-Tilt ab.

## Goal

Im GROUNDED-Modus:
- Forward-Tilt → Vogel beschleunigt am Boden (running speedup).
- Bei Speed > Takeoff-Threshold + Pull-Up-Tilt → Übergang in FLIGHT-
  Modus mit ein paar Flügelschlägen Animation.

## Acceptance Criteria

- [ ] GROUNDED + Forward-Tilt (beta < calibrated dive): Bird läuft
      vorwärts, Speed steigt asymptotisch zu Run-Max-Speed.
- [ ] Speed >= Takeoff-Threshold (~10 m/s) UND Backward-Tilt (beta >
      calibrated climb): Übergang in FLIGHT, Initial-Pitch nach oben,
      sichtbarer Flügel-Open-Animation.
- [ ] Shake-Flap weiterhin alternativer Takeoff (beide Methoden
      unterstützt).
- [ ] Onboarding-Hint im Tutorial/Calibration: "Forward tilt to run,
      back-tilt to take off."

## Notes

- Verlangt Walking-Pose aus T024 (sonst sieht der Run-Up
  unrealistisch aus).
- Datei: `src/flight/FlightPhysics.js` — GROUNDED-State-Logik
  erweitern.
