import { describe, expect, it } from 'vitest';
import { SessionMixer, DEFAULT_PARAMS, type MixParams } from '../src/audio/dsp/mixer';
import { pacedPattern, sighPattern, breathAt, cycleSeconds } from '../src/audio/dsp/breath';
import { integratedLoudness, truePeak, linToDb } from '../src/audio/dsp/loudness';
import { renderTrack } from '../src/audio/dsp/synth';
import { maxSecondDiff, rms } from './helpers';

const rate = 48000;

function render(params: MixParams, seconds: number, music?: { left: Float32Array; right: Float32Array }, timing = { duration: seconds, fadeIn: 0.5, fadeOut: 0.5 }) {
  const mx = new SessionMixer(rate, params, timing);
  if (music) mx.setMusic(music);
  mx.setParams(params);
  const n = Math.round(seconds * rate) + mx.latency;
  const L = new Float32Array(n), R = new Float32Array(n);
  const block = 128;
  const bl = new Float32Array(block), br = new Float32Array(block);
  for (let o = 0; o < n; o += block) {
    const k = Math.min(block, n - o);
    mx.process(bl, br, k);
    L.set(bl.subarray(0, k), o);
    R.set(br.subarray(0, k), o);
  }
  // Remove the limiter's look-ahead delay so time 0 lines up.
  return { L: L.subarray(mx.latency), R: R.subarray(mx.latency), mx };
}

/** A steady test "music": stereo pink-ish constant tone bed. */
function bed(seconds: number, amp = 0.1) {
  const n = Math.round(seconds * rate);
  const l = new Float32Array(n), r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    l[i] = amp * (Math.sin(2 * Math.PI * 330 * t) + 0.5 * Math.sin(2 * Math.PI * 523 * t));
    r[i] = l[i];
  }
  return { left: l, right: r };
}

const base = (over: Partial<MixParams> = {}): MixParams => ({
  ...DEFAULT_PARAMS,
  volume: 1,
  breath: { enabled: false, pattern: pacedPattern(6, 1.5), depthDb: 4 },
  rhythm: { ...DEFAULT_PARAMS.rhythm, mode: 'off' },
  ...over,
});

/** Envelope by RMS over short windows. */
function envelope(x: Float32Array, win: number) {
  const out: number[] = [];
  for (let o = 0; o + win <= x.length; o += win) out.push(rms(x, o, o + win));
  return out;
}

/** Dominant frequency of a sequence via a simple DFT scan. */
function dominantFreq(x: number[], fs: number, fmin: number, fmax: number, step: number) {
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  let best = 0, bestF = 0;
  for (let f = fmin; f <= fmax; f += step) {
    let re = 0, im = 0;
    for (let i = 0; i < x.length; i++) {
      re += (x[i] - m) * Math.cos((2 * Math.PI * f * i) / fs);
      im += (x[i] - m) * Math.sin((2 * Math.PI * f * i) / fs);
    }
    const p = re * re + im * im;
    if (p > best) { best = p; bestF = f; }
  }
  return bestF;
}

describe('breathing', () => {
  it('paced pattern has the right cycle length and ratio', () => {
    const p = pacedPattern(6, 1.5);
    expect(cycleSeconds(p)).toBeCloseTo(10, 6);
    expect(p.segments[0].seconds).toBeCloseTo(4, 6);
    expect(p.segments[1].seconds).toBeCloseTo(6, 6);
  });
  it('envelope is continuous across every segment boundary (no jumps)', () => {
    for (const p of [pacedPattern(5.5, 1.8), sighPattern()]) {
      let prev = breathAt(p, 0).level;
      for (let t = 0.001; t < 60; t += 0.001) {
        const v = breathAt(p, t).level;
        expect(Math.abs(v - prev)).toBeLessThan(0.003);
        prev = v;
      }
    }
  });
  it('the music swell follows the set breaths per minute', () => {
    for (const bpm of [4.5, 6, 7]) {
      const p = base({ breath: { enabled: true, pattern: pacedPattern(bpm, 1.5), depthDb: 6 } });
      const { L } = render(p, 60, bed(60));
      const env = envelope(L, 4800); // 10 Hz envelope rate
      const f = dominantFreq(env, 10, 0.03, 0.2, 0.0005);
      expect(f * 60).toBeCloseTo(bpm, 0);
      expect(Math.abs(f * 60 - bpm)).toBeLessThan(0.1);
    }
  }, 30000);
});

