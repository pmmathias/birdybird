// Perf harness: benchmark both renderer paths, several camera scenarios,
// and isolate bottlenecks by toggling individual subsystems.
//
// Output: a single markdown-ish table per renderer path.
//
// Usage:  node scripts/perf-bench.mjs  [SMOKE_URL=http://localhost:5173/birdybird/]

import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const URL_BASE = process.env.SMOKE_URL || 'http://localhost:5173/birdybird/';
const WARMUP_MS    = 3000;  // let the scene settle
const SAMPLE_MS    = 4000;  // how long to collect frame deltas per measurement
const SAMPLE_MIN   = 120;   // ensure at least this many frames

// Scenarios: camera placements that stress different parts of the pipeline.
// Coords are set directly on __camera and __cameraRig.update is neutered.
const SCENARIOS = [
  { name: 'air-over-land',    pos: [0, 200, 0],    look: [300, 50, 300] },
  { name: 'air-over-ocean',   pos: [0, 150, 3500], look: [200, 15, 3700] },
  { name: 'skim-ocean',       pos: [0, 25, 3500],  look: [500, 15, 3700] },
  { name: 'submerged',        pos: [0, 5, 3500],   look: [500, 8, 3700] },
  { name: 'inside-forest',    pos: [-180, 40, -1080], look: [0, 30, -1080] },
];

// Bottleneck probes: things we toggle OFF and re-measure.
// Each probe returns a "restore" function so the next measurement is unaffected.
const PROBES = [
  { id: 'water',    label: 'water plane',
    off: (s) => {
      const w = s.getObjectByName?.('') || s.children.find(c => c.children.some(k => k.isMesh && k.geometry?.parameters?.width >= 2000));
      // Find via traverse instead
      const hits = [];
      s.traverse(o => { if (o.isMesh && o.geometry?.parameters?.width >= 2000) hits.push(o); });
      hits.forEach(h => { h._savedVis = h.visible; h.visible = false; });
      return () => hits.forEach(h => { h.visible = h._savedVis ?? true; });
    },
  },
  { id: 'forest',   label: 'rr-forest',
    off: (s) => { const f = s.getObjectByName?.('rr-forest'); if (!f) return () => {}; const v = f.visible; f.visible = false; return () => { f.visible = v; }; },
  },
  { id: 'clouds',   label: 'clouds',
    off: (s) => { const c = s.children.find(o => o.name === 'clouds' || o.userData?.clouds); if (!c) return () => {}; const v = c.visible; c.visible = false; return () => { c.visible = v; }; },
  },
  { id: 'houses',   label: 'buildings',
    off: (s) => {
      const hits = [];
      s.traverse(o => { if (o.isInstancedMesh && /wall|roof|building|house/i.test(o.name || '')) hits.push(o); });
      hits.forEach(h => { h._vis = h.visible; h.visible = false; });
      return () => hits.forEach(h => { h.visible = h._vis ?? true; });
    },
  },
  { id: 'terrain',  label: 'terrain chunks',
    off: (s) => {
      const t = s.children.find(o => o.name === 'terrain' || /terrain/i.test(o.name || ''));
      if (!t) return () => {};
      const v = t.visible;
      t.visible = false;
      return () => { t.visible = v; };
    },
  },
];

function quant(arr, q) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))));
  return s[i];
}

async function collectFps(page, ms, minFrames) {
  return await page.evaluate(
    async ({ ms, minFrames }) => {
      await new Promise((r) => requestAnimationFrame(r));
      const deltas = [];
      let t = performance.now();
      const start = t;
      return await new Promise((resolve) => {
        function tick() {
          const now = performance.now();
          deltas.push(now - t);
          t = now;
          if (now - start >= ms && deltas.length >= minFrames) {
            resolve(deltas);
          } else {
            requestAnimationFrame(tick);
          }
        }
        requestAnimationFrame(tick);
      });
    },
    { ms, minFrames },
  );
}

function stats(deltas) {
  if (!deltas.length) return null;
  const drop = Math.min(5, Math.floor(deltas.length / 10));
  const clean = deltas.slice(drop);
  const avg = clean.reduce((a, b) => a + b, 0) / clean.length;
  const p50 = quant(clean, 0.5);
  const p95 = quant(clean, 0.95);
  const p99 = quant(clean, 0.99);
  return {
    frames: clean.length,
    avg_ms: avg,
    p50_ms: p50,
    p95_ms: p95,
    p99_ms: p99,
    avg_fps: 1000 / avg,
    p95_fps: 1000 / p95,
  };
}

