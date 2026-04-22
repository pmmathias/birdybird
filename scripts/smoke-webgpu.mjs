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
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.log('GOTO-FAIL:', e.message.split('\n')[0]);
  }
  await page.waitForTimeout(10000);

  const diag = await page.evaluate(() => {
    const r = window.__renderer;
    const s = window.__scene;
    const rr = s?.getObjectByName?.('rr-forest');
    let barkCount = 0, leafCount = 0, forestVisible = 'no';
    if (rr) {
      forestVisible = rr.visible ? 'yes' : 'no';
      rr.traverse((o) => {
        if (o.isInstancedMesh) {
          if (o.name?.includes('bark') || o.geometry?.type?.includes('Cylinder')) barkCount += o.count;
          else leafCount += o.count;
        }
      });
    }
    return {
      path: window.__rendererPath || 'undefined',
      waterPath: window.__waterPath || 'undefined',
      isWebGPU: !!r?.isWebGPURenderer,
      sceneChildren: s?.children?.length ?? 'undefined',
      canvas: r?.domElement ? `${r.domElement.width}x${r.domElement.height}` : 'undefined',
      forest: { visible: forestVisible, bark: barkCount, leaves: leafCount },
    };
  });
  console.log('DIAG:', JSON.stringify(diag));
  await page.screenshot({ path: `/tmp/smoke-${label}.png` });

  // Second screenshot: teleport camera near a tree to verify forest rendering
  const spot = await page.evaluate(() => {
    const s = window.__scene;
    const r = window.__renderer;
    const cam = window.__camera;
    if (window.__cameraRig) window.__cameraRig.update = () => {};
    const rr = s?.getObjectByName?.('rr-forest');
    let found = null;
    if (rr) rr.traverse((o) => {
      if (found || !o.isInstancedMesh || o.count === 0) return;
      const m = o.instanceMatrix.array;
      found = { x: m[12], y: m[13], z: m[14] };
    });
    if (!found) return null;
    cam.position.set(found.x + 30, found.y + 20, found.z + 30);
    cam.lookAt(found.x, found.y + 8, found.z);
    cam.fov = 55;
    cam.near = 0.5;
    cam.updateProjectionMatrix();
    r.render(s, cam);
    return found;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `/tmp/smoke-${label}-tree.png` });
  console.log(`tree spot: ${spot ? JSON.stringify(spot) : 'NONE'}`);

  if (errors.length) {
    console.log(`errors=${errors.length}`);
    for (const e of errors.slice(0, 8)) console.log('  ', e);
  } else {
    console.log('(no errors)');
  }
  await browser.close();
}

await test('', 'webgl-default');
await test('?renderer=webgpu', 'webgpu-optin');
