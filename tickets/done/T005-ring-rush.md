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

- [x] 20 golden glowende Ringe sichtbar verteilt um den Spawn
- [x] Durchflug triggert Score+1, Timer-Reset, Vibrate (mobile), Sparkle-Burst
- [x] Alle gesammelt → neue 20 spawnen
- [x] Timer 0 → Game-Over-Modal mit Score + Highscore + "Tap to Retry"
- [x] Retry startet neue Runde, Highscore persistent
- [x] `?game=free` überspringt Ring Rush komplett (default ist inzwischen `nest`)
- [x] Bundle < 1 MB, keine Console-Errors

## Ergebnis (2026-04-22)

Ring Rush läuft produktiv auf GitHub Pages. Erreichte Design-Abweichungen
vom ursprünglichen Plan:

- **Timer-Modell geändert von "+3s pro Ring" auf "Full-Reset pro Ring"**
  (Commit `fa1b2f0`). Fühlt sich deutlich arcadiger an — jeder Ring =
  frische 100s, statt langsam Zeit einzukratzen. Start-Timer `RING_RUSH_START_SECONDS = 100`
  (zum weiteren Debug-Tuning noch etwas großzügig).
- **Level-Progression mit Biomwechsel** (`onLevelUp` → `applyBiome` + `regenerateForest`).
  `RINGS_PER_LEVEL` steht aktuell auf `1` für Debug; für Production auf ~100 erhöhen.
- **Nest-Mode als Default:** `?game=nest` ist Default, `?game=ringrush` aktiviert
  den klassischen Ring-Rush-Mode, `?game=free` deaktiviert beides.
- **Side-Rings in Nest-Quest:** Ring-Rush wird auch innerhalb Nest-Mode als
  "Score-Nebenziel" mitgespielt (ohne eigenen Timer / Game-Over).
- **Zusatz-Juice:** `RingBurst.js` (Sparkle-Partikel beim Pickup), HUD-Pulse,
  "+ZEIT"-Bonus-Popup, Level-Up-Overlay mit Biome-Namen.

Nächste Iteration (nicht Teil dieses Tickets):
- TEMP-Konstanten (`RING_RUSH_START_SECONDS=100`, `RINGS_PER_LEVEL=1`) final tunen
- Optional: Audio-Feedback auf Ring-Collect verstärken
- Optional: Daily-Seed für identische Ring-Muster über alle Spieler