async function runPath(rendererUrlParam, label) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-angle=metal',
      '--enable-webgpu-developer-features',
      '--ignore-gpu-blocklist',
      '--disable-gpu-vsync',       // don't cap at 60
      '--disable-frame-rate-limit',
    ],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  const url = URL_BASE + rendererUrlParam + (rendererUrlParam.includes('?') ? '&' : '?') + 'skipcalib=1';
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
  page.on('console', m => {
    if (m.type() === 'error') errors.push('[cerr] ' + m.text().slice(0, 200));
  });

  console.log(`\n==== ${label} ====  ${url}`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.log('goto-fail:', e.message.split('\n')[0]);
    await browser.close();
    return null;
  }
  await page.waitForTimeout(WARMUP_MS);

  // One-off setup: disarm camera rig so our position overrides stick.
  const ctxInfo = await page.evaluate(() => {
    if (window.__cameraRig) window.__cameraRig.update = () => {};
    const r = window.__renderer;
    const info = r?.info;
    return {
      path: window.__rendererPath || (r?.isWebGPURenderer ? 'WebGPU' : 'WebGL2'),
      waterPath: window.__waterPath,
      canvas: r?.domElement ? `${r.domElement.width}x${r.domElement.height}` : '?',
      // Initial info snapshot (will change once per frame)
      memGeometries: info?.memory?.geometries,
      memTextures: info?.memory?.textures,
      programs: info?.programs?.length ?? null,
    };
  });
  console.log('  path:', ctxInfo.path, '| water:', ctxInfo.waterPath, '| canvas:', ctxInfo.canvas);
  console.log('  geo:', ctxInfo.memGeometries, '| tex:', ctxInfo.memTextures, '| programs:', ctxInfo.programs);

  const results = [];
  for (const sc of SCENARIOS) {
    // Position the camera
    await page.evaluate((sc) => {
      const c = window.__camera;
      c.position.set(sc.pos[0], sc.pos[1], sc.pos[2]);
      c.lookAt(sc.look[0], sc.look[1], sc.look[2]);
      c.updateProjectionMatrix();
      // Also update birdAltitude-driven code paths
      if (window.__flightState) window.__flightState.altitude = sc.pos[1];
    }, sc);
    await page.waitForTimeout(600);

    // Baseline
    const baseDeltas = await collectFps(page, SAMPLE_MS, SAMPLE_MIN);
    const base = stats(baseDeltas);

    // Per-frame renderer info snapshot
    const frameInfo = await page.evaluate(() => {
      const i = window.__renderer?.info;
      return {
        calls: i?.render?.calls ?? null,
        tris: i?.render?.triangles ?? null,
        points: i?.render?.points ?? null,
        lines: i?.render?.lines ?? null,
      };
    });

    const probeResults = {};
    for (const p of PROBES) {
      // Toggle off
      const restored = await page.evaluate((probeId) => {
        const s = window.__scene;
        const probes = {
          water: () => {
            const hits = [];
            s.traverse(o => { if (o.isMesh && o.geometry?.parameters?.width >= 2000) hits.push(o); });
            hits.forEach(h => { h._savedVis = h.visible; h.visible = false; });
            return () => hits.forEach(h => { h.visible = h._savedVis ?? true; });
          },
          forest: () => {
            const f = s.getObjectByName?.('rr-forest');
            if (!f) return () => {};
            const v = f.visible; f.visible = false; return () => { f.visible = v; };
          },
          clouds: () => {
            const c = s.children.find(o => /cloud/i.test(o.name || ''));
            if (!c) return () => {};
            const v = c.visible; c.visible = false; return () => { c.visible = v; };
          },
          houses: () => {
            const hits = [];
            s.traverse(o => { if (o.isInstancedMesh && /wall|roof|building|house/i.test(o.name || '')) hits.push(o); });
            hits.forEach(h => { h._vis = h.visible; h.visible = false; });
            return () => hits.forEach(h => { h.visible = h._vis ?? true; });
          },
          terrain: () => {
            const t = s.children.find(o => /terrain/i.test(o.name || ''));
            if (!t) return () => {};
            const v = t.visible; t.visible = false; return () => { t.visible = v; };
          },
        };
        const fn = probes[probeId];
        if (!fn) return false;
        const restore = fn();
        window.__restoreProbe = restore;
        return true;
      }, p.id);

      if (!restored) { probeResults[p.id] = null; continue; }

      await page.waitForTimeout(400);
      const d = await collectFps(page, SAMPLE_MS, SAMPLE_MIN);
      probeResults[p.id] = stats(d);
      await page.evaluate(() => { if (window.__restoreProbe) window.__restoreProbe(); });
      await page.waitForTimeout(200);
    }

    results.push({ scenario: sc.name, base, frameInfo, probes: probeResults });
    console.log(
      `  [${sc.name}]  base ${base.avg_fps.toFixed(1)} fps  p95 ${base.p95_fps.toFixed(1)} fps` +
      `  |  calls ${frameInfo.calls}  tris ${frameInfo.tris}`,
    );
    for (const p of PROBES) {
      const r = probeResults[p.id];
      if (!r) continue;
      const delta = r.avg_fps - base.avg_fps;
      const sign = delta >= 0 ? '+' : '';
      console.log(`      w/o ${p.label.padEnd(16)}  ${r.avg_fps.toFixed(1)} fps  (${sign}${delta.toFixed(1)} vs base)`);
    }
  }

  await browser.close();
  return { label, ctx: ctxInfo, results, errors };
}

