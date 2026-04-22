import { chromium } from 'playwright';
const URL = 'http://localhost:5173/birdybird/?renderer=webgpu&skipcalib=1';
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-webgpu','--use-angle=metal','--enable-webgpu-developer-features','--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('console', m => console.log('[' + m.type() + '] ' + m.text().slice(0, 500)));
page.on('pageerror', e => console.log('PAGEERR:', e.message.split('\n').slice(0,3).join(' | ')));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(8000);

// Probe the water mesh
const diag = await page.evaluate(async () => {
  const s = window.__scene;
  const r = window.__renderer;
  const cam = window.__camera;
  if (window.__cameraRig) window.__cameraRig.update = () => {};

  let waterMesh = null, water = null;
  s.traverse(o => {
    if (o.isMesh && o.material?.isNodeMaterial && o.geometry?.parameters?.width >= 2000) {
      waterMesh = o;
    }
  });
  if (!waterMesh) return { err: 'no water mesh with NodeMaterial found' };

  const geo = waterMesh.geometry;
  const matType = waterMesh.material.constructor.name;
  const disp = waterMesh.material.positionNode ? 'yes' : 'no';
  const normAttrName = waterMesh.material.normalNode ? 'yes' : 'no';

  // Fly over water — far offshore
  cam.position.set(0, 20, 2000);
  cam.lookAt(100, 5, 2100);
  cam.updateProjectionMatrix();
  r.render(s, cam);

  // Snap position attribute before/after a few frames to check animation
  const posAttr = geo.attributes.position;
  const samples = [];
  for (let i = 0; i < 5; i++) samples.push(posAttr.getY(i * 1000));

  return {
    matType,
    hasPosNode: disp,
    hasNrmNode: normAttrName,
    segs: [geo.parameters.widthSegments, geo.parameters.heightSegments],
    planeSize: [geo.parameters.width, geo.parameters.height],
    posYSamples: samples,
    meshY: waterMesh.position.y,
    meshRotX: waterMesh.rotation.x,
  };
});
console.log('\nWATER DIAG:', JSON.stringify(diag, null, 2));

// Water-horizon screenshot: camera low over water, looking along the surface
await page.evaluate(() => {
  const cam = window.__camera;
  cam.position.set(0, 20, 3000);
  cam.lookAt(0, 14, 0);
  cam.fov = 55;
  cam.updateProjectionMatrix();
  window.__renderer.render(window.__scene, cam);
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/probe-water-horizon.png' });

// Top-down oblique: camera high above open water looking down
await page.evaluate(() => {
  const cam = window.__camera;
  cam.position.set(0, 200, 3000);
  cam.lookAt(50, 15, 3300);
  cam.fov = 60;
  cam.updateProjectionMatrix();
  window.__renderer.render(window.__scene, cam);
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/probe-water-topdown.png' });

await browser.close();
