// Takes screenshots of every screen at phone (390 px) and desktop width.
// Usage: npm run build && node tools/screenshots.mjs [outDir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'screenshots';
mkdirSync(out, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', '4319', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));
const base = 'http://localhost:4319/';

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 860 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: label === 'phone' ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${label} console: ${m.text()}`));
  const shot = async (name, full = true) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${label}-${name}.png`, fullPage: full });
  };
  await page.goto(base);
  await page.waitForSelector('h1');
  await shot('01-safety');
  await page.check('input[type=checkbox]');
  await page.click('text=Continue');
  await shot('02-headphones');
  await page.click('text=Skip (no headphones right now)');
  await shot('03-stereo');
  await page.click('text=Skip');
  await shot('04-level');
  await page.click('text=Done');
  await page.waitForSelector('.goal-card');
  await shot('05-home');
  const routes = [
    ['06-calm', '#/calm'], ['07-urge', '#/urge'], ['08-sleep', '#/sleep'], ['09-focus', '#/focus'],
    ['10-breathe', '#/breathe'], ['11-move', '#/move'], ['12-evidence', '#/evidence'], ['13-why-beats-anger', '#/evidence/beats-anger'],
    ['14-myths', '#/myths'], ['15-settings', '#/settings'], ['16-about', '#/about'], ['17-sleep-diary', '#/sleep/diary'], ['18-lab', '#/lab'],
  ];
  for (const [name, hash] of routes) {
    await page.goto(base + hash);
    await page.waitForSelector('h1, .stage');
    await shot(name);
  }
  // A playing session.
  await page.goto(base + '#/relax');
  await page.click('button[aria-label=Start]');
  await page.waitForSelector('button[aria-label=Stop]', { timeout: 60000 });
  await page.waitForTimeout(6000);
  await shot('19-relax-playing', false);
  await page.click('text=Talk to someone');
  await shot('20-help-sheet', false);
  await ctx.close();
}
await browser.close();
server.kill();
if (errors.length) {
  console.log('Errors:\n' + errors.join('\n'));
  process.exitCode = 1;
} else console.log('Screenshots saved, no page errors.');
