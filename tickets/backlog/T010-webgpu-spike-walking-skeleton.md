# T010: WebGPU-Spike — Walking Skeleton auf `webgpu-port` Branch
**Priority:** P0 | **Phase:** WebGPU-Migration | **Size:** S
**Depends on:** —
**Branch:** `webgpu-port` (niemals in `main` mergen ohne T018 Benchmark)

## Description

Minimaler Proof-of-Life: `WebGPURenderer` anstelle von `WebGLRenderer` einsetzen,
aber **opt-in via URL-Param** (`?renderer=webgpu`), Default bleibt WebGL.
Ziel ist nicht, alles sofort lauffähig zu bekommen — sondern zu sehen,
*was genau* kaputt geht, damit die Folge-Tickets gezielt adressieren können.

## Scope

- `src/core/Renderer.js`:
  - Feature-Detect: `navigator.gpu` + `?renderer=webgpu` → `WebGPURenderer`
  - Sonst: bestehender `WebGLRenderer` (unverändert)
  - `WebGPURenderer` hat **async** `init()` — das bricht den aktuellen synchronen
    Boot-Flow in `main.js`. Export wird `async function createRenderer()`.
- `src/main.js`: Boot wird async (top-level await ist in Vite-ESM-Bundles OK)
- Neue Topbar-Anzeige: Renderer-Pfad sichtbar machen (analog zu `__waterPath`)
- Keine Shader-Ports — erwarte schwarze/weiße Flächen bei ShaderMaterial-basierten Assets

## Erwartetes Verhalten nach T010

- **Funktioniert (nativ in WebGPU via NodeMaterial-Auto-Konvertierung):**
  - Klare Szene, Kamera, OrbitControls
  - Directional + Ambient Light
  - MeshStandardMaterial-Assets (Vogel-Model, Nest, Ringe, Würmer, Häuser)
- **Vermutlich kaputt:**
  - `Sky` addon (eigene ShaderMaterial)
  - `TerrainShader` (custom ShaderMaterial)
  - `RedReddingtonForest` (custom ShaderMaterial)
  - `Water` addon + Ocean3 iFFT
  - `CloudPlane` (evtl. OK wenn reine Sprite-Textur, hängt von Material ab)
  - PMREM environment map (muss separat auf WebGPU portiert werden)

## Acceptance Criteria

- [ ] `?renderer=webgpu` in Chrome Desktop lädt ohne JS-Crash
- [ ] `?renderer=webgl` (oder ohne Param) rendert exakt wie vor dem Branch
- [ ] Console-Errors beim WebGPU-Pfad sind inventarisiert (Liste im Ticket-Abschluss)
- [ ] Vogel-Model + Chase-Cam sichtbar und steuerbar auf WebGPU-Pfad
- [ ] Mobile-Touch/Gyro-Path bleibt unberührt
- [ ] Bundle-Size-Delta ≤ 150 kB (Three.js WebGPU-Module ziehen Extra-Code rein)

## Deliverables

1. Commit mit dem Dual-Renderer-Switch
2. Screenshot/Video der beiden Pfade
3. Error-Liste im Ticket-Abschluss: pro kaputtem Asset eine Zeile
   `<asset>: <Symptom> → geplantes Follow-up-Ticket Txxx`
