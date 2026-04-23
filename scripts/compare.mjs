import { chromium } from 'playwright';
async function shot(url, label) {
  const b = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu','--use-angle=metal','--enable-webgpu-developer-features','--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({viewport:{width:1280,height:720}})).newPage();
  await p.goto(url, {waitUntil: 'domcontentloaded'});
  await p.waitForTimeout(7000);
  await p.evaluate(() => {
    if (window.__cameraRig) window.__cameraRig.update = () => {};
    const cam = window.__camera;
    cam.position.set(0, 180, 3000);
    cam.lookAt(100, 15, 3300);
    cam.fov = 60;
    cam.updateProjectionMatrix();
    window.__renderer.render(window.__scene, cam);
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `/tmp/compare-${label}.png` });
  await b.close();
}
await shot('http://localhost:5173/birdybird/?renderer=webgpu&skipcalib=1', 'single');
await shot('http://localhost:5173/birdybird/?renderer=webgpu&ocean=cascaded&skipcalib=1', 'cascaded');
