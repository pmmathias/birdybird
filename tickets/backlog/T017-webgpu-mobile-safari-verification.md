# T017: Mobile-Safari WebGPU-Verifikation + Auto-Fallback
**Priority:** P0 | **Phase:** WebGPU-Migration | **Size:** M
**Depends on:** T010-T015

## Description

birdybird ist **Mobile-First**. WebGPU macht auf Desktop nur Sinn, wenn iOS
Safari mitzieht. Stand 2026-04:

- iOS 18.2+ Safari: WebGPU stable (WebKit-Flag seit 2024, Standard ab 18.2)
- Android Chrome: WebGPU stable seit 121
- Fallback-Gruppe: ältere iOS / Firefox / manche Tablets → brauchen WebGL2

Dieses Ticket verifiziert den Mobile-Pfad auf **echten Geräten** (Playwright
kann WebGPU in WebKit-Device-Emulation derzeit nicht zuverlässig simulieren —
siehe `scripts/mobile-debug.mjs` Limitierung).

## Scope

- `src/core/Renderer.js` Feature-Detect-Logik final:
  ```js
  const urlForce = urlParams.get('renderer');           // 'webgpu' | 'webgl' | null
  const hasGPU   = !!navigator.gpu;
  const adapter  = hasGPU ? await navigator.gpu.requestAdapter() : null;
  const canWebGPU = !!adapter && urlForce !== 'webgl';
  const useWebGPU = canWebGPU && (urlForce === 'webgpu' || AUTO_PREFER_WEBGPU);
  ```
- `AUTO_PREFER_WEBGPU`: Konstante — anfangs `false` (WebGPU opt-in bleiben),
  später in T018 Entscheidung zum Flip treffen
- Real-Device-Test-Matrix:
  - iPhone 14 / iOS 18.2+
  - iPhone 13 / iOS 17 (soll auf WebGL fallen)
  - Pixel 8 / Chrome 121+
  - iPad Air / iPadOS 18
  - Safari macOS 18
  - Chrome macOS stable
- `scripts/mobile-debug.mjs` erweitern: Renderer-Pfad + `adapter.info`
  in Diagnose-Output aufnehmen
- Dokumentiere Min-Versionen in der Top-Bar-Anzeige + in CLAUDE.md

## Acceptance Criteria

- [ ] iPhone 14 mit iOS 18.2+ zeigt vollständige WebGPU-Szene (alle T011-T015 Assets)
- [ ] iPhone 13 mit iOS 17 fällt sauber auf WebGL zurück, keine Console-Errors
- [ ] Pixel 8 Chrome ≥121 zeigt WebGPU
- [ ] Android WebView / Firefox / Legacy-Geräte: WebGL-Fallback unverändert
- [ ] `navigator.gpu.requestAdapter()` Timeouts sind mit 2s-Promise abgesichert
- [ ] Error-Ticker auf Real-Device: leer nach 60s Flug

## Deliverable

Mobile-Test-Matrix als Tabelle im Ticket-Abschluss:
`Gerät · OS-Version · Pfad · FPS · Console-Errors · Screenshot-Link`
