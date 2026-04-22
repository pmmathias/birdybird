// FPS + draw-call benchmark comparing WebGL vs. WebGPU renderer paths
// against the local preview server.
//
// Usage:
//   npm run preview &   # start on :4173 (default)
//   node scripts/bench-renderers.mjs
import { chromium } from 'playwright';

const URL_BASE = process.env.BENCH_URL || 'http://localhost:4173/birdybird/';
const SAMPLE_MS = parseInt(process.env.BENCH_SAMPLE_MS || '8000', 10);

async function bench(urlParam, label) {
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const url = URL_BASE + urlParam + (urlParam.includes('?') ? '&' : '?') + 'skipcalib=1';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000); // let scene settle + forest build

  // Start autopilot so camera moves
  await page.evaluate(() => { if (window.__startAutopilot) window.__startAutopilot(); });
  await page.waitForTimeout(800);

  const fpsInfo = await page.evaluate(async (ms) => {
    return new Promise((resolve) => {
      let frames = 0;
      let calls = 0;
      let tris = 0;
      const startT = performance.now();
      const tick = () => {
        frames++;
        const info = window.__renderer?.info?.render;
        if (info) {
          calls += info.calls || 0;
          tris += info.triangles || 0;
        }
        if (performance.now() - startT < ms) {
          requestAnimationFrame(tick);
        } else {
          resolve({
            elapsed: performance.now() - startT,
            frames,
            avgCalls: calls / frames,
            avgTris: tris / frames,
            path: window.__rendererPath,
          });
        }
      };
      requestAnimationFrame(tick);
    });
  }, SAMPLE_MS);
  const fps = fpsInfo.frames / (fpsInfo.elapsed / 1000);

  console.log(`${label.padEnd(16)}\t${fpsInfo.path?.padEnd(10)}\tFPS=${fps.toFixed(1)}\tcalls=${fpsInfo.avgCalls.toFixed(0)}\ttris=${(fpsInfo.avgTris / 1000).toFixed(0)}k`);
  await browser.close();
  return { label, path: fpsInfo.path, fps: +fps.toFixed(1), calls: +fpsInfo.avgCalls.toFixed(0), trisK: +(fpsInfo.avgTris / 1000).toFixed(0) };
}

console.log(`\n${'label'.padEnd(16)}\t${'path'.padEnd(10)}\tFPS\tcalls\ttris(k)`);
console.log('-'.repeat(80));
const results = [];
results.push(await bench('', 'webgl-default'));
results.push(await bench('?renderer=webgpu', 'webgpu-optin'));

console.log('\n== Summary ==');
for (const r of results) console.log(`  ${r.label}: ${r.path} ${r.fps} FPS, ${r.calls} calls, ${r.trisK}k tris`);
