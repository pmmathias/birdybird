# T005: Ring Rush — erstes Gamification-Ticket
**Priority:** P0 | **Phase:** 2 | **Size:** M
**Depends on:** T004 (VogelSim-Rebase)

## Description

Das erste echte Spielziel: sammel Ringe in 60s, jeder Ring gibt +3s Bonus,
Highscore in localStorage, Restart mit einem Tap. Setzt auf der VogelSim-Basis auf.

## Umfang

- `src/game/GameMode.js` — Enum für zukünftige Modes
- `src/game/Ring.js` — Torus-Mesh mit Glow + Hover-Animation
- `src/game/RingRush.js` — Controller mit Spawn/Collision/Timer/Score
- `src/game/RingRushUI.js` — HUD (Timer + Score) + Game-Over-Modal
- `src/constants.js` — RING_* Konstanten
- `src/main.js` — Instantiate + Update-Loop + Mobile-Start-Hook
- `index.html` — Styles für Ring-Rush-HUD und -Modal

## Konstanten (arcade-tuned)

- RING_COUNT 20, collect radius 8m, spawn radius 500m
- Ring height: 20-120m über Gelände/Wasser
- Timer start 60s, +3s pro Ring
- Grace-Period 2.5s nach Start
- Highscore in `localStorage['birdybird.ringrush.highscore']`

## Start-Logik

- **Mobile:** nach MobileUI.onStart (= Kalibrierung fertig)
- **Desktop:** direkt beim Seitenaufruf
- **`?game=free`:** Ring Rush deaktiviert, Free-Flight

## Acceptance Criteria

- [ ] 20 golden glowende Ringe sichtbar verteilt um den Spawn
- [ ] Durchflug triggert Score+1 und Timer+3s, kleines Vibrate (mobile)
- [ ] Alle gesammelt → neue 20 spawnen
- [ ] Timer 0 → Game-Over-Modal mit Score + Highscore + "Tap to Retry"
- [ ] Retry startet neue Runde, Highscore persistent
- [ ] `?game=free` überspringt Ring Rush komplett
- [ ] Bundle < 1 MB, keine Console-Errors
