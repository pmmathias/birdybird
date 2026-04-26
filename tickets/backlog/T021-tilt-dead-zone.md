# T021: Tilt Dead Zone for Mobile Steering
**Priority:** P1 | **Phase:** Mobile UX | **Size:** S
**Depends on:** —

## Description

Phil meldet: "It might need a bit more of a 'dead zone' so the bird
won't respond to tiny motions." Aktuell überträgt das Tilt-Mapping
auch sub-degree Mikrobewegungen direkt auf Roll/Pitch — der Vogel
zappelt selbst wenn man das Phone nur ruhig zu halten versucht.

## Goal

Eine konfigurierbare Dead Zone um den kalibrierten Mittelpunkt, die
kleine Sensor-Schwankungen ignoriert.

## Acceptance Criteria

- [ ] Dead-Zone-Schwellwert pro Achse (gamma/beta) — Default ~2-3°
      um die kalibrierte Mitte.
- [ ] Innerhalb der Dead Zone: Roll/Pitch-Input = 0 (keine Lenkung).
- [ ] Außerhalb: Input wird relativ zum Dead-Zone-Rand normalisiert,
      damit keine Sprung-Diskontinuität beim Verlassen der Zone
      entsteht (`smoothInput = (raw - deadZone) / (max - deadZone)`).
- [ ] Vogel reagiert auf 5° Tilt deutlich, auf 0.5° gar nicht.

## Notes

- Datei: `src/core/MobileInput.js`
- Test-Methode: Phone flach hinlegen → Vogel sollte stabil geradeaus
  fliegen, keine Drift, keine Mikro-Korrekturen.
- Optional als URL-Param tunbar: `?deadzone=3` — nur falls wir's
  später brauchen, nicht initial.
