import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://localhost:4173/birdybird/?forest=proc';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Safari/537.36',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));
page.on('console', (msg) => {
  const t = msg.text();
  if (msg.type() === 'error' || t.includes('Forest') || t.includes('orest')) {
    console.log(`[${msg.type()}] ${t.slice(0, 200)}`);
  }
});
page.on('requestfailed', (req) => console.log('REQFAIL:', req.url(), req.failure()?.errorText));

console.log('→', URL);
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

// Count draw calls
const stats = await page.evaluate(() => {
  const scene = window.__scene;
  const procForest = scene.getObjectByName('proc-forest');
  if (!procForest) return { error: 'no proc-forest' };
  const meshes = [];
  let totalInstances = 0;
  procForest.traverse((o) => {
    if (o.isInstancedMesh) {
      meshes.push({ name: o.name, count: o.count });
      totalInstances += o.count;
    }
  });
  return { meshes, totalInstances, drawCalls: meshes.length };
});
console.log('Forest stats:', JSON.stringify(stats, null, 2));

// Freeze camera rig so we can drive it
await page.evaluate(() => {
  if (window.__cameraRig) window.__cameraRig.update = () => {};
});

// Take screenshots from several angles over the forest
// Find a tree closest to the origin for a clean screenshot background
const treeSpot = await page.evaluate(() => {
  const scene = window.__scene;
  const procForest = scene.getObjectByName('proc-forest');
  if (!procForest) return null;
  let best = null;
  let bestDist = Infinity;
  procForest.traverse((c) => {
    if (!c.isInstancedMesh || c.count === 0) return;
    const arr = c.instanceMatrix.array;
    for (let i = 0; i < c.count; i++) {
      const x = arr[i * 16 + 12];
      const y = arr[i * 16 + 13];
      const z = arr[i * 16 + 14];
      const d = x * x + z * z;
      if (d < bestDist) { bestDist = d; best = { x, y, z }; }
    }
  });
  return best;
});
console.log('First tree at:', treeSpot);

const [tx, ty, tz] = [treeSpot.x, treeSpot.y, treeSpot.z];
const shots = [
  { name: 'wide', pos: [tx, ty + 80, tz + 250], target: [tx, ty + 20, tz], fov: 55 },
  { name: 'closeup', pos: [tx + 18, ty + 14, tz + 18], target: [tx, ty + 9, tz], fov: 55 },
  { name: 'grove', pos: [tx, ty + 30, tz + 60], target: [tx, ty + 10, tz], fov: 60 },
];

for (const s of shots) {
  await page.evaluate((sh) => {
    const camera = window.__camera;
    camera.position.set(...sh.pos);
    camera.lookAt(...sh.target);
    camera.fov = sh.fov;
    camera.updateProjectionMatrix();
    window.__renderer.render(window.__scene, camera);
  }, s);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `forest-${s.name}.png` });
  console.log(`✓ forest-${s.name}.png`);
}

await browser.close();
console.log('done');
