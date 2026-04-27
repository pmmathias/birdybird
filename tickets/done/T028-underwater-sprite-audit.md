# T028: Underwater-Sprite Audit + Draw-Call-Konsolidierung
**Priority:** P2 | **Phase:** Perf | **Size:** S-M
**Depends on:** —

## Description

Bench-Output zeigt Draw-Call-Wachstum von 720 (air-over-land) auf
12316 (submerged). Untersuchung in `src/world/Underwater.js`:

**Aktueller Stand:**
- 6 Fish-Species × 800 Sprites = bis zu 4800 Fische
- 8 Sharks
- 5 Whales
- bis zu 4000 Coral-Sprites
- = **bis zu 9000 Sprites**, jedes als eigener Draw-Call

Three.js-Sprites werden nicht automatisch geinstanziert; jedes ist
ein eigenes Mesh. Auch wenn der Underwater-Group beim Über-Wasser-
Flug korrekt unsichtbar geschaltet wird (`group.visible = false`),
sind die Sprites beim Tauchen das Performance-Limit.

**Außerdem:** in `air-over-ocean` (alt=150, klar über Wasser) zeigt
der Bench bereits **4050 Calls** — vermutlich aus dem Mirror-Pass
des Water-Reflectors, der die Szene aus Reflektor-Camera-POV
nochmal rendert. Per-Cluster-Forest verdoppelt die Calls.

## Goal

1. **Sprite-Counts realistisch dimensionieren:** 9000 ist über-
   produziert für ein Spiel-Setting. 1500-2000 würden reichen,
   wenn sie strategisch verteilt sind.
2. **Sprite-Konsolidierung mit Points oder InstancedMesh:**
   `THREE.Points` mit eigener Material-Variante kann hunderte
   Sprite-Punkte als 1 Draw-Call rendern. Oder InstancedBufferGeometry
   mit billboard-Shader. Drastische Call-Reduktion.
3. **Reflector-Pass auditen:** ist der Mirror auch über Land aktiv?
   Wenn ja, conditional disable. Wenn nein: warum wachsen die Calls
   trotzdem über Ozean?

## Acceptance Criteria

- [ ] Submerged-Szenario: Draw-Calls < 5000 (vs. aktuell 12300).
- [ ] Air-over-ocean: Draw-Calls < 2000 (vs. aktuell 4050).
- [ ] Visuell kein Verlust — Fisch-/Korallen-Dichte bleibt
      "lebendig" wirkend.
- [ ] Falls Reflector über Land aktiv ist: deaktiviert wenn Bird-
      Altitude weit über Water Level (>30 m) und keine direkte
      Wasser-Sicht — kein FPS-Loss in Land-Szenarien.

## Notes

- Datei: `src/world/Underwater.js` (Sprites), `src/world/WaterPlane.js`
  (Reflector).
- Three.js Points mit custom shader für Billboarding: r0.184 hat
  bereits gute Sprite-Replacement-Patterns. Alternativ:
  InstancedMesh + PlaneGeometry + Sprite-shader.
- Whales/Sharks (15 Stück total) lohnen NICHT für Instancing —
  bleiben wie sie sind. Nur Fische + Korallen.
