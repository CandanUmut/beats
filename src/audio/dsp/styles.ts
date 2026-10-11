// More generated styles: lo-fi chill, ambient pads, music box and warm
// strings. Each returns a seamless stereo loop plus the notes it played (so
// the app can animate them).

import { foldLoop, lowpass, highpass, pinkNoise } from './noise';
import { mulberry32 } from './random';
import { reverb } from './synth';

export interface VisualNote {
  t: number;
  dur: number;
  midi: number;
  vel: number;
}

export type Stereo = [Float32Array, Float32Array];

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const panGains = (pan: number): [number, number] => [Math.cos(((pan + 1) * Math.PI) / 4), Math.sin(((pan + 1) * Math.PI) / 4)];

function table(amps: number[], size = 4096): Float32Array {
  const t = new Float32Array(size + 1);
  for (let i = 0; i <= size; i++) {
    let v = 0;
    for (let h = 0; h < amps.length; h++) v += amps[h] * Math.sin((2 * Math.PI * (h + 1) * i) / size);
    t[i] = v;
  }
  return t;
}

/** Generic wavetable note with optional vibrato and tremolo. */
function wtNote(
  L: Float32Array, R: Float32Array, rate: number, tab: Float32Array,
  o: { f: number; start: number; dur: number; amp: number; pan: number; att: number; rel: number; decay?: number; vib?: number; vibRate?: number; vibDelay?: number; trem?: number; tremRate?: number; detune?: number },
): void {
  const s0 = Math.round(o.start * rate);
  const len = Math.round(o.dur * rate);
  const att = Math.max(1, Math.round(o.att * rate));
  const rel = Math.max(1, Math.round(o.rel * rate));
  const N = tab.length - 1;
  const [gl, gr] = panGains(o.pan);
  const decay = o.decay ? Math.exp(-1 / (o.decay * rate)) : 1;
  const f = o.f * (1 + (o.detune ?? 0));
  let ph = 0;
  let env = 1;
  for (let i = 0; i < len && s0 + i < L.length; i++) {
    const t = i / rate;
    let inc = (f / rate) * N;
    if (o.vib) {
      const d = Math.min(1, Math.max(0, (t - (o.vibDelay ?? 0)) / 0.6));
      inc *= 1 + o.vib * d * Math.sin(2 * Math.PI * (o.vibRate ?? 5.2) * t);
    }
    const j = ph | 0;
    let v = tab[j] + (tab[j + 1] - tab[j]) * (ph - j);
    ph += inc;
    while (ph >= N) ph -= N;
    let a = 1;
    if (i < att) a = 0.5 - 0.5 * Math.cos((Math.PI * i) / att);
    const fromEnd = len - i;
    if (fromEnd < rel) a *= 0.5 - 0.5 * Math.cos((Math.PI * fromEnd) / rel);
    env *= decay;
    if (o.trem) a *= 1 - o.trem * (0.5 - 0.5 * Math.cos(2 * Math.PI * (o.tremRate ?? 4) * t));
    v *= a * env * o.amp;
    L[s0 + i] += v * gl;
    R[s0 + i] += v * gr;
  }
}

/** Partial-based struck note (bells, music box, electric piano). */
function struck(
  L: Float32Array, R: Float32Array, rate: number,
  o: { f: number; start: number; dur: number; amp: number; pan: number; partials: number[]; amps: number[]; decays: number[]; att?: number; trem?: number; tremRate?: number },
): void {
  const s0 = Math.round(o.start * rate);
  const len = Math.round(o.dur * rate);
  const att = Math.max(1, Math.round((o.att ?? 0.004) * rate));
  const rel = Math.round(Math.min(0.4, o.dur * 0.3) * rate);
  const [gl, gr] = panGains(o.pan);
  const k = o.partials.length;
  const c = new Float64Array(k), s = new Float64Array(k), re = new Float64Array(k), im = new Float64Array(k), env = new Float64Array(k), d = new Float64Array(k);
  for (let p = 0; p < k; p++) {
    const w = (2 * Math.PI * o.f * o.partials[p]) / rate;
    c[p] = Math.cos(w); s[p] = Math.sin(w); re[p] = 1; im[p] = 0;
    env[p] = o.amps[p];
    d[p] = Math.exp(-1 / (o.decays[p] * rate));
  }
  for (let i = 0; i < len && s0 + i < L.length; i++) {
    let v = 0;
    for (let p = 0; p < k; p++) {
      v += im[p] * env[p];
      env[p] *= d[p];
      const r = re[p] * c[p] - im[p] * s[p];
      im[p] = re[p] * s[p] + im[p] * c[p];
      re[p] = r;
    }
    let a = 1;
    if (i < att) a = 0.5 - 0.5 * Math.cos((Math.PI * i) / att);
    const fromEnd = len - i;
    if (fromEnd < rel) a *= 0.5 - 0.5 * Math.cos((Math.PI * fromEnd) / rel);
    if (o.trem) a *= 1 - o.trem * (0.5 - 0.5 * Math.cos(2 * Math.PI * (o.tremRate ?? 4) * (i / rate)));
    v *= a * o.amp;
    L[s0 + i] += v * gl;
    R[s0 + i] += v * gr;
  }
}

