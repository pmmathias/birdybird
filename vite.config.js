import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/birdybird/',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
    host: '0.0.0.0',
  },
});
