import * as THREE from 'three';

/**
 * Dual-path renderer factory.
 *
 * - Default: WebGLRenderer (proven path, mobile-safe).
 * - Opt-in via `?renderer=webgpu`: WebGPURenderer with auto-fallback to WebGL2
 *   if the adapter can't be acquired.
 *
 * Returns a Promise because WebGPURenderer.init() is async. The WebGL path
 * also returns a Promise for API symmetry (resolved immediately).
 *
 * Exposes the active path via `window.__rendererPath` for HUD/debug display.
 */
export async function createRenderer() {
  const urlParams = new URLSearchParams(location.search);
  const urlForce = urlParams.get('renderer');           // 'webgpu' | 'webgl' | null
  const hasWebGPU = !!navigator.gpu;

  // Only try WebGPU on explicit opt-in. We do NOT default to WebGPU on navigator.gpu
  // presence yet — too many assets need TSL ports first (see WEBGPU-MIGRATION-README).
  const wantsWebGPU = urlForce === 'webgpu' && hasWebGPU;

  const renderer = wantsWebGPU
    ? await _createWebGPURenderer()
    : _createWebGLRenderer();

  // Common setup (both renderers share these APIs)
  const isMob = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || navigator.maxTouchPoints > 1;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(isMob ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  document.body.appendChild(renderer.domElement);
  _attachResizeHandlers(renderer);

  return renderer;
}

async function _createWebGPURenderer() {
  // Lazy-import three/webgpu so the WebGL-default build doesn't pull in
  // ~150-300 kB of WebGPU node modules for users who never enable it.
  const webgpuModule = await import('three/webgpu');
  const { WebGPURenderer } = webgpuModule;

  const renderer = new WebGPURenderer({ antialias: true, forceWebGL: false });

  try {
    await renderer.init();
    const backend = renderer.backend?.constructor?.name || 'unknown';
    window.__rendererPath = backend.includes('WebGL') ? 'WebGPU→WebGL2' : 'WebGPU';
    console.log(`Renderer: ${window.__rendererPath} (backend: ${backend})`);
  } catch (err) {
    console.error('WebGPURenderer.init() failed, falling back to WebGL:', err);
    // Hand back a vanilla WebGL renderer as last-resort fallback
    return _createWebGLRenderer();
  }
  return renderer;
}

function _createWebGLRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  window.__rendererPath = 'WebGL2';
  return renderer;
}

function _attachResizeHandlers(renderer) {
  let resizeTimer = null;
  function doResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (window.__camera) {
      window.__camera.aspect = window.innerWidth / window.innerHeight;
      window.__camera.updateProjectionMatrix();
    }
  }

  window.addEventListener('resize', () => {
    doResize();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(doResize, 100);
    setTimeout(doResize, 300);
    setTimeout(doResize, 500);
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(doResize, 100);
    setTimeout(doResize, 300);
    setTimeout(doResize, 600);
  });
}
