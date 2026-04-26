# T023: Non-Linear Tilt Response Curve
**Priority:** P2 | **Phase:** Mobile UX | **Size:** S
**Depends on:** T021 (dead zone first)

## Description

Phil schlägt vor: "you could use non-linear controls — where the
controls are less sensitive at small angles and more sensitive at
large angles." Lineares Mapping zwingt den Spieler zu sehr kleinen,
präzisen Tilts für Mikro-Lenkung — was auf dem Handy schwer ist und
gegen die Sensor-Noise konkurriert. Eine kubische Response-Kurve
(`output = sign(input) * |input|^2.5`) gibt sanfte Mikro-Korrekturen
und knackige Hard-Turns.

## Goal

Anstelle linearer Tilt → Roll/Pitch-Übertragung eine Curve mit Exponent
~2-3 anwenden.

## Acceptance Criteria

- [ ] Roll-Input (gamma): `roll = sign(g) * Math.pow(|g|/maxG, 2.5)`
      (oder konfigurierbar).
- [ ] Pitch-Input (beta): gleiche Curve.
- [ ] Kleine Tilts (1-3° über Dead-Zone): minimale Response.
- [ ] Große Tilts (15°+): nahezu volle Lenk-Authority.
- [ ] Smooth, keine Diskontinuität beim Vorzeichenwechsel.

## Notes

- Datei: `src/core/MobileInput.js` oder `src/flight/FlightPhysics.js`
  je nach existierender Tilt-Mapping-Stelle.
- Tunable Exponent als const im Code (kein URL-Param nötig).
- Reihenfolge: erst T021 Dead Zone, dann T023 Non-Linear — sonst
  potenziert die Curve auch die Mikro-Noise.
