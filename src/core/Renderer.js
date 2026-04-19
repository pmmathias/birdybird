import * as THREE from 'three';

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Lower pixel ratio on mobile for performance
  const isMob = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  renderer.setPixelRatio(isMob ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);

  // Resize handler — debounced + delayed for iOS Safari rotation
  let resizeTimer = null;
  function doResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Also update any camera that's stored globally
    if (window.__camera) {
      window.__camera.aspect = window.innerWidth / window.innerHeight;
      window.__camera.updateProjectionMatrix();
    }
  }

  window.addEventListener('resize', () => {
    // Immediate resize
    doResize();
    // Delayed resize — iOS Safari needs time after rotation
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(doResize, 100);
    // Extra delayed — catches slow Safari transitions
    setTimeout(doResize, 300);
    setTimeout(doResize, 500);
  });

  // Also listen for orientation change (iOS specific)
  window.addEventListener('orientationchange', () => {
    setTimeout(doResize, 100);
    setTimeout(doResize, 300);
    setTimeout(doResize, 600);
  });

  return renderer;
}