describe('pulse (AM)', () => {
  it('modulates at the set rate with the set depth', () => {
    const depth = 0.3, hz = 6;
    const p = base({ rhythm: { ...DEFAULT_PARAMS.rhythm, mode: 'pulse', rate: hz, depth } });
    // Use a DC-like bed so the envelope is the modulation itself.
    const n = 20 * rate;
    const dc = { left: new Float32Array(n).fill(0.2), right: new Float32Array(n).fill(0.2) };
    const { L } = render(p, 20, dc);
    const seg = L.subarray(5 * rate, 15 * rate);
    let mx = 0, mn = 1;
    for (const v of seg) { mx = Math.max(mx, v); mn = Math.min(mn, v); }
    expect(1 - mn / mx).toBeCloseTo(depth, 2);
    const env = Array.from(seg.filter((_, i) => i % 480 === 0));
    expect(dominantFreq(env, 100, 1, 20, 0.01)).toBeCloseTo(hz, 1);
  });
  it('sham (depth 0) is the same signal with no modulation', () => {
    const n = 10 * rate;
    const dc = { left: new Float32Array(n).fill(0.2), right: new Float32Array(n).fill(0.2) };
    const p = base({ rhythm: { ...DEFAULT_PARAMS.rhythm, mode: 'pulse', rate: 6, depth: 0 } });
    const { L } = render(p, 10, dc);
    const seg = L.subarray(2 * rate, 8 * rate);
    let mx = 0, mn = 1;
    for (const v of seg) { mx = Math.max(mx, v); mn = Math.min(mn, v); }
    expect(mx - mn).toBeLessThan(1e-6);
  });
});

describe('level matching for the Lab', () => {
  it('pulse at 30% depth and its depth-0 sham have the same loudness (within 0.2 dB)', () => {
    const tr = renderTrack('hush', rate);
    const act = base({ rhythm: { ...DEFAULT_PARAMS.rhythm, mode: 'pulse', rate: 8, depth: 0.3 } });
    const sham = base({ rhythm: { ...act.rhythm, depth: 0 } });
    const a = render(act, 40, tr), s = render(sham, 40, tr);
    expect(Math.abs(integratedLoudness([a.L, a.R], rate) - integratedLoudness([s.L, s.R], rate))).toBeLessThan(0.2);
  }, 60000);
});

describe('binaural', () => {
  function phaseDiffRate(L: Float32Array, R: Float32Array, carrier: number) {
    // Demodulate each ear at the carrier and track the phase difference.
    const win = rate / 50;
    const diffs: number[] = [];
    for (let o = 0; o + win <= L.length; o += win) {
      let lr = 0, li = 0, rr = 0, ri = 0;
      for (let i = o; i < o + win; i++) {
        const c = Math.cos((2 * Math.PI * carrier * i) / rate), s = Math.sin((2 * Math.PI * carrier * i) / rate);
        lr += L[i] * c; li += L[i] * s; rr += R[i] * c; ri += R[i] * s;
      }
      diffs.push(Math.atan2(ri, rr) - Math.atan2(li, lr));
    }
    // Unwrap and fit a slope (rad per window).
    const u = [diffs[0]];
    for (let i = 1; i < diffs.length; i++) {
      let d = diffs[i] - diffs[i - 1];
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      u.push(u[i - 1] + d);
    }
    const n = u.length;
    const xm = (n - 1) / 2, ym = u.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - xm) * (u[i] - ym); den += (i - xm) ** 2; }
    return (num / den) * 50 / (2 * Math.PI); // cycles per second
  }
  it('left/right phase difference rotates at exactly delta-f', () => {
    for (const df of [4, 6, 10]) {
      const p = base({ rhythm: { ...DEFAULT_PARAMS.rhythm, mode: 'binaural', rate: df, carrier: 220, levelDb: -15 } });
      const { L, R } = render(p, 6);
      expect(Math.abs(phaseDiffRate(L.subarray(rate, 5 * rate), R.subarray(rate, 5 * rate), 220))).toBeCloseTo(df, 2);
    }
  });
  it('sham (delta-f = 0) has identical carriers and level, and no rotation', () => {
    const act = base({ rhythm: { ...DEFAULT_PARAMS.rhythm, mode: 'binaural', rate: 6, carrier: 220, levelDb: -15 } });
    const sham = base({ rhythm: { ...act.rhythm, rate: 0 } });
    const a = render(act, 6), s = render(sham, 6);
    expect(Math.abs(phaseDiffRate(s.L.subarray(rate, 5 * rate), s.R.subarray(rate, 5 * rate), 220))).toBeLessThan(0.001);
    const la = linToDb(rms(a.L, rate, 5 * rate)), ls = linToDb(rms(s.L, rate, 5 * rate));
    expect(Math.abs(la - ls)).toBeLessThan(0.05);
  });
});

