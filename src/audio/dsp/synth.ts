// Generative sound library. Everything is synthesized from code, so there
// are no copyright questions. Each render returns a seamless stereo loop
// normalized to the target loudness.

import { brownNoise, crossfadeLoop, foldLoop, highpass, lowpass, pinkNoise } from './noise';
import { integratedLoudness, dbToLin, TARGET_LUFS } from './loudness';
import { mulberry32 } from './random';
import { renderAurora, renderLofi, renderLullaby, renderStrings, type VisualNote } from './styles';

export type TrackId = 'drift' | 'hush' | 'rain' | 'pink' | 'brown' | 'lofi' | 'aurora' | 'lullaby' | 'strings';

export interface TrackInfo {
  id: TrackId;
  name: string;
  kind: 'music' | 'noise';
  blurb: string;
  /** Approximate loop length in seconds. */
  loop: number;
}

export const TRACKS: TrackInfo[] = [
  { id: 'drift', name: 'Drift', kind: 'music', loop: 96, blurb: 'Slow pentatonic piano-like notes over a soft pad, about 60 BPM.' },
  { id: 'hush', name: 'Hush', kind: 'music', loop: 60, blurb: 'A warm, slowly moving drone. No melody, no surprises.' },
  { id: 'lofi', name: 'Lo-fi chill', kind: 'music', loop: (16 * 4 * 60) / 72, blurb: 'Warm electric piano, soft swung drums and vinyl hiss, 72 BPM.' },
  { id: 'aurora', name: 'Aurora', kind: 'music', loop: 64, blurb: 'Slow, wide ambient pads with distant bells.' },
  { id: 'lullaby', name: 'Lullaby', kind: 'music', loop: (24 * 3 * 60) / 84, blurb: 'A gentle music box waltz in F major.' },
  { id: 'strings', name: 'Warm strings', kind: 'music', loop: 64, blurb: 'A slow string quartet texture: cello, viola and violins.' },
  { id: 'rain', name: 'Soft rain', kind: 'noise', loop: 40, blurb: 'Synthesized steady rain with gentle drops.' },
  { id: 'pink', name: 'Pink noise', kind: 'noise', loop: 30, blurb: 'Even, soft hiss. Good for masking distractions.' },
  { id: 'brown', name: 'Brown noise', kind: 'noise', loop: 30, blurb: 'Deeper, rumbling noise. Softer on the ears than pink.' },
];

export interface RenderedTrack {
  id: TrackId;
  rate: number;
  left: Float32Array;
  right: Float32Array;
  /** Loudness of the rendered loop after normalization (LUFS). */
  lufs: number;
  /** Notes played (for animations), within the loop. */
  events: VisualNote[];
}

export function renderTrack(id: TrackId, rate: number, seed = 1): RenderedTrack {
  let st: [Float32Array, Float32Array];
  let events: VisualNote[] = [];
  const take = (r: { st: [Float32Array, Float32Array]; events: VisualNote[] }) => { events = r.events; return r.st; };
  switch (id) {
    case 'drift': st = take(renderDrift(rate, seed)); break;
    case 'lofi': st = take(renderLofi(rate, seed)); break;
    case 'aurora': st = take(renderAurora(rate, seed)); break;
    case 'lullaby': st = take(renderLullaby(rate, seed)); break;
    case 'strings': st = take(renderStrings(rate, seed)); break;
    case 'hush': st = renderHush(rate); break;
    case 'rain': st = renderRain(rate, seed); break;
    case 'pink': st = renderNoise(rate, 'pink', seed); break;
    case 'brown': st = renderNoise(rate, 'brown', seed); break;
  }
  const lufs = normalize(st, rate, TARGET_LUFS);
  return { id, rate, left: st[0], right: st[1], lufs, events };
}

/** Scale a stereo pair in place to the target integrated loudness. */
export function normalize(st: Float32Array[], rate: number, target: number): number {
  const measured = integratedLoudness(st, rate);
  if (!Number.isFinite(measured)) return measured;
  const g = dbToLin(target - measured);
  for (const ch of st) for (let i = 0; i < ch.length; i++) ch[i] *= g;
  return integratedLoudness(st, rate);
}

// --- Building blocks ------------------------------------------------------

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Round a frequency so it completes a whole number of cycles per loop. */
const onGrid = (f: number, loopSec: number) => Math.max(1, Math.round(f * loopSec)) / loopSec;

