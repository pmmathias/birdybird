# T008: Welt-Regeneration pro Biome
**Priority:** P1 | **Phase:** 3 | **Size:** M
**Depends on:** T006 (Biome-Theming)

## Description

Die Biomes (T006) tauschen aktuell nur Sky/Fog/Lights/Env + Tree-Tints.
Das Terrain selbst und die Baum-Verteilung bleiben identisch. Für den
echten "neue Welt"-Effekt regenerieren wir **pro Level-Up** die Szene
mit biome-spezifischen Parametern.

## Scope (MVP — diese Iteration)

- **Forest-Regeneration beim Level-Up:**
  - Biom-spezifische Baum-Dichte (Desert wenig, Storm dicht, usw.)
  - Biom-spezifische Baumarten-Filterung (Arctic nur Pine+Bush, Desert nur Bush)
  - Alte Forest-Instancen disposen, neue bauen
- `ForestPlacer.createForest()` nimmt optionale `biome.forest`-Parameter
- `WorldBuilder.buildWorld()` gibt eine `regenerateForest(options)`-Methode zurück
- `Biomes.js` bekommt pro Biom ein `forest: { density, types }` Feld
- Level-Up-Hook in `main.js` ruft regen auf

## Nicht-Scope (spätere Iterationen)

- **Terrain-Geometry-Regen** — andere Parabel-Parameter, seed-basiert: separate Ticket
- **Texture-Regen** — Schnee-Textur für Arctic, Sand für Desert: separate Ticket
- **Landmarks pro Biome** (Leuchtturm, Tempel, Vulkan): separate Ticket
- **House-Regen**: Houses bleiben erstmal gleich

Diese Dinge sind der nächste Schritt nach diesem Ticket.

## Acceptance Criteria

- [ ] Beim Level-Up regeneriert sich der Forest mit den Biom-Parametern
- [ ] Desert: sichtbar weniger Vegetation
- [ ] Stormy Dusk: dichte dunkle Baumwolken
- [ ] Keine Memory-Leaks (alte Meshes und Materialien disposed)
- [ ] Level-Up-Transition bleibt smooth (Regen während Flash-Peak)
- [ ] Kein FPS-Einbruch während des Rebuilds
