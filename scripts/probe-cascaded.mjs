import { chromium } from 'playwright';
const URL = 'http://localhost:5173/birdybird/?renderer=webgpu&ocean=cascaded&skipcalib=1';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu','--use-angle=metal','--enable-webgpu-developer-features','--ignore-gpu-blocklist'] });
const p = await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();
p.on('console', m => { if (m.type()==='error') console.log('CERR:', m.text().slice(0,200)); });
p.on('pageerror', e => console.log('PAGEERR:', e.message.split('\n')[0]));
await p.goto(URL, {waitUntil: 'domcontentloaded'});
await p.waitForTimeout(8000);

await p.evaluate(() => {
  if (window.__cameraRig) window.__cameraRig.update = () => {};
  const cam = window.__camera;
  cam.position.set(0, 20, 3000);
  cam.lookAt(0, 14, 0);
  cam.fov = 55;
  cam.updateProjectionMatrix();
  window.__renderer.render(window.__scene, cam);
});
await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/cascaded-horizon.png' });

await p.evaluate(() => {
  const cam = window.__camera;
  cam.position.set(0, 200, 3000);
  cam.lookAt(50, 15, 3300);
  cam.updateProjectionMatrix();
  window.__renderer.render(window.__scene, cam);
});
await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/cascaded-topdown.png' });
await browser.close();