describe('loudness and clicks through the full chain', () => {
  it('a session with the Drift track and a 6 dB breathing swell measures -20 LUFS (+-1) and true peak <= -1 dBTP', () => {
    const tr = renderTrack('drift', rate);
    const p = base({ breath: { enabled: true, pattern: pacedPattern(6, 1.5), depthDb: 6 } });
    const { L, R } = render(p, 96, tr, { duration: 96, fadeIn: 0.01, fadeOut: 0.01 });
    expect(Math.abs(integratedLoudness([L, R], rate) + 20)).toBeLessThanOrEqual(1);
    expect(linToDb(truePeak([L, R]))).toBeLessThanOrEqual(-1);
  }, 60000);
  it('no clicks at start, early stop, and end fade', () => {
    const music = bed(30, 0.25);
    const p = base();
    const normal = maxSecondDiff(music.left) * 1.05;
    // Natural end.
    const a = render(p, 8, music, { duration: 8, fadeIn: 1, fadeOut: 2 });
    expect(maxSecondDiff(a.L)).toBeLessThanOrEqual(normal);
    // Early stop in the middle.
    const mx = new SessionMixer(rate, p, { duration: 30, fadeIn: 1, fadeOut: 2 });
    mx.setMusic(music);
    const n = 10 * rate;
    const L = new Float32Array(n);
    const bl = new Float32Array(128), br = new Float32Array(128);
    for (let o = 0; o < n; o += 128) {
      if (o === 4 * rate - (4 * rate) % 128) mx.stop(2);
      mx.process(bl, br, 128);
      L.set(bl.subarray(0, Math.min(128, n - o)), o);
    }
    expect(maxSecondDiff(L)).toBeLessThanOrEqual(normal);
    expect(rms(L, 8 * rate, 10 * rate)).toBe(0);
    expect(mx.finished).toBe(true);
  });
  it('changing volume mid-stream is smoothed (no zipper click)', () => {
    const music = bed(5, 0.25);
    const p = base();
    const mx = new SessionMixer(rate, p, { duration: 5, fadeIn: 0.2, fadeOut: 0.2 });
    mx.setMusic(music);
    const n = 3 * rate;
    const L = new Float32Array(n);
    const bl = new Float32Array(128), br = new Float32Array(128);
    for (let o = 0; o + 128 <= n; o += 128) {
      if (o === 1536 * 64) mx.setParams({ ...p, volume: 0.2 });
      mx.process(bl, br, 128);
      L.set(bl, o);
    }
    expect(maxSecondDiff(L)).toBeLessThanOrEqual(maxSecondDiff(music.left) * 1.05);
  });
});

describe('sound swap', () => {
  it('switching the sound mid-session crossfades with no click', () => {
    const a = bed(10, 0.25);
    const b = { left: a.left.map((_, i) => 0.25 * Math.sin((2 * Math.PI * 220 * i) / rate + 1)), right: a.right.map((_, i) => 0.25 * Math.sin((2 * Math.PI * 220 * i) / rate + 1)) };
    const p = base();
    const mx = new SessionMixer(rate, p, { duration: 10, fadeIn: 0.2, fadeOut: 0.2 });
    mx.setMusic(a);
    const n = 4 * rate;
    const L = new Float32Array(n);
    const bl = new Float32Array(128), br = new Float32Array(128);
    for (let o = 0; o + 128 <= n; o += 128) {
      if (o === 128 * 600) mx.setMusic(b);
      mx.process(bl, br, 128);
      L.set(bl, o);
    }
    expect(maxSecondDiff(L)).toBeLessThanOrEqual(Math.max(maxSecondDiff(a.left), maxSecondDiff(b.left)) * 1.05);
  });
});
