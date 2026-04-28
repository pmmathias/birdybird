import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = 'http://localhost:5173/birdybird/?skipcalib=1&renderer=webgl&game=free&seed=42';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__scene?.getObjectByName('rr-forest'), null, { timeout: 60000 });
await page.waitForTimeout(1500);

// Find a stack-cone conifer instance to point the camera at.
const target = await page.evaluate(() => {
  const scene = window.__scene;
  const conifers = scene.getObjectByName('conifer-forest');
  if (!conifers) return { error: 'no conifers' };
  // Find any InstancedMesh under the conifer-forest group
  let mesh = null;
  conifers.traverse((o) => { if (!mesh && o.isInstancedMesh && o.count > 0) mesh = o; });
  if (!mesh) return { error: 'no conifer instances' };
  const arr = mesh.instanceMatrix.array;
  const i = Math.floor(mesh.count / 2);
  return {
    best: { x: arr[i*16+12], y: arr[i*16+13], z: arr[i*16+14] },
    count: mesh.count,
    name: mesh.name,
  };
});
console.log('target:', JSON.stringify(target));

if (!target.best) {
  console.log('no high-altitude conifer found');
  await browser.close();
  process.exit(1);
}

const { x, y, z } = target.best;
await page.evaluate(({ x, y, z }) => {
  if (window.__cameraRig) window.__cameraRig.update = () => {};
  const cam = window.__camera;
  cam.position.set(x + 35, y + 18, z + 35);
  cam.lookAt(x, y + 6, z);
  cam.fov = 45;
  cam.updateProjectionMatrix();
  window.__renderer.render(window.__scene, cam);
}, { x, y, z });
await page.waitForTimeout(600);
const png1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('/tmp/conifer-shot.png', Buffer.from(png1.data, 'base64'));
console.log('wrote /tmp/conifer-shot.png');

await page.evaluate(({ x, y, z }) => {
  const cam = window.__camera;
  cam.position.set(x + 18, y + 9, z + 18);
  cam.lookAt(x, y + 5, z);
  cam.fov = 35;
  cam.updateProjectionMatrix();
  window.__renderer.render(window.__scene, cam);
}, { x, y, z });
await page.waitForTimeout(600);
const png2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('/tmp/conifer-closeup.png', Buffer.from(png2.data, 'base64'));
console.log('wrote /tmp/conifer-closeup.png');

await browser.close();
