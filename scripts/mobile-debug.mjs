// Reproduce iPhone Safari issues headless. Uses iPhone 14 device profile
// (real iPhone UA + WebKit) so we hit the same Mobile Safari code path
// the user sees. Dumps console errors + a screenshot.
import { chromium, devices, webkit } from 'playwright';

const URL = process.argv[2] || 'https://pmmathias.github.io/birdybird/';

const browser = await webkit.launch({ headless: true });
const base = devices['iPhone 14'];
const ctx = await browser.newContext({
  ...base,
  viewport: { width: base.viewport.height, height: base.viewport.width }, // landscape
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

const errors = [];
const warnings = [];
page.on('pageerror', (e) => errors.push(`PAGE: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE-ERROR: ${msg.text()}`);
  else if (msg.type() === 'warning') warnings.push(msg.text());
});
page.on('requestfailed', (req) => errors.push(`REQ-FAIL: ${req.url()}`));

console.log('→', URL);
await page.goto(URL + '?skipcalib=1', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(7000);
// Click PLAY / dismiss landing — be aggressive
await page.evaluate(() => {
  const playBtn = [...document.querySelectorAll('button')]
    .find((b) => /play|start/i.test(b.textContent));
  if (playBtn) playBtn.click();
  // Hide any leftover modals
  ['.mobile-landing', '.calib-wizard', '#mobile-ui', '.landing', '.welcome']
    .forEach((sel) => document.querySelectorAll(sel).forEach((el) => el.style.display = 'none'));
});
await page.waitForTimeout(3000);

// Inspect scene
const diag = await page.evaluate(() => {
  const scene = window.__scene;
  const renderer = window.__renderer;
  if (!scene || !renderer) return { error: 'no scene/renderer' };
  const rr = scene.getObjectByName('rr-forest');
  let barkCount = 0, leafCount = 0;
  if (rr) rr.traverse((o) => {
    if (o.isInstancedMesh) {
      if (o.name?.includes('bark') || (o.material?.uniforms?.barkTexture)) barkCount += o.count;
      if (o.name?.includes('leaves') || (o.material?.uniforms?.leafTexture)) leafCount += o.count;
    }
  });
  return {
    capabilities: renderer.capabilities,
    webglVersion: renderer.capabilities.isWebGL2 ? 2 : 1,
    maxTextureSize: renderer.capabilities.maxTextureSize,
    precision: renderer.capabilities.precision,
    vertexTextures: renderer.capabilities.vertexTextures,
    scene: {
      environment: scene.environment ? 'present' : 'null',
      background: scene.background ? 'present' : 'null',
    },
    forest: {
      exists: !!rr,
      bark: barkCount,
      leaves: leafCount,
    },
    lights: {
      ambient: !!scene.children.find(c => c.isAmbientLight),
      directional: !!scene.children.find(c => c.isDirectionalLight),
    },
  };
});
console.log('DIAG:', JSON.stringify(diag, null, 2));

// Screenshot with default camera
await page.screenshot({ path: 'mobile-debug.png' });
console.log('\nSCREENSHOT: mobile-debug.png');

// Teleport camera right next to a tree and render again to check if they actually draw
await page.evaluate(() => {
  const scene = window.__scene;
  const renderer = window.__renderer;
  const camera = window.__camera;
  if (window.__cameraRig) window.__cameraRig.update = () => {};
  const rr = scene.getObjectByName('rr-forest');
  let spot = null;
  rr.traverse((o) => {
    if (spot || !o.isInstancedMesh) return;
    const arr = o.instanceMatrix.array;
    if (arr.length > 16) spot = { x: arr[12], y: arr[13], z: arr[14] };
  });
  if (!spot) return;
  camera.position.set(spot.x + 14, spot.y + 8, spot.z + 14);
  camera.lookAt(spot.x, spot.y + 6, spot.z);
  camera.fov = 55;
  camera.near = 0.5;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  window.__treeSpot = spot;
});
await page.waitForTimeout(200);
await page.screenshot({ path: 'mobile-debug-closeup.png' });
const spot = await page.evaluate(() => window.__treeSpot);
console.log(`SCREENSHOT: mobile-debug-closeup.png (camera at tree ${JSON.stringify(spot)})`);

if (errors.length) {
  console.log('\nERRORS:');
  for (const e of errors) console.log('  ' + e);
} else {
  console.log('\n(no errors)');
}

// WebGL shader compile errors
const webglErrors = await page.evaluate(() => {
  const gl = window.__renderer?.getContext?.();
  if (!gl) return 'no gl';
  const err = gl.getError();
  return err === gl.NO_ERROR ? 'NO_ERROR' : `err=${err}`;
});
console.log(`\nWebGL err: ${webglErrors}`);

await browser.close();
