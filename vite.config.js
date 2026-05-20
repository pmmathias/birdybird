import { defineConfig } from 'vite';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Lightweight, dependency-free PWA: after the production build, walk the
// output dir, precache every shipped file, and emit a hand-written service
// worker (pwa/sw-template.js). We do this instead of vite-plugin-pwa because
// its Workbox dependency needs Node 20+ (tracingChannel), and we're on Node 18.
function offlinePWA({ base, outDir }) {
  const skip = new Set(['sw.js', 'tilt-test.html', 'iframe-test.html']);
  return {
    name: 'offline-pwa',
    apply: 'build',
    closeBundle() {
      const root = fileURLToPath(new URL('.', import.meta.url));
      const dist = join(root, outDir);

      const files = [];
      const walk = (dir) => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          if (statSync(full).isDirectory()) walk(full);
          else files.push(full);
        }
      };
      walk(dist);

      const hash = createHash('sha256');
      const precache = [];
      for (const file of files.sort()) {
        const rel = relative(dist, file).split(sep).join('/');
        if (skip.has(rel) || rel.endsWith('.map')) continue;
        precache.push(base + rel);
        hash.update(readFileSync(file));
      }

      const cacheName = 'birdybird-' + hash.digest('hex').slice(0, 8);
      const template = readFileSync(join(root, 'pwa/sw-template.js'), 'utf8');
      const sw = template
        .replace('__CACHE_NAME__', cacheName)
        .replace('__PRECACHE__', JSON.stringify(precache))
        .replace('__INDEX_URL__', base + 'index.html');
      writeFileSync(join(dist, 'sw.js'), sw);

      // eslint-disable-next-line no-console
      console.log(
        `\n[offline-pwa] sw.js written — ${precache.length} files precached (${cacheName})`
      );
    },
  };
}

const BASE = '/birdybird/';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: BASE,
  plugins: [offlinePWA({ base: BASE, outDir: 'dist' })],
  build: {
    outDir: 'dist',
    // Top-level await needed for WebGPURenderer.init() in src/main.js.
    // es2022 targets Chrome 91+/Safari 15+/Firefox 89+ — matches our mobile support.
    target: 'es2022',
  },
  server: {
    open: true,
    host: '0.0.0.0',
  },
});