function buffers(seconds: number, rate: number): Stereo {
  const n = Math.round(seconds * rate);
  return [new Float32Array(n), new Float32Array(n)];
}

// --- Lo-fi chill ------------------------------------------------------------

export function renderLofi(rate: number, seed = 1): { st: Stereo; events: VisualNote[] } {
  const bpm = 72;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const bars = 16;
  const loop = bars * bar;
  const tail = 6;
  const [L, R] = buffers(loop + tail, rate);
  const [DL, DR] = buffers(loop + tail, rate); // drums: kept drier
  const rand = mulberry32(seed * 101 + 7);
  const events: VisualNote[] = [];
  // ii-V-I-vi flavour in C, two bars each, with a variation in the second half.
  const prog = [
    [53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59], // Fmaj7 Em7 Dm7 Cmaj7
    [53, 57, 60, 64], [52, 55, 59, 62], [45, 48, 52, 55], [50, 53, 57, 60], // Fmaj7 Em7 Am7 Dm7
  ];
  const ep = { partials: [1, 2, 3, 7.02], amps: [1, 0.22, 0.06, 0.05], decays: [2.6, 1.4, 0.8, 0.12] };
  for (let b = 0; b < bars; b += 2) {
    const ch = prog[(b / 2) % prog.length];
    const t0 = b * bar + (rand() - 0.5) * 0.02;
    for (const m of ch) {
      const st = t0 + rand() * 0.025;
      struck(L, R, rate, { f: hz(m), start: st, dur: bar * 1.9, amp: 0.16, pan: (m - 56) / 20, ...ep, trem: 0.12, tremRate: 4.2 });
      events.push({ t: st, dur: bar * 1.9, midi: m, vel: 0.5 });
    }
    // An anticipated re-hit on the "and" of 4 in the second bar, sometimes.
    if (rand() < 0.6) {
      const st = t0 + bar + beat * 3.5;
      for (const m of ch.slice(1)) struck(L, R, rate, { f: hz(m), start: st, dur: beat * 0.9, amp: 0.1, pan: 0, ...ep });
    }
    // Bass.
    const root = ch[0] - 24;
    for (const [bt, d] of [[0, 1.6], [2.5, 1.2], [4, 1.6], [6.5, 1.2]] as [number, number][]) {
      const st = t0 + bt * beat;
      struck(L, R, rate, { f: hz(root + (bt === 6.5 && rand() < 0.4 ? 7 : 0)), start: st, dur: d * beat, amp: 0.34, pan: 0, partials: [1, 2], amps: [1, 0.25], decays: [1.2, 0.5], att: 0.01 });
    }
  }
  // Sparse melody in the second half.
  const pent = [72, 74, 76, 79, 81, 84];
  let mi = 2;
  for (let b = 8; b < bars; b++) {
    for (let k = 0; k < 4; k++) {
      if (rand() < 0.62) continue;
      mi = Math.max(0, Math.min(pent.length - 1, mi + [-1, 1, -2, 2, 0][Math.floor(rand() * 5)]));
      const st = b * bar + (k + (rand() < 0.3 ? 0.5 : 0)) * beat;
      struck(L, R, rate, { f: hz(pent[mi]), start: st, dur: beat * 2.5, amp: 0.11, pan: 0.3, ...ep });
      events.push({ t: st, dur: beat * 2.5, midi: pent[mi], vel: 0.6 });
    }
  }
  // Drums with swing.
  const swing = beat * 0.5 * 0.62;
  const noise = pinkNoise(Math.round(0.4 * rate), seed + 9);
  const hat = new Float32Array(noise);
  highpass(hat, 6500, rate);
  const snr = new Float32Array(noise);
  lowpass(snr, 2800, rate);
  highpass(snr, 250, rate);
  const burst = (src: Float32Array, start: number, dur: number, amp: number, pan: number) => {
    const s0 = Math.round(start * rate);
    const n = Math.round(dur * rate);
    const [gl, gr] = panGains(pan);
    const att = Math.round(0.002 * rate);
    for (let i = 0; i < n && s0 + i < DL.length; i++) {
      const a = (i < att ? i / att : 1) * Math.exp(-i / (n / 4)) * (0.5 + 0.5 * Math.cos((Math.PI * i) / n));
      DL[s0 + i] += src[i % src.length] * a * amp * gl;
      DR[s0 + i] += src[i % src.length] * a * amp * gr;
    }
  };
  const kick = (start: number, amp: number) => {
    const s0 = Math.round(start * rate);
    const n = Math.round(0.35 * rate);
    let ph = 0;
    for (let i = 0; i < n && s0 + i < DL.length; i++) {
      const t = i / rate;
      const f = 48 + 70 * Math.exp(-t / 0.03);
      ph += (2 * Math.PI * f) / rate;
      const a = (i < 48 ? i / 48 : 1) * Math.exp(-t / 0.12);
      const v = Math.sin(ph) * a * amp;
      DL[s0 + i] += v;
      DR[s0 + i] += v;
    }
  };
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    kick(t0, 0.55);
    kick(t0 + beat * (rand() < 0.5 ? 2 : 2.5), 0.45);
    if (rand() < 0.3) kick(t0 + beat * 3.5, 0.3);
    burst(snr, t0 + beat, 0.16, 0.5, -0.1);
    burst(snr, t0 + beat * 3 + 0.01, 0.16, 0.5, -0.1);
    for (let e = 0; e < 8; e++) {
      const st = t0 + Math.floor(e / 2) * beat + (e % 2 ? swing : 0);
      burst(hat, st, 0.05, (e % 2 ? 0.16 : 0.24) * (0.8 + rand() * 0.4), 0.25);
    }
  }
  // Vinyl: soft hiss and gentle crackle (smoothed, not sharp clicks).
  const hiss = pinkNoise(L.length, seed + 4);
  lowpass(hiss, 5000, rate);
  for (let i = 0; i < L.length; i++) { L[i] += hiss[i] * 0.012; R[i] += hiss[i] * 0.012; }
  const crackles = Math.round((loop + tail) * 4);
  for (let k = 0; k < crackles; k++) {
    const s0 = Math.floor(rand() * (L.length - 200));
    const n = 40 + Math.floor(rand() * 60);
    const amp = 0.01 + rand() * 0.025;
    const sgn = rand() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const v = sgn * amp * Math.sin((Math.PI * i) / n) ** 2;
      L[s0 + i] += v; R[s0 + i] += v * 0.8;
    }
  }
  reverb(L, R, rate, 0.22, 0.75);
  for (let i = 0; i < L.length; i++) { L[i] += DL[i]; R[i] += DR[i]; }
  lowpass(L, 7000, rate);
  lowpass(R, 7000, rate);
  const lf = Math.round(loop * rate);
  return { st: [foldLoop(L, lf), foldLoop(R, lf)], events: events.filter((e) => e.t < loop) };
}

