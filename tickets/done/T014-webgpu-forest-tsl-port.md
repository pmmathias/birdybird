# T014: RedReddington Forest → TSL Port (das große Ticket)
**Priority:** P0 | **Phase:** WebGPU-Migration | **Size:** L
**Depends on:** T011

## Description

`src/vendor/RedReddingtonForest.js` ist das visuell prägendste Asset und
gleichzeitig das komplexeste Shader-Konstrukt im Projekt:

- 2× eigene RawShaderMaterial (bark + leaves) mit GLSL3-Code
- `InstancedMesh` mit **zusätzlichen** Instance-Attributen:
  - `instanceMatrix` (Three.js-Standard)
  - `instanceColorAttr` (per-vertex HSL-Jitter)
  - `instanceTreeBaseY` (pro Branch die Root-Y-Koordinate, damit Root-Spread
    auf Terrain korrekt funktioniert)
- Vertex-Shader-LOD-Cull via `gl_Position = vec4(2,2,2,1)` (NDC-clip)
- Wind-Sway via `time`-Uniform
- Root-Spread: lokaler Y-Offset wird je Branch berechnet

## Scope

- **Neuer Port** in `src/vendor/RedReddingtonForestNode.js`:
  - Gleiche L-System-CPU-Logik (Branch/Leaf-Generation, Seeded-Random) — 1:1 übernommen
  - Rendering-Teil neu: `MeshBasicNodeMaterial` oder `StandardNodeMaterial`
    mit `.positionNode` + `.colorNode` + `.vertexNode`
  - Instance-Attribute: `instancedBufferAttribute()` / `storage()` Nodes
  - LOD-Cull: `If(distance.greaterThan(LOD_MAX), vec4(2,2,2,1)).Else(normalGL_Position)`
- Precision-Hinweis: WebGPU hat nur f32 (keine `highp`/`mediump`-Unterscheidung),
  also fallen die iOS-Precision-Hacks aus T009 weg.
- Attribution-Header bleibt erhalten (MIT + CodePen-Link)
- `src/world/WorldBuilder.js` wählt je nach Renderer-Backend

## Risiken

- **TSL-Instance-Attribute-Support ist noch jung** — evtl. nötig,
  eigene `BufferAttribute`-Registrierung via `BatchedMesh` zu verwenden
  oder direkt WGSL-Compute-Nodes.
- Wenn TSL an seine Grenzen kommt: Fallback-Option ist
  **`WebGPURenderer.forceWebGL = true`** (dann verwendet WebGPU-Renderer
  intern WebGL2 — damit läuft der bestehende GLSL-Code weiter,
  aber wir verlieren den WebGPU-Performance-Vorteil).
- Zweitoption: Forest bleibt auf WebGL-Pfad exklusiv, WebGPU ohne Forest oder
  mit einfachem InstancedMesh-Dummytree — inakzeptabel für V1.

## Acceptance Criteria

- [ ] Forest sichtbar auf WebGPU mit Cluster-Struktur wie auf WebGL
- [ ] Wind-Sway animiert
- [ ] Root-Spread korrekt auf Hang-Terrain (keine schwebenden Stämme)
- [ ] LOD-Cull greift — FPS bei 2000 Bäumen ≥ 85% des WebGL-Werts
- [ ] HSL-Color-Jitter sichtbar (nicht alle Bäume identisch gefärbt)
- [ ] Bark- + Leaf-Texture korrekt
- [ ] Kein Flackern / Z-Fighting

## Fallback-Plan (wenn Port zu aufwendig wird)

Dokumentieren im Ticket-Abschluss: `WebGPURenderer` mit `forceWebGL=true`
als Übergangslösung; separates Follow-up-Ticket für nativen WebGPU-Forest.
