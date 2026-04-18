# T004: Tap-to-Flap + Flug-Physik (VogelSim-Port)
**Priority:** P0 | **Phase:** 1 | **Size:** M-L
**Depends on:** T003

## Description

Portierung des VogelSim-Flugmodells (FLYING-Mode) nach birdybird mit
Arcade-getunten Parametern. Vogel fliegt jetzt echt durch die Welt,
reagiert auf Tilt (Banking/Turning, Pitch) und Tap (Flap).

## Umfang

- `src/constants.js` — arcade-tuned physics constants (siehe Tuning unten)
- `src/utils/math.js` — clamp, lerp
- `src/flight/FlightState.js` — position, velocity, orientation, flap state
- `src/flight/FlightPhysics.js` — FLYING-Mode-Port (lift, drag, gravity,
  flap thrust, baseline lift via wing incidence, ground effect, auto-trim,
  speed limit). Grounded/Landing/Takeoff/Underwater bewusst weggelassen.
- `src/flight/CameraRig.js` — minimale Chase-Cam mit lerp-Follow
- `src/main.js` — Integration: tilt → applyRoll/Pitch, tap → flap,
  bird mesh folgt state, chase cam follows bird
- Keyboard-Fallback im Desktop-Mode (W/S/A/D/Space)
- Ground ist aktuell flat plane bei y=0 (Terrain kommt in T006)

## Arcade-Tuning vs VogelSim

| Parameter | VogelSim | birdybird | Warum |
|---|---|---|---|
| WING_INCIDENCE | 0.08 | 0.12 | +50% Baseline-Lift, leichter oben bleiben |
| FLAP_THRUST | 60 | 80 | Stärkerer Push pro Flap |
| FLAP_COOLDOWN | 0.25 | 0.15 | Rhythmisches Flappen möglich |
| MAX_SPEED | 100 | 80 | Mobile-freundlicher Cap |
| BANK_RATE | 2.0 | 1.5 | Sanftere Kurven, weniger Überdreher |
| MAX_PITCH | 0.7 | 0.6 | Weniger extreme Pitches |

## Acceptance Criteria

- [ ] Vogel startet bei y=30 und fliegt autonom nach vorn
- [ ] Tilt-links/rechts → Banking → Turning (Richtung wahrscheinlich
  zunächst invertiert; Vorzeichen ggf. in main.js flippen)
- [ ] Tilt-vor/zurück → Nose up/down
- [ ] Tap auf Canvas → ein Flap (Boost)
- [ ] Ground-Collision bei y=0 — Vogel crasht nicht durch Boden
- [ ] Kamera folgt smooth
- [ ] Desktop: W/S/A/D + Space funktionieren
- [ ] Keine NaN/Infinity-Crashes nach 60s Flug
- [ ] HUD zeigt Speed + Altitude