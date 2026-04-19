# T007: WebGPU Ocean Upgrade (Phil Crowther's v4 fragment module)
**Priority:** P3 | **Phase:** later | **Size:** L
**Depends on:** — (independent, can ship anytime after core gameplay stable)

## Description

Phil Crowther hat aktualisierte iFFT-Ocean-Module auf WebGPU-Basis
veröffentlicht, die auf iPhone Safari ab iOS 26 laufen. Die aktuelle
WebGL2-Ocean3-Version fällt auf iOS automatisch auf Gerstner-Wellen
zurück — schönes Ergebnis, aber ohne FFT-Kammdetails.

Mit einem Upgrade auf WebGPU bekommen iPhone-Spieler das "echte"
Wasser zurück.

## Referenzen

- Phil's Discourse-Thread: https://discourse.threejs.org/t/r184-and-i-phone/91051
- GitHub-Repo: https://github.com/PhilCrowther/Aviation
- **Demo zum Vergleichen auf iPhone:**
  - WebGPU Fragment (empfohlen, läuft lt. Phil schneller auf iOS):
    https://philcrowther.github.io/Aviation/xtra_perm/sdem_ocean4_gpu.html
  - WebGPU Compute:
    https://philcrowther.github.io/Aviation/xtra_perm/sdem_ocean_gpu.html
  - WebGL2 (aktuell verwendet):
    https://philcrowther.github.io/Aviation/xtra_perm/sdem_ocean3_gl2.html

## Umfang

- Feature-Detection für WebGPU (`navigator.gpu` + Three.js WebGPURenderer)
- Drei-Pfad-Rendering: WebGPU iFFT → WebGL2 iFFT → Gerstner fallback
- Upgrade Three.js-Version wenn nötig (r184+ für WebGPU-Kompatibilität)
- Neue `src/vendor/Ocean4_gpu.js` (Fragment-Shader-Variante) als zweiten Pfad
- `WaterPlane.js` um den WebGPU-Pfad erweitern
- HUD/Topbar-Indicator erweitern: "iFFT GPU" | "iFFT GL2" | "Gerstner"

## Risiken / Offene Fragen

- Three.js WebGPURenderer ist nicht 100% drop-in-kompatibel zu WebGLRenderer;
  Scene/Camera funktionieren, aber: Shader (TerrainShader.js) müssen evt.
  zu TSL (Three Shader Language) portiert werden
- Mobile-Performance: Phil's Fragment-Version läuft lt. ihm schneller als
  Compute, aber das ist ein Einzelfall. Breiter iPhone-Test nötig.
- iOS-Version-Minimum: iOS 26 (September 2025). Ältere iPhones bleiben auf
  Gerstner-Fallback — der 3-Pfad-Ansatz macht das sauber.

## Acceptance Criteria

- [ ] Drei Render-Pfade sauber detected und switched
- [ ] iPhone Safari auf iOS 26+ zeigt echte iFFT-Wellen
- [ ] Desktop unverändert (WebGL2 iFFT, kein Rückschritt)
- [ ] Fallback-Chain funktioniert auch bei älteren Geräten
- [ ] Bundle-Size-Anstieg < 150 kB

## Nicht-Ziel

- **Kein vollständiger WebGPU-Umstieg der ganzen Engine.** Nur das Ocean-Modul.
  Terrain, Sky, Trees bleiben auf WebGL-kompatiblem Code, um Desktop und
  ältere Mobile-Geräte weiter zu bedienen.