// --- Ambient pads ("Aurora") ------------------------------------------------

export function renderAurora(rate: number, seed = 1): { st: Stereo; events: VisualNote[] } {
  const loop = 64;
  const tail = 12;
  const [L, R] = buffers(loop + tail, rate);
  const rand = mulberry32(seed * 7 + 3);
  const pad = table([1, 0.5, 0.25, 0.12, 0.06, 0.03]);
  const chords = [[50, 57, 62, 64, 66], [47, 54, 59, 62, 64], [43, 50, 57, 59, 66], [45, 52, 57, 59, 62]];
  chords.forEach((ch, ci) => {
    for (const m of ch) {
      for (const det of [-0.004, 0.004]) {
        wtNote(L, R, rate, pad, { f: hz(m), start: ci * 16, dur: 21, amp: 0.05, pan: det > 0 ? 0.5 : -0.5, att: 5, rel: 6, detune: det, vib: 0.0015, vibRate: 0.3 });
      }
    }
  });
  const events: VisualNote[] = [];
  for (let t = 1; t < loop; t += 2.5 + rand() * 3) {
    const ch = chords[Math.floor(t / 16) % 4];
    const m = ch[1 + Math.floor(rand() * 4)] + 24;
    struck(L, R, rate, { f: hz(m), start: t, dur: 7, amp: 0.035, pan: rand() * 1.4 - 0.7, partials: [1, 2.76, 5.4], amps: [1, 0.3, 0.1], decays: [3.5, 1.5, 0.6], att: 0.02 });
    events.push({ t, dur: 4, midi: m, vel: 0.4 });
  }
  reverb(L, R, rate, 0.45, 0.88, 0.3);
  const lf = Math.round(loop * rate);
  return { st: [foldLoop(L, lf), foldLoop(R, lf)], events };
}

