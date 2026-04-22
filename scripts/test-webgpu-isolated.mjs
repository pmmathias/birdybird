// Test if three/webgpu can load in headless Chromium at all.
import { chromium } from 'playwright';

const URL_BASE = process.env.SMOKE_URL || 'http://localhost:4173/birdybird/';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--use-angle=metal',
    '--enable-webgpu-developer-features',
    '--ignore-gpu-blocklist',
  ],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE-ERR:', e.message.split('\n')[0]));
page.on('console', (m) => console.log(`[${m.type()}] ${m.text().slice(0,200)}`));

await page.goto(URL_BASE, { waitUntil: 'load' });

const gpu = await page.evaluate(async () => {
  const out = { hasGPU: !!navigator.gpu };
  if (navigator.gpu) {
    try {
      const t0 = performance.now();
      const adapter = await Promise.race([
        navigator.gpu.requestAdapter(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('adapter timeout')), 3000)),
      ]);
      out.adapterMs = Math.round(performance.now() - t0);
      out.hasAdapter = !!adapter;
      if (adapter) out.adapterInfo = adapter.info ? JSON.parse(JSON.stringify(adapter.info)) : 'no info';
    } catch (e) {
      out.adapterError = e.message;
    }
  }
  return out;
});
console.log('WebGPU adapter:', JSON.stringify(gpu, null, 2));

// Now try dynamic import of three/webgpu
const imp = await page.evaluate(async () => {
  const t0 = performance.now();
  try {
    const mod = await Promise.race([
      import('/birdybird/assets/three.webgpu-ISIDJyDa.js'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('import timeout')), 8000)),
    ]);
    return { ms: Math.round(performance.now() - t0), keys: Object.keys(mod).slice(0, 8) };
  } catch (e) {
    return { ms: Math.round(performance.now() - t0), err: e.message };
  }
});
console.log('three/webgpu import:', JSON.stringify(imp, null, 2));

await browser.close();
