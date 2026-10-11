// Dev tool: measures each piece's loudness with the real piano samples and
// writes src/music/gains.json (dB of gain to reach -20 LUFS).
// 1) python tools/flac-to-f32.py public/samples/piano-kw <f32dir>
// 2) npx vite-node tools/measure-gains.ts <f32dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { PIECES } from '../src/music/catalog';
import { performPiece, measurePerformance, gainDbFor } from '../src/music/score';
import { reverie } from '../src/music/generative';
import type { SampleRegion } from '../src/audio/dsp/sampler';

const dir = process.argv[2];
const bank = JSON.parse(readFileSync('public/samples/piano-kw/bank.json', 'utf8'));
const regions: SampleRegion[] = bank.regions.map((r: any) => ({
  lo: r.lo, hi: r.hi, center: r.center, rate: 44100, loopStart: r.loopStart, loopEnd: r.loopEnd,
  data: new Float32Array(readFileSync(`${dir}/${r.file.replace('.flac', '.f32')}`).buffer.slice(0)),
}));
const rate = 44100;
const out: Record<string, number> = {};
for (const p of PIECES) {
  const perf = performPiece(p, new Uint8Array(readFileSync(`public/music/midi/${p.file}`)));
  const lufs = measurePerformance(perf, regions, rate);
  out[p.id] = Math.round(gainDbFor(lufs) * 100) / 100;
  console.log(`${p.id}: ${lufs.toFixed(2)} LUFS, ${perf.duration.toFixed(0)} s -> gain ${out[p.id]} dB`);
}
const rv = reverie();
const lr = measurePerformance(rv, regions, rate);
out.reverie = Math.round(gainDbFor(lr) * 100) / 100;
console.log(`reverie: ${lr.toFixed(2)} LUFS -> gain ${out.reverie} dB`);
writeFileSync('src/music/gains.json', JSON.stringify(out, null, 1) + '\n');
