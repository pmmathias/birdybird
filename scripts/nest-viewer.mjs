import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://localhost:4183/birdybird/';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 800, height: 600 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));
page.on('console', (msg) => {
  const t = msg.text();
  if (t.includes('Nest') || t.includes('chick') || t.includes('Parrot') || msg.type() === 'error') {
    console.log(`[${msg.type()}] ${t.slice(0, 200)}`);
  }
});
page.on('requestfailed', (req) => console.log('REQ FAIL:', req.url(), req.failure()?.errorText));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(7000); // GLB loaders + PMREM need time

// Verify the chick GLB actually landed
const chickStatus = await page.evaluate(() => {
  const nest = window.__scene.getObjectByName('nest');
  if (!nest) return 'no nest';
  let meshes = 0;
  nest.traverse((o) => { if (o.isMesh) meshes++; });
  return `nest meshes: ${meshes}`;
});
console.log(chickStatus);

// Freeze chase cam so we can drive the camera manually
const debugInfo = await page.evaluate(() => {
  if (window.__cameraRig) window.__cameraRig.update = () => {};
  const scene = window.__scene;
  const nest = scene.getObjectByName('nest');
  if (!nest) return { error: 'no nest' };
  return { nestPos: nest.position.toArray() };
});
console.log('nest at:', debugInfo);

// Hide the tall 200m nest light-beam — at close range it fills the frame
await page.evaluate(() => {
  const nest = window.__scene.getObjectByName('nest');
  nest.traverse((o) => {
    if (o.isMesh && o.geometry?.type === 'CylinderGeometry' && o.geometry.parameters.height >= 100) {
      o.visible = false;
    }
  });
});

// Force-illuminate: add a bright point light right on the nest + boost ambient
// + temporarily remove scene.environment so PMREM doesn't blow out materials
await page.evaluate(() => {
  const scene = window.__scene;
  const nest = scene.getObjectByName('nest');
  // Clone an existing point light from the nest group and crank it
  let plight = null;
  nest.traverse((o) => { if (!plight && o.isPointLight) plight = o; });
  if (plight) {
    const bright = plight.clone();
    bright.intensity = 20.0;
    bright.distance = 80;
    bright.decay = 1.0;
    bright.position.set(nest.position.x, nest.position.y + 6, nest.position.z);
    bright.name = 'viewerPoint';
    scene.add(bright);
  }
  scene.traverse((o) => {
    if (o.isAmbientLight) {
      o.userData._oldIntensity = o.intensity;
      o.intensity = 1.5;
    }
  });
  scene.userData._oldEnv = scene.environment;
  scene.environment = null; // force direct-lighting only
});

const angles = [
  { name: 'front', deg:   0, dist: 12, height: 6.0, fov: 30 },
  { name: 'side',  deg:  90, dist: 12, height: 5.5, fov: 30 },
  { name: 'three-quarter', deg: 45, dist: 12, height: 6.5, fov: 30 },
  { name: 'above', deg:  30, dist:  9, height: 12,  fov: 40 },
];

for (const a of angles) {
  await page.evaluate((angle) => {
    const scene = window.__scene;
    const camera = window.__camera;
    const nest = scene.getObjectByName('nest');
    const rad = angle.deg * Math.PI / 180;
    camera.position.set(
      nest.position.x + Math.sin(rad) * angle.dist,
      nest.position.y + angle.height,
      nest.position.z + Math.cos(rad) * angle.dist,
    );
    // Look at the chick's head (local y=2.0 [chickGroup] + 2.55 [head] = 4.55 in nest-local)
    camera.lookAt(nest.position.x, nest.position.y + 3.2, nest.position.z);
    camera.fov = angle.fov;
    camera.near = 0.1;
    camera.updateProjectionMatrix();
    window.__renderer.render(scene, camera);
  }, a);
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__renderer.render(window.__scene, window.__camera));
  const path = `chick-${a.name}.png`;
  await page.screenshot({ path });
  console.log(`✓ ${path}`);
}

await browser.close();
console.log('done');
