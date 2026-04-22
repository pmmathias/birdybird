# T019: Sekundäre ShaderMaterials — Biomes, Underwater, Landmarks
**Priority:** P1 | **Phase:** WebGPU-Migration | **Size:** S-M
**Depends on:** T011

## Description

Nach den großen Port-Tickets (Terrain/Forest/Water) gibt es noch eine
Handvoll kleinere eigene ShaderMaterial-Instanzen, die auf WebGPU sonst
schwarz bleiben:

- `src/world/Biomes.js` — biome-spezifische Material-Overrides
  (z.B. Ice-Shader für Iceberg, Sand-Glitter, Lava-Emissive)
- `src/world/Underwater.js` — Caustic-Shader, Fish-Schwarm-Material
- `src/world/Landmarks.js` — Lighthouse-Glass, Pyramid-Gold
- `src/world/FishCatcher.js` / `WaterSpray.js` — Particle-Materials

## Scope

Pro Datei inventarisieren:
- Enthält `ShaderMaterial` / `RawShaderMaterial`? → TSL-Port nötig
- Enthält nur Standard-Materials? → T013-Muster, Verify + Check
- Enthält Points/Sprites? → Eigener TSL-PointsNodeMaterial-Port

Pattern fürs Porting orientiert sich an T012 (Terrain).

## Acceptance Criteria

- [ ] Alle Biomes (Sunny Islands, Desert, Ice, Volcanic, Forest) rendern
  visuell plausibel auf WebGPU
- [ ] Underwater-Szene (Desktop) funktioniert
- [ ] Landmarks je Biome sichtbar
- [ ] FishCatcher + WaterSpray Partikel sichtbar

## Notes

Dieses Ticket ist bewusst als Sammelticket angelegt — falls eine der
Einzelbaustellen zu groß wird, splitten in T019a/T019b/etc.