interface Note {
  freq: number;
  start: number; // seconds
  dur: number; // seconds
  vel: number;
  pan: number; // -1..1
  partials: number[];
  amps: number[];
  decay: number; // seconds (time constant of the first partial)
  attack: number;
}

/** Add a soft, bell/piano-like note. Smooth attack and release: no clicks. */
function addNote(L: Float32Array, R: Float32Array, rate: number, n: Note): void {
  const s0 = Math.round(n.start * rate);
  const len = Math.round(n.dur * rate);
  const att = Math.max(1, Math.round(n.attack * rate));
  const rel = Math.round(Math.min(0.6, n.dur * 0.25) * rate);
  const gl = Math.cos(((n.pan + 1) * Math.PI) / 4) * n.vel;
  const gr = Math.sin(((n.pan + 1) * Math.PI) / 4) * n.vel;
  const ws = n.partials.map((p) => (2 * Math.PI * n.freq * p) / rate);
  const ds = n.partials.map((_, k) => Math.exp(-1 / ((n.decay / (1 + k * 0.8)) * rate)));
  const env = n.amps.slice();
  // Rotating phasors avoid calling Math.sin per sample per partial.
  const c = ws.map((w) => Math.cos(w));
  const s = ws.map((w) => Math.sin(w));
  const re = ws.map(() => 1);
  const im = ws.map(() => 0);
  const end = Math.min(L.length, s0 + len);
  for (let i = s0; i < end; i++) {
    const t = i - s0;
    let v = 0;
    for (let k = 0; k < ws.length; k++) {
      v += im[k] * env[k];
      env[k] *= ds[k];
      const r = re[k] * c[k] - im[k] * s[k];
      im[k] = re[k] * s[k] + im[k] * c[k];
      re[k] = r;
    }
    let a = 1;
    if (t < att) a = 0.5 - 0.5 * Math.cos((Math.PI * t) / att);
    const fromEnd = len - t;
    if (fromEnd < rel) a *= 0.5 - 0.5 * Math.cos((Math.PI * fromEnd) / rel);
    v *= a;
    L[i] += v * gl;
    R[i] += v * gr;
  }
}

/** Small stereo reverb (Freeverb-style combs + allpasses). */
export function reverb(L: Float32Array, R: Float32Array, rate: number, mix = 0.28, room = 0.82, damp = 0.35): void {
  const sc = rate / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const aps = [556, 441, 341, 225];
  const spread = 23;
  const run = (input: Float32Array, off: number): Float32Array => {
    const out = new Float32Array(input.length);
    for (const len0 of combs) {
      const len = Math.round((len0 + off) * sc);
      const buf = new Float32Array(len);
      let pos = 0;
      let store = 0;
      for (let i = 0; i < input.length; i++) {
        const y = buf[pos];
        store = y * (1 - damp) + store * damp;
        buf[pos] = input[i] * 0.015 + store * room;
        pos = pos + 1 === len ? 0 : pos + 1;
        out[i] += y;
      }
    }
    for (const len0 of aps) {
      const len = Math.round((len0 + off) * sc);
      const buf = new Float32Array(len);
      let pos = 0;
      for (let i = 0; i < out.length; i++) {
        const b = buf[pos];
        const x = out[i];
        buf[pos] = x + b * 0.5;
        out[i] = b - x;
        pos = pos + 1 === len ? 0 : pos + 1;
      }
    }
    return out;
  };
  const mono = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5;
  const wl = run(mono, 0);
  const wr = run(mono, spread);
  for (let i = 0; i < L.length; i++) {
    L[i] = L[i] * (1 - mix) + wl[i] * mix * 3;
    R[i] = R[i] * (1 - mix) + wr[i] * mix * 3;
  }
}

// --- Tracks ----------------------------------------------------------------

