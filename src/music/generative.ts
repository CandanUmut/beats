// "Reverie": an endless, generated piano piece in the spirit of a slow 3/4
// Gymnopédie, played through the real piano samples. Deterministic from a seed.

import { mulberry32 } from '../audio/dsp/random';
import type { PerfNote, Performance } from './perform';

const CHORDS: { root: number; tones: number[] }[] = [
  { root: 50, tones: [62, 66, 69, 73] }, // Dmaj7
  { root: 43, tones: [62, 66, 67, 71] }, // Gmaj7
  { root: 47, tones: [62, 66, 69, 71] }, // Bm7
  { root: 45, tones: [61, 64, 69, 71] }, // A(add9)
  { root: 50, tones: [62, 66, 69, 73] }, // Dmaj7
  { root: 43, tones: [62, 66, 67, 71] }, // Gmaj7
  { root: 40, tones: [62, 64, 67, 71] }, // Em7
  { root: 45, tones: [61, 64, 67, 69] }, // A7
];

const SCALE = [62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81];

export function reverie(seed = 3, bars = 64, bpm = 56): Performance {
  const rand = mulberry32(seed);
  const beat = 60 / bpm;
  const bar = beat * 3;
  const notes: PerfNote[] = [];
  let mel = 6; // index in SCALE
  for (let b = 0; b < bars; b++) {
    const c = CHORDS[b % CHORDS.length];
    const t0 = b * bar;
    const pedalUp = t0 + bar - 0.03;
    const j = () => (rand() - 0.5) * 0.02;
    // Left hand: low root on 1, a soft chord on 2.
    notes.push({ t: t0 + j(), keyUp: t0 + beat * 0.9, release: pedalUp, midi: c.root - (b % 4 === 0 ? 12 : 0) + (c.root < 45 ? 12 : 0), vel: 0.42 + rand() * 0.06 });
    const chordAt = t0 + beat + j();
    for (const tone of c.tones.slice(0, 3)) {
      notes.push({ t: chordAt + rand() * 0.012, keyUp: chordAt + beat * 1.6, release: pedalUp, midi: tone - 12 + (tone < 64 ? 12 : 0), vel: 0.26 + rand() * 0.05 });
    }
    // Right hand: a slow, singing melody. Rests now and then.
    const phrasePos = b % 8;
    if (phrasePos === 7 || rand() < 0.12) continue;
    const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(rand() * 7)];
    mel = Math.max(2, Math.min(SCALE.length - 1, mel + step));
    // Pull the melody toward a chord tone on the downbeat.
    const target = SCALE[mel];
    const tones = c.tones.map((x) => x + 12);
    const near = tones.reduce((a, x) => (Math.abs(x - target) < Math.abs(a - target) ? x : a), tones[0]);
    const m1 = rand() < 0.6 ? near : target;
    notes.push({ t: t0 + j(), keyUp: t0 + bar * 0.95, release: pedalUp, midi: m1, vel: 0.5 + rand() * 0.12 });
    if (rand() < 0.45) {
      const m2 = SCALE[Math.max(0, Math.min(SCALE.length - 1, SCALE.indexOf(SCALE[mel]) + (rand() < 0.5 ? -1 : 1)))];
      notes.push({ t: t0 + beat * 2 + j(), keyUp: t0 + bar * 0.98, release: pedalUp, midi: m2, vel: 0.4 + rand() * 0.1 });
    }
  }
  notes.sort((a, b) => a.t - b.t);
  return { notes, duration: bars * bar };
}
