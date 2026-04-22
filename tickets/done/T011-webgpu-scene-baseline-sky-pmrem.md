# T011: Sky + PMREM + Licht-Setup WebGPU-kompatibel
**Priority:** P0 | **Phase:** WebGPU-Migration | **Size:** M
**Depends on:** T010

## Description

`three/addons/objects/Sky.js` ist GLSL-basiert und läuft auf `WebGPURenderer` nicht.
Ohne Sky funktionieren auch PMREM-Environment-Map und Scene-Background nicht.
Das ist der erste harte Block — alle anderen Port-Tickets bauen auf einer
funktionierenden Baseline-Szene auf.

## Scope

- `src/core/Scene.js`:
  - Sky → eine WebGPU-kompatible Lösung (Reihenfolge der Präferenz):
    1. **Pre-rendered Equirectangular Sky-Texture** (einmal mit WebGLRenderer am Boot
       rendern, als KTX2/HDR speichern, zur Laufzeit laden) — schlank, keine TSL-Portierung
    2. **TSL-Sky** aus `three/examples/jsm/nodes/` falls vorhanden
    3. **Atmospheric-Scattering in TSL** neu schreiben (letztes Mittel — zu groß für dieses Ticket)
  - PMREMGenerator: auf `WebGPURenderer` prüfen — funktioniert in Three.js seit r156+
    mit dem gleichen API
  - `scene.background` + `scene.environment` auf dem generierten EnvMap halten
- Directional + Ambient Light: funktioniert out-of-the-box (keine Änderungen nötig)
- Fog: in WebGPU/NodeMaterial ist Fog **per Material** zu konfigurieren
  (nicht mehr global `scene.fog` — das gilt nur für WebGLRenderer-Autoinjection).
  Dokumentieren: welche Materialien müssen `material.fog = true` + Fog-Uniforms ziehen?

## Entscheidung zu treffen im Ticket

- **A) Pre-rendered EnvMap-Strategie** (vorgeschlagen): einmal beim ersten Build
  eine Sky-HDR-Textur generieren und in `public/textures/sky-equirect.hdr` ablegen.
  Laufzeit: `RGBELoader` → PMREM auf beiden Renderern identisch.
  *Vorteil:* Zero-Runtime-Sky-Compile, identisches Result auf WebGL/WebGPU.
  *Nachteil:* Sun-Position nicht mehr dynamisch änderbar (reicht für uns).
- **B) TSL-Sky portieren:** falls Sun-Animation doch gewünscht wird (nicht aktuell).

## Acceptance Criteria

- [ ] Auf `?renderer=webgpu` zeigt Szene einen überzeugenden Himmel (nicht schwarz)
- [ ] `scene.environment` ist gesetzt und MeshStandardMaterial-Assets zeigen Reflexionen
- [ ] Fog auf Standard-Materialien sichtbar + identisch getunt wie auf WebGL
- [ ] Sonnenrichtung konsistent mit DirectionalLight-Position
- [ ] WebGL-Pfad unverändert (A/B-Vergleich mit Screenshot im Ticket)

## Aufwands-Risiko

- PMREMGenerator in Three.js r0.183 hat teilweise WebGPU-Edge-Cases. Falls
  Versionsupdate auf `three@^0.170` nötig ist, vorher im Ticket klären
  (`three` auf neueste patchen im Branch, alle ShaderMaterial-Deprecations checken)
