import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://pmmathias.github.io/birdybird/';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 800, height: 600 },
  deviceScaleFactor: 1,
  // Pretend we're a desktop so the mobile wizard is skipped
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
});
const page = await ctx.newPage();

const logs = [];
const errors = [];
const warnings = [];
page.on('console', (msg) => {
  const t = msg.type();
  const text = msg.text();
  if (t === 'error') errors.push(text);
  else if (t === 'warning') warnings.push(text);
  else logs.push(`[${t}] ${text}`);
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

console.log('→ loading', URL);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3500); // let scene build

await page.screenshot({ path: 'smoke-nestquest.png', fullPage: false });
console.log('✓ screenshot smoke-nestquest.png');

const sceneInfo = await page.evaluate(() => {
  const s = window.__scene;
  if (!s) return { ok: false, reason: 'no __scene' };
  let meshes = 0, lights = 0;
  s.traverse((o) => {
    if (o.isMesh) meshes++;
    if (o.isLight) lights++;
  });
  return {
    ok: true,
    meshes,
    lights,
    children: s.children.length,
    bg: s.background ? 'set' : 'none',
    fog: s.fog ? { color: '#' + s.fog.color.getHexString(), near: s.fog.near, far: s.fog.far } : null,
    flightState: window.__flightState
      ? { pos: window.__flightState.position.toArray().map((v) => v.toFixed(1)), alt: window.__flightState.altitude.toFixed(1), speed: window.__flightState.speed.toFixed(1) }
      : null,
    nestQuest: window.__nestQuest
      ? { started: window.__nestQuest.started, sticks: window.__nestQuest.sticks, worms: window.__nestQuest.worms, timer: window.__nestQuest.timer.toFixed(1) }
      : 'none',
  };
});
console.log('→ scene:', JSON.stringify(sceneInfo, null, 2));

if (errors.length) {
  console.log('\n=== ERRORS ===');
  for (const e of errors) console.log('  ' + e);
}
if (warnings.length) {
  console.log('\n=== WARNINGS ===');
  for (const w of warnings.slice(0, 5)) console.log('  ' + w);
}

await browser.close();
console.log('\n✓ done');