/** "Drift": generative D-major pentatonic notes at ~60 BPM over a soft pad. */
function renderDrift(rate: number, seed: number): { st: [Float32Array, Float32Array]; events: VisualNote[] } {
  const events: VisualNote[] = [];
  const loop = 96;
  const tail = 10;
  const frames = Math.round((loop + tail) * rate);
  const L = new Float32Array(frames);
  const R = new Float32Array(frames);
  const rand = mulberry32(seed * 7919 + 17);
  const scale = [0, 2, 4, 7, 9];
  const melody: number[] = [];
  for (let oct = 0; oct < 3; oct++) for (const s of scale) melody.push(62 + oct * 12 + s);
  const top = melody.indexOf(81);
  let idx = 5; // D5
  const beat = 1; // 60 BPM
  for (let b = 0; b < loop; b++) {
    if (rand() > 0.48) continue;
    const step = [-2, -1, -1, 1, 1, 2, 0][Math.floor(rand() * 7)];
    idx = Math.min(top, Math.max(0, idx + step));
    const start = b * beat + (rand() < 0.25 ? 0.5 : 0) + rand() * 0.02;
    const vel = 0.18 + rand() * 0.16;
    events.push({ t: start, dur: 2.5, midi: melody[idx], vel: vel * 2 });
    addNote(L, R, rate, {
      freq: midiToHz(melody[idx]),
      start,
      dur: 4.5 + rand() * 2.5,
      vel,
      pan: (rand() - 0.5) * 0.9,
      partials: [1, 2, 3, 4.02],
      amps: [1, 0.32, 0.1, 0.04],
      decay: 1.6,
      attack: 0.012,
    });
    if (rand() < 0.18 && idx >= 3) {
      addNote(L, R, rate, {
        freq: midiToHz(melody[idx - 2]),
        start: start + 0.03,
        dur: 4.5,
        vel: vel * 0.5,
        pan: (rand() - 0.5) * 0.9,
        partials: [1, 2, 3],
        amps: [1, 0.25, 0.08],
        decay: 1.4,
        attack: 0.012,
      });
    }
  }
  // Pad: one chord every 16 beats.
  const chords = [
    [38, 45, 50, 54], // D
    [35, 42, 47, 50], // Bm
    [31, 38, 43, 47], // G
    [33, 40, 45, 49], // A
    [38, 45, 50, 54], // D
    [35, 42, 47, 50], // Bm
  ];
  chords.forEach((ch, ci) => {
    for (const m of ch) {
      for (const det of [-0.08, 0.08]) {
        addPad(L, R, rate, midiToHz(m) * (1 + det / 100), ci * 16, 18.5, 0.045, det > 0 ? 0.4 : -0.4);
      }
    }
  });
  reverb(L, R, rate, 0.3);
  const loopFrames = Math.round(loop * rate);
  return { st: [foldLoop(L, loopFrames), foldLoop(R, loopFrames)], events };
}

function addPad(L: Float32Array, R: Float32Array, rate: number, f: number, start: number, dur: number, amp: number, pan: number): void {
  const s0 = Math.round(start * rate);
  const len = Math.round(dur * rate);
  const fade = Math.round(4 * rate);
  const gl = Math.cos(((pan + 1) * Math.PI) / 4) * amp;
  const gr = Math.sin(((pan + 1) * Math.PI) / 4) * amp;
  const table = PAD_TABLE;
  const N = table.length - 1;
  const inc = (f / rate) * N;
  let ph = 0;
  for (let i = 0; i < len && s0 + i < L.length; i++) {
    const j = ph | 0;
    let v = table[j] + (table[j + 1] - table[j]) * (ph - j);
    ph += inc;
    if (ph >= N) ph -= N;
    let a = 1;
    if (i < fade) a = 0.5 - 0.5 * Math.cos((Math.PI * i) / fade);
    if (len - i < fade) a *= 0.5 - 0.5 * Math.cos((Math.PI * (len - i)) / fade);
    v *= a;
    L[s0 + i] += v * gl;
    R[s0 + i] += v * gr;
  }
}

/** One cycle of a harmonic mix, with a guard sample for interpolation. */
function makeTable(amps: number[], size = 4096): Float32Array {
  const t = new Float32Array(size + 1);
  for (let i = 0; i <= size; i++) {
    let v = 0;
    for (let h = 0; h < amps.length; h++) v += amps[h] * Math.sin((2 * Math.PI * (h + 1) * i) / size);
    t[i] = v;
  }
  return t;
}

const PAD_TABLE = makeTable([1, 1 / 4, 1 / 9, 1 / 16, 1 / 25]);
const DRONE_TABLE = makeTable([1, 1 / 8, 1 / 27, 1 / 64]);

/** Rotating-phasor sine oscillator, renormalized now and then to stay exact. */
function phasor(w: number, phase = 0) {
  const c = Math.cos(w), s = Math.sin(w);
  let re = Math.cos(phase), im = Math.sin(phase);
  let n = 0;
  return {
    next(): number {
      const out = im;
      const r = re * c - im * s;
      im = re * s + im * c;
      re = r;
      if (++n === 4096) {
        n = 0;
        const m = 1 / Math.hypot(re, im);
        re *= m; im *= m;
      }
      return out;
    },
  };
}

