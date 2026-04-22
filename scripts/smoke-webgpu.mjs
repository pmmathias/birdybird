// Smoke test both renderer paths against the local preview server.
import { chromium } from 'playwright';

const URL_BASE = process.env.SMOKE_URL || 'http://localhost:4173/birdybird/';

async function test(urlParam, label) {
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
  const messages = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGE: ${e.message.split('\n').slice(0, 3).join(' | ')}`));
  page.on('console', (m) => {
    const t = m.type();
    const text = m.text();
    messages.push(`[${t}] ${text.slice(0, 400)}`);
    if (t === 'error') errors.push(`CERR: ${text.slice(0, 400)}`);
  });
  page.on('requestfailed', (r) => errors.push(`REQ: ${r.url()}`));
  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (ev) => {
      console.error('UNHANDLED: ' + (ev.reason?.stack || ev.reason?.message || String(ev.reason)));
    });
    window.addEventListener('error', (ev) => {
      console.error('WINDOW-ERR: ' + ev.message + ' @ ' + ev.filename + ':' + ev.lineno);
    });
  });

  const url = URL_BASE + urlParam + (urlParam.includes('?') ? '&' : '?') + 'skipcalib=1';
  console.log(`\n=== ${label}: ${url} ===`);

  // Use domcontentloaded instead of load — TLA in main.js means the load event
  // fires after top-level awaits resolve, so using 'load' can time out even on
  // a working page if something upstream is slow.
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.log('GOTO-FAIL:', e.message.split('\n')[0]);
  }
  await page.waitForTimeout(15000);

  const diag = await page.evaluate(() => {
    const r = window.__renderer;
    const s = window.__scene;
    return {
      path: window.__rendererPath || 'undefined',
      waterPath: window.__waterPath || 'undefined',
      rendererCtor: r?.constructor?.name || 'undefined',
      isWebGPU: !!r?.isWebGPURenderer,
      sceneChildren: s?.children?.length ?? 'undefined',
      canvas: r?.domElement ? `${r.domElement.width}x${r.domElement.height}` : 'undefined',
    };
  });
  console.log('DIAG:', JSON.stringify(diag));
  await page.screenshot({ path: `/tmp/smoke-${label}.png` });
  if (errors.length) {
    console.log(`errors=${errors.length}`);
    for (const e of errors.slice(0, 8)) console.log('  ', e);
  } else {
    console.log('(no errors)');
  }
  console.log(`--- console (${messages.length} msgs, last 14) ---`);
  for (const m of messages.slice(-14)) console.log('  ' + m);
  await browser.close();
}

await test('', 'webgl-default');
await test('?renderer=webgpu', 'webgpu-optin');
