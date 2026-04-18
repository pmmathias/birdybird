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

- [ ] `npm run dev` startet lokal
- [ ] `npm run build` erzeugt `dist/`
- [ ] GitHub-Action deployed auf GitHub Pages
- [ ] `index.html` zeigt 3D-Scene, `tilt-test.html` und `iframe-test.html` bleiben als `public/*.html`
