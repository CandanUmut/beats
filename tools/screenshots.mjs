// Takes screenshots of every screen at phone (390 px) and desktop width.
// Usage: npm run build && node tools/screenshots.mjs [outDir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'screenshots';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', '4319', '--strictPort'], { stdio: 'pipe' });
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
  await page.click('text=I understand, continue');
  await shot('04-level');
  await page.click('text=Start');
  await page.waitForSelector('.mood');
  await shot('05-home');
  await page.waitForTimeout(5000);
  await shot('05b-home-cat', false);
  await page.click('.cat');
  await page.waitForTimeout(500);
  await page.click('.cat');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${label}-05c-cat-petted.png`, clip: { x: 0, y: viewport.height - 160, width: viewport.width, height: 160 } });
  const routes = [
    ['06-calm', '#/m/calm'], ['07-grounded', '#/m/grounded'], ['08-sleepy', '#/m/sleepy'], ['09-focused', '#/m/focused'],
    ['10-brighter', '#/m/brighter'], ['10b-relaxed', '#/m/relaxed'], ['11-move', '#/move'], ['12-evidence', '#/evidence'], ['13-why-beats-anger', '#/evidence/beats-anger'],
    ['14-myths', '#/myths'], ['02-headphones', '#/recheck'], ['15-settings', '#/settings'], ['16-about', '#/about'], ['17-sleep-diary', '#/sleep/diary'], ['18-lab', '#/lab'],
  ];
  for (const [name, hash] of routes) {
    await page.goto(base + hash);
    await page.waitForSelector('h1, .stage');
    await shot(name);
  }
  // Lab: wizard, locked plan, a session, and results from simulated data.
  await page.goto(base + '#/lab/new');
  await page.waitForSelector('h1');
  await shot('21-lab-new');
  await page.click('text=Review and lock');
  await page.click('text=Lock plan');
  await page.waitForSelector('text=Start session');
  await shot('22-lab-experiment');
  await page.click('text=Start session');
  await page.waitForSelector('h1');
  await shot('23-lab-session-pre');
  await page.evaluate(simulateExperiment);
  await page.goto(base + '#/lab/sim-demo/results');
  await page.waitForSelector('h1');
  await page.waitForTimeout(600);
  await shot('24-lab-results');
  await page.goto(base + '#/lab');
  await page.waitForSelector('h1');
  await shot('25-lab-home');
  // A playing session.
  await page.goto(base + '#/m/relaxed');
  await page.click('button[aria-label=Start]');
  await page.waitForSelector('button[aria-label=Stop]', { timeout: 60000 });
  await page.waitForTimeout(9000);
  await shot('19-relax-playing', false);
  const state = await page.evaluate(() => document.querySelector('.now-playing')?.textContent);
  console.log(label, 'now playing:', state);
  await page.click('.support-btn');
  await shot('20-help-sheet', false);
  await page.click('.sheet .btn.block');
  await page.click('button[aria-label=Stop]');
  await page.waitForTimeout(2500);
  // Tune sheet, then the full music library, then a strings piece.
  await page.click('.recipe button');
  await page.waitForSelector('.sheet');
  await shot('21b-tune-sheet', false);
  await page.click('text=All music');
  await page.waitForSelector('.lib-item');
  await shot('26-music-library', false);
  await page.click('.lib-item:has-text("Warm strings")');
  await page.waitForTimeout(1500);
  await page.click('button[aria-label=Start]');
  await page.waitForTimeout(8000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('27-strings-playing', false);
  await page.click('button[aria-label=Stop]');
  await page.waitForTimeout(2500);
  // Find my sound.
  await page.goto(base + '#/tune/relaxed');
  await page.waitForSelector('h1');
  await shot('28-find-music');
  await page.click('.taste-opt .letter');
  await page.waitForTimeout(6000);
  await shot('29-find-music-preview', false);
  await page.click('text=Next: the beat');
  await page.waitForTimeout(800);
  await shot('30-find-beat');
  await page.click('text=Keep the beat');
  await shot('31-find-length');
  await page.click('text=Next: the view');
  await page.waitForTimeout(800);
  await shot('32-find-view');
  // Each scene, playing.
  for (const m of ['calm', 'sleepy', 'grounded', 'focused', 'brighter']) {
    await page.goto(base + '#/m/' + m);
    await page.waitForSelector('button[aria-label=Start]');
    await page.waitForTimeout(1200);
    await shot('40-scene-' + m, false);
  }
  await ctx.close();
}
await browser.close();
server.kill('SIGKILL');
if (errors.length) {
  console.log('Errors:\n' + errors.join('\n'));
  process.exitCode = 1;
} else console.log('Screenshots saved, no page errors.');
process.exit();

/** Runs in the page: stores a finished, simulated experiment for the results screenshot. */
function simulateExperiment() {
  let seed = 5;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const schedule = [];
  for (let b = 0; b < 15; b++) schedule.push(...(rand() < 0.5 ? ['A', 'B', 'B', 'A'] : ['B', 'A', 'A', 'B']));
  const plan = {
    id: 'sim-demo', name: 'Demo (simulated data): binaural vs sham', goal: 'relax', factor: 'binaural', outcome: 'calm_up', minutes: 24,
    sound: 'drift', breathing: true, breath: { mode: 'paced', bpm: 6, ratio: 1.5 }, rhythm: { rate: 6, depth: 0.15, carrier: 220, levelDb: -15 },
    baseline: 5, pairs: 30, rule: { minDiff: 1, maxGuessAccuracy: 0.6 }, pvt: false, createdAt: Date.now() - 1e9, lockedAt: Date.now() - 1e9,
    seed: 5, schedule, status: 'complete',
  };
  const trials = [];
  for (let i = 0; i < 65; i++) {
    const arm = i < 5 ? null : schedule[i - 5];
    const pre = 4 + Math.round(rand() * 2);
    const post = Math.min(10, Math.max(0, Math.round(pre + 1.5 + (arm === 'A' ? 0.3 : 0) + (rand() - 0.5) * 3)));
    trials.push({ id: 'sim' + i, expId: 'sim-demo', index: i, phase: arm ? 'main' : 'baseline', arm, startedAt: Date.now() - (65 - i) * 864e5, minutesPlayed: 24,
      pre: { calm: pre, anger: 2, craving: 1, focus: 5, sleepiness: 4 }, post: { calm: post, anger: 1, craving: 1, focus: 5, sleepiness: 5 },
      guess: arm ? (rand() < 0.55 ? arm : (arm === 'A' ? 'B' : 'A')) : undefined, sideEffects: [], note: '', stoppedEarly: false });
  }
  return new Promise((resolve) => {
    const q = indexedDB.open('steady', 1);
    q.onsuccess = () => {
      const t = q.result.transaction(['experiments', 'trials'], 'readwrite');
      t.objectStore('experiments').put(plan);
      for (const tr of trials) t.objectStore('trials').put(tr);
      t.oncomplete = resolve;
    };
  });
}
