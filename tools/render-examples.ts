// Renders example WAV files with the exact export code path, for the
// independent Python check. Usage: npx vite-node tools/render-examples.ts [outDir]
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { ScorePlayer, type SampleRegion } from '../src/audio/dsp/sampler';
import { buildScore } from '../src/music/score';
import type { MusicSource } from '../src/audio/dsp/mixer';
import { SessionMixer, DEFAULT_PARAMS, type MixParams } from '../src/audio/dsp/mixer';
import { renderTrack } from '../src/audio/dsp/synth';
import { pacedPattern } from '../src/audio/dsp/breath';
import { PcmEncoder, wavHeader } from '../src/audio/dsp/wav';

const out = process.argv[2] ?? 'tools/out';
mkdirSync(out, { recursive: true });
const rate = 48000;

function render(name: string, params: MixParams, seconds: number, track: 'drift' | 'hush' | 'pink' | 'lofi' | 'strings' | 'lullaby' | 'aurora' | null, source?: MusicSource) {
  const mx = new SessionMixer(rate, params, { duration: seconds, fadeIn: 4, fadeOut: 8 });
  if (source) mx.setMusic(source);
  else if (track) {
    const t = renderTrack(track, rate);
    mx.setMusic({ left: t.left, right: t.right });
  }
  mx.setParams(params);
  const frames = seconds * rate;
  const enc = new PcmEncoder(24);
  const parts: Uint8Array[] = [wavHeader(rate, 2, 24, frames)];
  const block = 8192;
  const L = new Float32Array(block), R = new Float32Array(block);
  let skip = mx.latency, written = 0;
  while (written < frames) {
    mx.process(L, R, block);
    let s = 0;
    if (skip > 0) { s = Math.min(skip, block); skip -= s; }
    const n = Math.min(block - s, frames - written);
    if (n > 0) { parts.push(enc.encode(L.subarray(s, s + n), R.subarray(s, s + n), n)); written += n; }
  }
  const total = parts.reduce((a, p) => a + p.length, 0);
  const buf = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  writeFileSync(`${out}/${name}.wav`, buf);
  console.log(`${out}/${name}.wav`);
}

const base: MixParams = { ...DEFAULT_PARAMS, volume: 1, breath: { enabled: true, pattern: pacedPattern(6, 1.5), depthDb: 4 } };
render('relax-drift', base, 120, 'drift');
render('sleep-hush', base, 90, 'hush');
render('binaural-6hz', { ...base, breath: { ...base.breath, enabled: false }, rhythm: { mode: 'binaural', rate: 6, depth: 0, carrier: 220, levelDb: -15 } }, 60, 'pink');
render('binaural-sham', { ...base, breath: { ...base.breath, enabled: false }, rhythm: { mode: 'binaural', rate: 0, depth: 0, carrier: 220, levelDb: -15 } }, 60, 'pink');
render('binaural-carriers-only-6hz', { ...base, breath: { ...base.breath, enabled: false }, rhythm: { mode: 'binaural', rate: 6, depth: 0, carrier: 220, levelDb: -15 } }, 30, null);
render('pulse-10hz-20pct', { ...base, breath: { ...base.breath, enabled: false }, rhythm: { mode: 'pulse', rate: 10, depth: 0.2, carrier: 220, levelDb: -15 } }, 60, 'hush');

render('lofi', base, 60, 'lofi');
render('strings', base, 60, 'strings');
render('lullaby', base, 60, 'lullaby');
render('aurora', base, 60, 'aurora');

// Piano pieces need the decoded samples (python tools/flac-to-f32.py ...).
const f32 = process.argv[3];
if (f32) {
  const bank = JSON.parse(readFileSync('public/samples/piano-kw/bank.json', 'utf8'));
  // Resample-free: render at 44.1 kHz like the samples, via a mixer at 44.1 kHz would change rate;
  // instead tell the sampler the sample rate and let it transpose.
  const regions: SampleRegion[] = bank.regions.map((r: any) => ({
    lo: r.lo, hi: r.hi, center: r.center, rate: 44100, loopStart: r.loopStart, loopEnd: r.loopEnd,
    data: new Float32Array(readFileSync(`${f32}/${r.file.replace('.flac', '.f32')}`).buffer.slice(0)),
  }));
  const load = async (f: string) => new Uint8Array(readFileSync(`public/music/midi/${f}`));
  for (const id of ['piece:chopin-noct-9-2', 'piece:satie-gym-1', 'reverie']) {
    const sc = await buildScore(id, load);
    const name = id.replace('piece:', '');
    render(`${name}-binaural`, { ...base, rhythm: { mode: 'binaural', rate: 6, depth: 0, carrier: 155.56, levelDb: -15 } }, 150, null, new ScorePlayer(rate, regions, sc.notes, sc.length));
  }
}
