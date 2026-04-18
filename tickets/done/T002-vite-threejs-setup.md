# T002: Vite + Three.js Minimal-Setup
**Priority:** P0 | **Phase:** 0 | **Size:** S
**Depends on:** T001

## Description

birdybird vom statischen HTML-Prototyp zu einer richtigen Vite + Three.js App
upgraden. Ziel: eine minimale 3D-Scene (Himmel + Boden + Kamera), auf der
dann die Game-Mechaniken aufgebaut werden.

Three.js-Version und Setup sollten mit VogelSimulator kompatibel bleiben,
damit Code-Portierung einfach bleibt (FlightPhysics, Terrain-Shader etc.).

## Umfang

- `npm init` + Vite + Three.js + ggf. lil-gui für Debug
- Base-Path `/birdybird/` (wie VogelSim `/VogelSimulator/`) für GitHub Pages
- `.github/workflows/deploy.yml` (Kopie von VogelSim, Pfade angepasst)
- Initial-Scene: Sky + flat ground + ambient/directional light
- Kamera mit einfacher Orbit-Control für Dev

## Acceptance Criteria

- [x] `npm run dev` startet lokal
- [x] `npm run build` erzeugt `dist/` (517 kB bundle, gzip 130 kB — Three.js-typisch)
- [x] GitHub-Action deployed auf GitHub Pages
- [x] `index.html` zeigt 3D-Scene, `tilt-test.html` und `iframe-test.html` bleiben als `public/*.html`

## Ergebnis (2026-04-18)

- Vite 5.4 + Three.js 0.183 (gleiche Version wie VogelSim für spätere Code-Portierung)
- `src/main.js`: Sky, ground, 40 Bäume (Cone-Placeholder), Vogel-Placeholder (Body + 2 Wings mit simpler Flap-Animation via `sin(t*8)`), OrbitControls, FPS-Counter
- `/birdybird/` als base-path. Tests unter `/birdybird/tilt-test.html` und `/birdybird/iframe-test.html` bleiben erreichbar.
- Pages-Config wurde von "legacy" (branch/root) auf "workflow" (GitHub Actions) umgestellt — ein Zwischen-Deploy wurde noch von der legacy-Route gewonnen, danach sauber.
- Node 20 deprecation warnings auf Actions — fix bis 2026-06-02 (kleines Follow-up-Ticket).
