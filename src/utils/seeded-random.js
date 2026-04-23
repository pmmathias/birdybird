// Mulberry32 — fast, good-enough PRNG for content generation.
// 32-bit integer seed in, uniform [0, 1) float out. Deterministic: same
// seed → same sequence forever.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Install a seeded Math.random globally until `restore` is called.
 * Used to make world generation reproducible across sessions/browsers.
 * Gameplay code running AFTER restore still gets the native unseeded
 * Math.random (boid jitter, particle effects, etc. stay varied).
 *
 *   const restore = installSeededRandom(42);
 *   // ... world-building code runs with seeded randomness ...
 *   restore();
 */
export function installSeededRandom(seed) {
  const original = Math.random;
  Math.random = mulberry32(seed);
  return () => { Math.random = original; };
}