// Markdown report
function renderReport(runs) {
  const out = [];
  out.push('# birdybird perf bench', '');
  out.push(`_Captured ${new Date().toISOString()}_`, '');
  for (const run of runs) {
    if (!run) continue;
    out.push(`## ${run.label}`, '');
    out.push(`- renderer: **${run.ctx.path}**  |  water: **${run.ctx.waterPath}**`);
    out.push(`- canvas: ${run.ctx.canvas}`);
    out.push(`- geometries: ${run.ctx.memGeometries}, textures: ${run.ctx.memTextures}, programs: ${run.ctx.programs}`);
    if (run.errors.length) out.push(`- **errors (${run.errors.length}):** ${run.errors.slice(0, 3).join(' | ')}`);
    out.push('');
    out.push('### Baseline FPS per scenario');
    out.push('');
    out.push('| scenario | avg fps | p95 fps | frame-ms avg | p95 ms | p99 ms | draw calls | triangles |');
    out.push('|---|---|---|---|---|---|---|---|');
    for (const r of run.results) {
      const b = r.base;
      out.push(`| ${r.scenario} | ${b.avg_fps.toFixed(1)} | ${b.p95_fps.toFixed(1)} | ${b.avg_ms.toFixed(2)} | ${b.p95_ms.toFixed(2)} | ${b.p99_ms.toFixed(2)} | ${r.frameInfo.calls ?? '?'} | ${r.frameInfo.tris ?? '?'} |`);
    }
    out.push('');
    out.push('### Bottleneck toggles (Δ fps when subsystem is hidden)');
    out.push('');
    const probeIds = PROBES.map(p => p.id);
    out.push('| scenario | ' + probeIds.join(' | ') + ' |');
    out.push('|' + '---|'.repeat(probeIds.length + 1));
    for (const r of run.results) {
      const cells = probeIds.map(id => {
        const p = r.probes[id];
        if (!p) return 'n/a';
        const delta = p.avg_fps - r.base.avg_fps;
        return (delta >= 0 ? '+' : '') + delta.toFixed(1);
      });
      out.push(`| ${r.scenario} | ${cells.join(' | ')} |`);
    }
    out.push('');
    out.push('### Ranked bottlenecks per scenario');
    out.push('');
    for (const r of run.results) {
      const ranked = PROBES
        .map(p => {
          const pr = r.probes[p.id];
          if (!pr) return null;
          return { label: p.label, delta: pr.avg_fps - r.base.avg_fps };
        })
        .filter(Boolean)
        .sort((a, b) => b.delta - a.delta);
      out.push(`- **${r.scenario}**: ` + ranked.map(x => `${x.label} (+${x.delta.toFixed(1)})`).join(', '));
    }
    out.push('');
  }
  return out.join('\n');
}

(async () => {
  const runs = [];
  runs.push(await runPath('',                 'WebGL2 (default)'));
  runs.push(await runPath('?renderer=webgpu', 'WebGPU'));

  const md = renderReport(runs);
  console.log('\n' + '='.repeat(72));
  console.log(md);
  const outPath = new URL('../perf-report.md', import.meta.url).pathname;
  await writeFile(outPath, md);
  console.log('\nreport written: ' + outPath);
})();
