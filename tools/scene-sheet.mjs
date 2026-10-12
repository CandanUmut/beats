// Renders every scene at a few breath levels into one image, for review.
// Usage: node tools/scene-sheet.mjs out.png [W H]
import { build } from 'esbuild';
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'scenes.png';
const W = Number(process.argv[3] ?? 358), H = Number(process.argv[4] ?? 300);
const res = await build({ entryPoints: ['src/ui/scenes.ts'], bundle: true, format: 'iife', globalName: 'S', write: false });
const js = res.outputFiles[0].text;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W * 3 + 40, height: (H + 10) * 6 + 10 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.error('page error', e.message));
await p.setContent(`<body style="margin:0;background:#141210"><script>${js}</script></body>`);
const ms = await p.evaluate(({ W, H }) => {
  const t0 = performance.now();
  const ids = S.SCENES.map((s) => s.id);
  ids.forEach((id, row) => [0, 0.5, 1].forEach((breath, col) => {
    const cv = document.createElement('canvas');
    cv.width = W * 2; cv.height = H * 2;
    cv.style.cssText = `position:absolute;left:${10 + col * (W + 10)}px;top:${10 + row * (H + 10)}px;width:${W}px;height:${H}px;border-radius:14px`;
    document.body.appendChild(cv);
    const c = cv.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0);
    S.drawScene(c, id, W, H, { t: 12, breath, breathing: true, inhale: col === 2, still: false });
  }));
  const t1 = performance.now();
  // Per-frame cost once cached.
  const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
  const c = cv.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0);
  const per = {};
  for (const id of ids) { const a = performance.now(); for (let i = 0; i < 30; i++) S.drawScene(c, id, W, H, { t: i / 30, breath: 0.5, breathing: true, still: false }); per[id] = ((performance.now() - a) / 30).toFixed(2); }
  return { build: (t1 - t0).toFixed(0), per };
}, { W, H });
console.log('first draw (all builds) ms', ms.build, 'per-frame ms', ms.per);
await p.screenshot({ path: out });
await b.close();
