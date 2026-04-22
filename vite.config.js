import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/birdybird/',
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
