# birdybird — Roadmap

**Vision:** Tilt-gesteuerter mobiler Vogelflug-Arcade-Modus mit Sucht-Charakter,
abgeleitet vom [VogelSimulator](https://github.com/pmmathias/VogelSimulator)
aber als eigenständiges Mobile-First-Spiel. Primärer Distributionskanal: Reddit.

## Strategie-Gabel (entschieden 2026-04-18)

**Primär: Strategie A — Externer Link via GitHub Pages.**
**Optional später: Strategie B — Devvit-Deployment.**

Der iframe-Tilt-Test in iPhone Safari bestätigte: DeviceOrientation feuert
zuverlässig im iframe → der WebKit-Bug greift nicht. Damit ist Devvit
technisch offen, aber aktuelles Reddit-Account-Problem verschiebt B nach hinten.

| | **Strategie A — Externer Link** | **Strategie B — Devvit-App** |
|---|---|---|
| Wo läuft das Spiel | GitHub Pages (birdybird) | In Reddit eingebettet (Devvit-Webview) |
| Reddit-Rolle | Marketing-Kanal | Plattform |
| Tilt funktioniert | bestätigt ✓ | sehr wahrscheinlich ✓ (iframe-Test positiv) |
| Backend | frei wählbar (Firebase/Supabase/CF) | Reddit Redis inklusive |
| Leaderboard | eigenes Backend | native, pro Subreddit |
| Entwicklung | Standard-Web | Devvit CLI, eigene Plattform-Regeln |
| Braucht aktiven Reddit-Account | nur zum Cross-Posten | ja, für Entwicklung zwingend |

**Konsequenz:** Game-Core in Phase 1-3 wird strategieagnostisch gebaut
(reines Web, kein Devvit-Lock-in). Das Spiel läuft dann als externe URL
und kann später — bei Bedarf und mit funktionierendem Reddit-Account —
zusätzlich als Devvit-App deployt werden. Das Spiel bleibt ausserhalb
Reddit verlinkbar (Twitter, ki-mathias.de, Discord etc.).

---

## Phase 0 — Fundament (Stand jetzt)

| T | Titel | Status |
|---|---|---|
| T001 | iframe-Tilt-Test auswerten → Strategie A vs B festlegen | **done ✓** |
| T002 | Vite + Three.js Minimal-Setup im birdybird | **done ✓** |
| T003 | Tilt-Steuerung + Smoothing + Kalibrierung | **done ✓** |

## Phase 1 — MVP Game Core (~1-2 Wochen)

| T | Titel |
|---|---|
| T004 | Tap-to-Flap Mechanik, aerodynamisches Modell aus VogelSim portieren |
| T005 | Third-Person-Kamera, Landscape-Lock, Safe-Areas |
| T006 | Terrain-Basis — simpler als VogelSim (Mobile-Performance-Budget) |
| T007 | Basic bird model + flap animation |

## Phase 2 — Erste Sucht-Schleife (~1 Woche)

| T | Titel | Status |
|---|---|---|
| T005 | Ring-Rush-Modus: Ringe, Timer-Reset pro Ring, Game-Over, Highscore, Biome-Level-Up | **done ✓** |
| T009 | Restart-Flow — 30s-Runs, sofort wieder starten | done ✓ (via T005 Retry-Button) |
| T010 | Score + Endscreen mit "Tap to retry" | done ✓ (via T005) |
| T011 | Visuelle Effekte: Ring-Hit, Speed-Rush-FOV, Trail | partial (Sparkle-Burst + HUD-Pulse, Trail offen) |

## Phase 3 — Meta-Progression (~1-2 Wochen)

| T | Titel |
|---|---|
| T012 | Vogel-Dex: 5-8 Arten mit Stats-Unterschieden (localStorage) |
| T013 | Daily Challenge (fester Seed pro Tag → sozialer Highscore-Druck) |
| T014 | Persistent Leaderboard (Backend-Entscheidung) |
| T015 | Achievement-Flavor (e.g. "Erste Möwe", "50 Ringe", "Highscore ≥ X") |

## Phase 4 — Reddit-Launch

| T | Titel |
|---|---|
| T016 | Launch-Post-Asset: 30s-Video, GIF-Loop, Title-Copy |
| T017 | Cross-Post-Plan: r/GamesOnReddit, r/WebGames, r/InternetIsBeautiful, r/SideProject |
| T018 | Follow-up: "Week 1" Post mit Stats + neuen Features |

### *Strategie-B-Only (falls iframe-Test grünes Licht gibt)*

| T | Titel |
|---|---|
| T019 | Devvit-App-Setup: CLI, Account, Sub registrieren |
| T020 | Game in Devvit-Webview portieren |
| T021 | Redis-Leaderboard pro Subreddit |
| T022 | Daily-Seed via Devvit-Scheduler |

---

## Offene Design-Fragen

- **Portrait oder Landscape?** Flight-Sicht ist besser landscape, aber Reddit-User scrollen portrait → beim Start "Please rotate" anzeigen.
- **Run-Länge?** 30s vs 60s. Flappy-Bird ist 10-30s, Temple Run 60-180s.
- **Musik & SFX?** Mobile-User haben oft ton aus — VFX/Haptics müssen das Feedback tragen.
- **Monetarisierung?** Aktuell Plan: kostenlos, optional Donation-Link. Kein IAP.
