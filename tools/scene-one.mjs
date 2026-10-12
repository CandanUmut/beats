// Renders one scene large at a given breath. Usage: node tools/scene-one.mjs id breath out.png [W H]
import { build } from 'esbuild';
import { chromium } from 'playwright';
const [id, breath, out, W = 390, H = 420] = process.argv.slice(2);
const res = await build({ entryPoints: ['src/ui/scenes.ts'], bundle: true, format: 'iife', globalName: 'S', write: false });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.error('page error', e.message));
await p.setContent(`<body style="margin:0"><canvas id=c style="width:${W}px;height:${H}px"></canvas><script>${res.outputFiles[0].text}</script></body>`);
await p.evaluate(({ id, breath, W, H }) => { const cv = document.getElementById('c'); cv.width = W * 2; cv.height = H * 2; const c = cv.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0); S.drawScene(c, id, W, H, { t: 20, breath, breathing: true, inhale: true, still: false }); }, { id, breath: +breath, W: +W, H: +H });
await p.screenshot({ path: out });
await b.close();
