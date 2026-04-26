# T022: Cap Maximum Bank Angle
**Priority:** P1 | **Phase:** Mobile UX | **Size:** S
**Depends on:** —

## Description

Phil meldet: "the part where bird turns completely sideways is too
much. I would not let him turn that far." Aktuell kann der Vogel sich
über 90° banken (knife-edge bis fast invertiert), was unrealistisch
aussieht und für Spieler verwirrend ist — die Lenkung wird invertiert
gefühlt sobald man auf dem Kopf steht.

## Goal

Maximalen Bank-Winkel auf einen "natürlichen" Vogel-Maximum cappen.

## Acceptance Criteria

- [ ] Roll-Winkel hart geclamped auf ±50-60° (User-tunable im Code,
      Default 55°).
- [ ] Cap gilt sowohl für Tilt-Steering als auch für Keyboard- und
      Webcam-Input (eine zentrale Stelle in `FlightPhysics.js`).
- [ ] Visuell weiterhin schöne Banking-Kurven, kein hartes Clipping —
      Roll asymptotisch annähern (z.B. tanh oder Spring-Damp gegen
      den Cap).

## Notes

- Datei: `src/flight/FlightPhysics.js`
- Realistic reference: Vögel banken in der Realität ~30-45° im Cruise,
  bis ~60° bei aggressiven Turns. 55° Cap erlaubt aggressives Spielen
  ohne unphysikalische Voll-Inversion.
