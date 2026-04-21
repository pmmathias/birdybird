// Forest FPS benchmark — runs birdybird headless at several tree counts,
// starts the autopilot, measures avg FPS + draw-call count over a fixed window.
//
// Usage:
//   node scripts/forest-bench.mjs [baseUrl]
// Optional env:
//   BENCH_COUNTS=1000,2000,3000 node scripts/forest-bench.mjs
//   BENCH_SAMPLE_MS=10000       (default 8000ms measurement window)
//   BENCH_UA=mobile              (simulates an iPhone UA)

import { chromium, devices } from 'playwright';

const baseURL = process.argv[2] || 'http://localhost:4173/birdybird/';
const counts = (process.env.BENCH_COUNTS || '1500,2500,3500,5000,7500,10000')
  .split(',').map((x) => parseInt(x.trim(), 10)).filter(Boolean);
const sampleMs = parseInt(process.env.BENCH_SAMPLE_MS || '8000', 10);
const useMobileUA = process.env.BENCH_UA === 'mobile';

const contextOptions = useMobileUA
  ? { ...devices['iPhone 13'], isMobile: false } // keep desktop renderer path
  : {
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Safari/537.36',
    };

// Chromium headless uses SwiftShader (software GL) by default on macOS.
// Launching with --use-angle=metal gives us a real Metal-backed GPU path —
// required to get meaningful FPS numbers, not CPU-bound nonsense.
const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--use-angle=metal',
    '--use-gl=angle',
    '--enable-features=Vulkan',
    '--ignore-gpu-blocklist',
  ],
});
const ctx = await browser.newContext(contextOptions);
const page = await ctx.newPage();

page.on('pageerror', (e) => console.error('  PAGEERROR:', e.message));

const results = [];

for (const count of counts) {
  const url = `${baseURL}?trees=${count}&game=free&skipcalib=1`;
  console.log(`\n→ ${count} trees`);
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(4000); // let scene settle + L-system generation finish

  const info = await page.evaluate(() => {
    const scene = window.__scene;
    const rr = scene.getObjectByName('rr-forest');
    let branches = 0, leaves = 0;
    if (rr) rr.traverse((o) => {
      if (o.isInstancedMesh) {
        if (o.material?.uniforms?.barkTexture) branches += o.count;
        else if (o.material?.uniforms?.leafTexture) leaves += o.count;
      }
    });
    return { branches, leaves };
  });
  console.log(`  branches=${info.branches}, leaves=${info.leaves}`);

  // Kick autopilot so camera actually moves
  await page.evaluate(() => { if (window.__startAutopilot) window.__startAutopilot(); });
  await page.waitForTimeout(500);

  // Sample FPS via requestAnimationFrame count
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
          calls += info.calls;
          tris += info.triangles;
        }
        if (performance.now() - startT < ms) {
          requestAnimationFrame(tick);
        } else {
          resolve({
            elapsed: performance.now() - startT,
            frames,
            avgCalls: calls / frames,
            avgTris: tris / frames,
          });
        }
      };
      requestAnimationFrame(tick);
    });
  }, sampleMs);

  const fps = (fpsInfo.frames / (fpsInfo.elapsed / 1000));
  console.log(`  FPS avg = ${fps.toFixed(1)}   draw-calls = ${fpsInfo.avgCalls.toFixed(0)}   tris = ${(fpsInfo.avgTris / 1000).toFixed(0)}k`);
  results.push({
    trees: count,
    branches: info.branches,
    leaves: info.leaves,
    fps: +fps.toFixed(1),
    drawCalls: +fpsInfo.avgCalls.toFixed(0),
    trianglesK: +(fpsInfo.avgTris / 1000).toFixed(0),
  });
}

await browser.close();

console.log('\n== Summary ==');
console.log('trees\tFPS\tcalls\ttris(k)\tbranches\tleaves');
for (const r of results) {
  console.log(`${r.trees}\t${r.fps}\t${r.drawCalls}\t${r.trianglesK}\t${r.branches}\t${r.leaves}`);
}
