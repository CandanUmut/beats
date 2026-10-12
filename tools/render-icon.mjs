// Renders the app icon at every size. Usage: node tools/render-icon.mjs
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const res = await build({ entryPoints: ['tools/icon-art.ts'], bundle: true, format: 'iife', globalName: 'I', write: false });
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.error('page error', e.message));
await p.setContent(`<script>${res.outputFiles[0].text}</script>`);
for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon-64.png', 64]]) {
  const data = await p.evaluate((size) => {
    // Paint large, then scale down smoothly so small sizes stay soft.
    const big = document.createElement('canvas'); big.width = big.height = 1024;
    I.drawIcon(big.getContext('2d'), 1024);
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(big, 0, 0, size, size);
    return cv.toDataURL('image/png').split(',')[1];
  }, size);
  writeFileSync(`public/${name}`, Buffer.from(data, 'base64'));
  console.log('wrote', name);
}
await b.close();