/** "Hush": a slowly breathing drone on D. All rates fit the loop exactly. */
function renderHush(rate: number): [Float32Array, Float32Array] {
  const loop = 60;
  const frames = Math.round(loop * rate);
  const L = new Float32Array(frames);
  const R = new Float32Array(frames);
  const voices = [
    { m: 38, a: 0.5 }, { m: 45, a: 0.32 }, { m: 50, a: 0.22 }, { m: 57, a: 0.12 }, { m: 54, a: 0.07 },
  ];
  voices.forEach((v, vi) => {
    for (const det of [-1, 1]) {
      const f = onGrid(midiToHz(v.m) + det * 0.09, loop);
      // Slow swell: whole number of cycles per loop (2, 3, 4, ...).
      const lfo = (2 + vi) / loop;
      const ph = vi * 1.3 + (det > 0 ? 1.7 : 0);
      const pan = det * 0.35;
      const gl = Math.cos(((pan + 1) * Math.PI) / 4);
      const gr = Math.sin(((pan + 1) * Math.PI) / 4);
      const N = DRONE_TABLE.length - 1;
      const inc = (f / rate) * N;
      let p = 0;
      const mod = phasor((2 * Math.PI * lfo) / rate, ph);
      for (let i = 0; i < frames; i++) {
        const j = p | 0;
        const s = DRONE_TABLE[j] + (DRONE_TABLE[j + 1] - DRONE_TABLE[j]) * (p - j);
        p += inc;
        if (p >= N) p -= N;
        const a = v.a * (0.6 + 0.4 * mod.next());
        L[i] += s * a * gl;
        R[i] += s * a * gr;
      }
    }
  });
  // Render twice through the reverb and keep the second pass, so the reverb
  // is already "full" at the loop start.
  const L2 = new Float32Array(frames * 2);
  const R2 = new Float32Array(frames * 2);
  L2.set(L); L2.set(L, frames);
  R2.set(R); R2.set(R, frames);
  reverb(L2, R2, rate, 0.35, 0.86);
  return [L2.slice(frames), R2.slice(frames)];
}

function renderRain(rate: number, seed: number): [Float32Array, Float32Array] {
  const loop = 40;
  const xf = 3;
  const frames = Math.round((loop + xf) * rate);
  const rand = mulberry32(seed * 31 + 5);
  const ch = [pinkNoise(frames, seed * 11 + 1), pinkNoise(frames, seed * 11 + 2)];
  for (const c of ch) {
    lowpass(c, 4200, rate);
    highpass(c, 180, rate);
  }
  // Gentle, slow intensity drift (+-1.5 dB).
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    const g = dbToLin(1.5 * Math.sin(2 * Math.PI * 0.031 * t) * Math.sin(2 * Math.PI * 0.013 * t + 1));
    ch[0][i] *= g;
    ch[1][i] *= g;
  }
  // Drops: short soft bursts of filtered noise.
  const drops = Math.round((loop + xf) * 9);
  const burst = pinkNoise(Math.round(0.03 * rate), seed + 99);
  for (let d = 0; d < drops; d++) {
    const s0 = Math.floor(rand() * (frames - burst.length));
    const len = Math.round((0.006 + rand() * 0.018) * rate);
    const amp = 0.25 + rand() * 0.6;
    const pan = rand() * 2 - 1;
    const gl = Math.cos(((pan + 1) * Math.PI) / 4) * amp;
    const gr = Math.sin(((pan + 1) * Math.PI) / 4) * amp;
    for (let i = 0; i < len; i++) {
      const e = Math.sin((Math.PI * i) / len) ** 2;
      const v = burst[i] * e;
      ch[0][s0 + i] += v * gl;
      ch[1][s0 + i] += v * gr;
    }
  }
  const loopFrames = Math.round(loop * rate);
  return [crossfadeLoop(ch[0], loopFrames), crossfadeLoop(ch[1], loopFrames)];
}

function renderNoise(rate: number, kind: 'pink' | 'brown', seed: number): [Float32Array, Float32Array] {
  const loop = 30;
  const xf = 2;
  const frames = Math.round((loop + xf) * rate);
  const gen = kind === 'pink' ? pinkNoise : brownNoise;
  const a = gen(frames, seed * 13 + 1);
  const b = gen(frames, seed * 13 + 2);
  if (kind === 'pink') {
    // Take the harsh top off a little.
    lowpass(a, 9000, rate);
    lowpass(b, 9000, rate);
  }
  const loopFrames = Math.round(loop * rate);
  return [crossfadeLoop(a, loopFrames), crossfadeLoop(b, loopFrames)];
}
