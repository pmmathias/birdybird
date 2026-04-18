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

- [x] Ergebnis in allen Test-Umgebungen dokumentiert
- [x] Strategie-Entscheidung (A oder B) in ROADMAP.md eingetragen
- [x] memory-Update mit finaler Strategie

## Ergebnis (2026-04-18)

- **iPhone Safari Standalone**: funktioniert, Events ~60 Hz ✓
- **iPhone Reddit-App In-App-Browser (Standalone)**: funktioniert ✓ (kein iframe, WKWebView direkt)
- **iPhone Safari iframe-Variante**: funktioniert ✓ — der kritische Test
- **iPhone Reddit-App iframe**: **nicht getestet** wegen Account-Sperre, aber Safari = WebKit-Engine,
  daher sehr hohe Wahrscheinlichkeit, dass auch Devvit-Webview läuft.

**Entscheidung:** Strategie **A als primärer Startpunkt**, **B als Option offen**.
Das Spiel-Core wird strategieagnostisch gebaut (phase 1+). Devvit-Deployment (T019-T022)
rückt nur bei Bedarf und mit funktionierendem Reddit-Account in Arbeit.
