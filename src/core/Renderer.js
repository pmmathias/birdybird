import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

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

  // WebGPU is now the default path (Phil Crowther's Ocean4 iFFT + TSL forest
  // port land all the visible visual upgrades there). Falls back to WebGL2
  // automatically if navigator.gpu is missing or WebGPURenderer.init() fails
  // (older mobile Safari, locked-down browsers). Force either path with
  // `?renderer=webgpu` or `?renderer=webgl`.
  const wantsWebGPU = urlForce === 'webgpu' || (urlForce !== 'webgl' && hasWebGPU);

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
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL: false });
  try {
    await renderer.init();
    const backend = renderer.backend?.constructor?.name || 'unknown';
    window.__rendererPath = backend.includes('WebGL') ? 'WebGPU→WebGL2' : 'WebGPU';
    console.log(`Renderer: ${window.__rendererPath}`);
  } catch (err) {
    console.error('WebGPURenderer.init() failed, falling back to WebGL:', err);
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
