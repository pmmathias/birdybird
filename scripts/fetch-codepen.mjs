// Pull JS/HTML/CSS sources out of a CodePen using a real browser.
// CodePen's Cloudflare blocks plain curl; playwright passes through fine.
//
// Usage: node scripts/fetch-codepen.mjs <pen-id> [username]
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const penId = process.argv[2];
const user = process.argv[3] || 'the-red-reddington';
if (!penId) { console.error('Usage: fetch-codepen.mjs <penId> [user]'); process.exit(1); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Safari/537.36',
});
const page = await ctx.newPage();

// Intercept every resource so we can collect JS/HTML/CSS that the iframe loads
const captured = { js: [], css: [], html: null };
page.on('response', async (res) => {
  const url = res.url();
  const ct = res.headers()['content-type'] || '';
  try {
    if (ct.includes('javascript') || url.endsWith('.js')) {
      const body = await res.text();
      if (body && body.length > 100) captured.js.push({ url, length: body.length, body });
    } else if (ct.includes('css') || url.endsWith('.css')) {
      const body = await res.text();
      if (body && body.length > 50) captured.css.push({ url, length: body.length, body });
    }
  } catch (_) { /* aborted/binary */ }
});

// The /full URL renders the pen without the editor UI; the iframe loaded inside
// contains the actual HTML+JS+CSS concatenation.
const fullURL = `https://codepen.io/${user}/full/${penId}`;
console.log('→', fullURL);
await page.goto(fullURL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);

// Pen iframes usually render at cdpn.io — grab their content directly
const frames = page.frames();
for (const f of frames) {
  const u = f.url();
  if (u.includes('cdpn.io') || u.includes('codepen')) {
    try {
      const html = await f.content();
      if (html && html.length > 500) captured.html = { url: u, body: html };
    } catch (_) { /* noop */ }
  }
}
// Fallback: main page HTML
if (!captured.html) {
  captured.html = { url: page.url(), body: await page.content() };
}

// Dump everything to /tmp/codepen-<id>/
const { mkdir } = await import('node:fs/promises');
const outDir = `/tmp/codepen-${penId}`;
await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/index.html`, captured.html.body);
console.log(`  index.html (${captured.html.body.length}) ← ${captured.html.url}`);
for (let i = 0; i < captured.js.length; i++) {
  const j = captured.js[i];
  const name = j.url.split('/').pop().split('?')[0] || `script-${i}.js`;
  await writeFile(`${outDir}/${i}-${name}`, j.body);
  console.log(`  ${i}-${name} (${j.length}) ← ${j.url.slice(0, 80)}`);
}
for (let i = 0; i < captured.css.length; i++) {
  const c = captured.css[i];
  const name = c.url.split('/').pop().split('?')[0] || `style-${i}.css`;
  await writeFile(`${outDir}/${i}-${name}`, c.body);
}

console.log(`\n✔ Saved to ${outDir}`);
await browser.close();