// --- Music box ("Lullaby") ---------------------------------------------------

export function renderLullaby(rate: number, seed = 1): { st: Stereo; events: VisualNote[] } {
  const bpm = 84;
  const beat = 60 / bpm;
  const bar = beat * 3;
  const bars = 24;
  const loop = bars * bar;
  const [L, R] = buffers(loop + 6, rate);
  const rand = mulberry32(seed * 13 + 1);
  const box = { partials: [1, 2.01, 3.98, 5.95], amps: [1, 0.35, 0.18, 0.08], decays: [1.6, 0.8, 0.35, 0.2] };
  const scale = [77, 79, 81, 82, 84, 86, 88, 89]; // F major, upper register
  const chordRoots = [65, 70, 72, 65, 62, 70, 72, 65]; // F Bb C F Dm Bb C F (low notes, music box bass)
  const events: VisualNote[] = [];
  let i = 2;
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const root = chordRoots[b % 8];
    struck(L, R, rate, { f: hz(root - 12), start: t0, dur: bar * 1.2, amp: 0.2, pan: -0.2, ...box });
    events.push({ t: t0, dur: bar, midi: root - 12, vel: 0.4 });
    const phraseEnd = b % 4 === 3;
    const pattern = phraseEnd ? [0] : rand() < 0.5 ? [0, 1, 2] : [0, 2];
    for (const k of pattern) {
      i = Math.max(0, Math.min(scale.length - 1, i + [-1, 1, -2, 1, 0, -1][Math.floor(rand() * 6)]));
      const m = phraseEnd ? scale[b % 8 === 7 ? 0 : 4] : scale[i];
      const st = t0 + k * beat;
      struck(L, R, rate, { f: hz(m), start: st, dur: beat * 3, amp: 0.22, pan: 0.2, ...box });
      events.push({ t: st, dur: beat * 1.5, midi: m, vel: 0.6 });
    }
  }
  reverb(L, R, rate, 0.3, 0.8);
  const lf = Math.round(loop * rate);
  return { st: [foldLoop(L, lf), foldLoop(R, lf)], events };
}

// --- Warm strings -----------------------------------------------------------

export function renderStrings(rate: number, seed = 1): { st: Stereo; events: VisualNote[] } {
  const loop = 64;
  const [L, R] = buffers(loop + 10, rate);
  const rand = mulberry32(seed * 17 + 5);
  const bow = table(Array.from({ length: 14 }, (_, h) => (1 / (h + 1)) * Math.exp(-h / 7)));
  // D - Bm - G - A, 8 s each, twice; four voices with smooth voice leading.
  const chords = [
    [38, 57, 62, 66], [35, 54, 62, 66], [31, 55, 59, 67], [33, 57, 61, 64],
    [38, 57, 62, 69], [35, 54, 59, 66], [31, 55, 62, 67], [33, 52, 61, 69],
  ];
  const events: VisualNote[] = [];
  const voicePan = [-0.15, -0.45, 0.45, 0.2];
  chords.forEach((ch, ci) => {
    ch.forEach((m, v) => {
      const amp = [0.11, 0.07, 0.07, 0.085][v];
      for (const det of [-0.0022, 0.0, 0.0024]) {
        wtNote(L, R, rate, bow, {
          f: hz(m), start: ci * 8 + (v === 0 ? 0 : 0.15 * v), dur: 9.2, amp, pan: voicePan[v] + det * 60,
          att: 1.4, rel: 2.2, detune: det, vib: v === 0 ? 0.0015 : 0.0028, vibRate: 5 + v * 0.2 + rand() * 0.2, vibDelay: 0.5,
        });
      }
      events.push({ t: ci * 8 + 0.15 * v, dur: 8, midi: m, vel: 0.6 });
    });
  });
  reverb(L, R, rate, 0.35, 0.86, 0.45);
  lowpass(L, 6500, rate);
  lowpass(R, 6500, rate);
  const lf = Math.round(loop * rate);
  return { st: [foldLoop(L, lf), foldLoop(R, lf)], events };
}

