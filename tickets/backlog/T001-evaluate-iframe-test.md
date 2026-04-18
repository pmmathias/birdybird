# T001: iframe-Tilt-Test auswerten → Strategie A vs B
**Priority:** P0 | **Phase:** 0 | **Size:** S
**Depends on:** —

## Description

Auf dem iPhone in der Reddit-App (Reddit-Chat oder User-Profile-Post)
`https://pmmathias.github.io/birdybird/iframe-test.html` öffnen und prüfen,
ob DeviceOrientation im iframe-Kontext feuert.

Dies entscheidet, ob Devvit als Plattform realistisch ist (Strategie B)
oder wir direkt auf "Reddit-Post → externer Link" setzen (Strategie A).

## Test-Matrix

| Umgebung | Erwartung |
|---|---|
| iPhone Safari (Baseline) | Tilt im iframe läuft |
| iPhone Reddit-App In-App-Browser | ⚠ Kritisch — könnte WebKit Bug 221399 treffen |
| Android Chrome (falls verfügbar) | sollte immer laufen |

## Entscheidungs-Logik

- **iframe-Events kommen mit ≥ 20 Hz** → Strategie B ist machbar, Devvit bleibt als Option
- **iframe-Events kommen gar nicht (0 Hz)** → WebKit-Bug greift, Strategie A zwingend
- **iframe-Events kommen, aber <10 Hz** → Grenzfall, Smoothing nötig, Devvit riskant

## Acceptance Criteria

- [ ] Ergebnis in allen Test-Umgebungen dokumentiert (Screenshots im Ticket)
- [ ] Strategie-Entscheidung (A oder B) in ROADMAP.md eingetragen
- [ ] memory-Update mit finaler Strategie
