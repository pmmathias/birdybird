# T016: Ocean3 iFFT — Lizenz-Klärung + Renderer-Strategie
**Priority:** P2 | **Phase:** WebGPU-Migration | **Size:** S (nur Analyse + kleine Code-Änderung)
**Depends on:** T010, T015

## Description

`src/vendor/Ocean3.js` ist Phil Crowthers iFFT-Ozean unter **CC BY-NC-SA 3.0**.
Auf WebGPU müsste der Code nach WGSL/TSL portiert werden — das ist eine
Derivative-Work, die unter ShareAlike *wiederum* unter CC BY-NC-SA stehen müsste
und nicht Teil eines kommerziell gedachten Produkts sein darf.

Auch wenn birdybird aktuell nicht kommerziell ist, ist CC BY-NC-SA im Code
eine langfristige Einschränkung. Für WebGPU bedeutet das konkret:

- **Option A (empfohlen):** Ocean3 bleibt WebGL2-exklusiv.
  Auf WebGPU-Pfad fällt das Wasser immer auf Gerstner (T015) zurück.
  In der Top-Bar wird das ausgezeichnet (`__waterPath = 'Gerstner (WebGPU)'`).
- **Option B:** Phil kontaktieren, ob ein Relicensing unter MIT/CC0 für die
  WebGPU-Portierung möglich ist. Falls ja → T015 ausbauen um iFFT-WGSL-Port
  (aber dann eigenes großes Ticket).
- **Option C:** Eigenes iFFT-from-scratch in WGSL schreiben. Sehr aufwendig,
  Kreditierung kann entfallen, aber ~1-2 Wochen Aufwand.

## Scope für dieses Ticket

- **Nur Option A umsetzen:**
  - `src/world/WaterPlane.js` Feature-Detect erweitern:
    - Wenn `renderer.isWebGPURenderer` → skip iFFT-Pfad, direkt Gerstner
  - Konsolenlog anpassen (`Water: iFFT on WebGL2 / Gerstner on WebGPU`)
  - Top-Bar-Indikator entsprechend
- **Option B/C nur dokumentieren**, nicht umsetzen.

## Acceptance Criteria

- [ ] WebGPU-Renderer benutzt **niemals** Ocean3
- [ ] WebGL2-Renderer-Pfad mit iFFT-Support bleibt unverändert
- [ ] Top-Bar zeigt aktuellen Water-Pfad korrekt an
- [ ] Kein Ocean3-Code-Path-Crash bei WebGPU-Boot

## Follow-ups (separate Tickets, falls gewünscht)

- **T007 (existiert bereits in Backlog)** — Phil Crowther hat ein
  **eigenes WebGPU-Ocean-Modul** (`sdem_ocean4_gpu.html` Fragment-Variante).
  Falls dieses unter einer offenen Lizenz steht, ist das der bevorzugte Weg
  statt eines Ocean3-Ports. T007 klärt das separat und kann parallel zu
  T016 laufen.
- Phil anfragen → MIT/CC0-Relicensing von Ocean3 (falls T007-Modul inkompatibel)
- Eigenes iFFT in WGSL (from scratch, letztes Mittel)
