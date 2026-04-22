# T013: CloudPlane + HousePlacer (InstancedMesh, Standard-Material)
**Priority:** P1 | **Phase:** WebGPU-Migration | **Size:** S
**Depends on:** T011

## Description

Zwei kleine Assets bündeln: Wolken (Sprite-Canvas-Texture) und Häuser
(InstancedMesh mit MeshLambertMaterial). Beide nutzen **keine** custom Shader
und sollten auf WebGPU nativ laufen — dieses Ticket verifiziert das und
fixt die zu erwartenden kleinen Unschärfen.

## Scope

- `src/world/CloudPlane.js`:
  - `CanvasTexture` + `MeshBasicMaterial` (oder `Sprite`) — funktioniert direkt.
  - Verify: Cloud-Opacity-Blending korrekt auf WebGPU (manchmal anderes Default-Blend).
- `src/world/HousePlacer.js`:
  - `InstancedMesh` mit `MeshLambertMaterial` — sollte direkt laufen.
  - Verify: `instanceMatrix` + `instanceColor` werden korrekt geladen.
- `src/world/HotelResort.js`:
  - Einzel-Meshes mit `MeshLambertMaterial` — trivial.

## Known Issue Check

- `MeshLambertMaterial` wird in Three.js auf WebGPU via `MeshLambertNodeMaterial`
  auto-konvertiert. Version prüfen — in älteren r163-r170 Builds fehlte das Auto-Mapping.

## Acceptance Criteria

- [ ] Wolken sichtbar auf WebGPU, Transparency korrekt (keine schwarzen Kanten)
- [ ] Häuser + Hotelkomplex sichtbar, Lighting plausibel
- [ ] A/B-Screenshot: side-by-side Chrome WebGPU + WebGL
- [ ] FPS-Parität ±10%
