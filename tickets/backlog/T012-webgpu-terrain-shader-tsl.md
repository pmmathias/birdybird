# T012: TerrainShader → TSL/NodeMaterial-Port
**Priority:** P0 | **Phase:** WebGPU-Migration | **Size:** M
**Depends on:** T011

## Description

`src/world/TerrainShader.js` ist eine GLSL-ShaderMaterial mit Height-basiertem
Texture-Blending (Sand → Grass/Forest → Rock → Snow), Sun-Shading + Fog.
Komplett eigene vertex/fragment-Pässe — muss nach TSL/NodeMaterial portiert werden,
sonst bleibt das Terrain auf WebGPU schwarz.

## Scope

- Neue Datei: `src/world/TerrainShaderNode.js`
  - Baut die gleiche Logik mit TSL (`@three/tsl`):
    `MeshStandardNodeMaterial` + `.colorNode`, `.normalNode`
  - 6 Texture-Slots bleiben gleich (`sandTex`, `grassTex`, `rockTex`, `snowTex`,
    `forestTex`, `gravelTex`)
  - Uniform-Mapping: `waterLevel`, `sandEnd`, `grassEnd`, `rockEnd`,
    `sunDirection`, `fogColor`, `fogNear`, `fogFar` → TSL `uniform()`-Nodes
  - Slope-Berechnung (Normal.y) bleibt identisch
- `src/world/TerrainShader.js` bleibt erhalten (WebGL-Pfad)
- `src/world/WorldBuilder.js`:
  - Renderer-Capability erkennen (`renderer.isWebGPURenderer` oder
    Check via Constructor-Name)
  - Entsprechend `createTerrainMaterial` oder `createTerrainNodeMaterial` laden
- A/B-Check: `?renderer=webgpu` und `?renderer=webgl` produzieren
  visuell identische Höhenblending-Grenzen (±5% Toleranz in Pixel-Farben ist OK)

## TSL-Kern-Patterns für dieses Ticket

```js
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  positionWorld, normalWorld, uv, texture, uniform, mix, smoothstep, Fn,
} from 'three/tsl';

const heightBlend = Fn(() => {
  const h = positionWorld.y;
  const sandMask  = smoothstep(uniforms.waterLevel, uniforms.sandEnd, h);
  const grassMask = smoothstep(uniforms.sandEnd,   uniforms.grassEnd, h);
  // ...
});
```

## Acceptance Criteria

- [ ] Terrain rendert auf WebGPU mit sichtbaren 4 Zonen (Sand → Grass → Rock → Snow)
- [ ] Slope-gesteuerter Fels-Übergang (steile Hänge = rock statt grass)
  reagiert wie auf WebGL
- [ ] Fog-Pfad stimmt mit T011-Entscheidung überein
- [ ] A/B-Screenshot beider Pfade vom gleichen Kamerapunkt aus
- [ ] Performance-Messung: FPS auf WebGPU ≥ 90% des WebGL-Werts an 3 Testpunkten
