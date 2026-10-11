// Turns a score (MIDI notes) into a gentle "performance": slightly slower
// tempo, small human timing and loudness variations, a little phrase
// breathing (rubato), a final slowing down, and sustain pedal (from the file,
// or added automatically per bar or half bar).

import type { MidiFile } from './midi';
import { mulberry32, gaussian } from '../audio/dsp/random';

export interface PerfNote {
  /** Onset, seconds from the start of the piece. */
  t: number;
  /** When the sound is released (key up and pedal up), seconds. */
  release: number;
  /** When the key goes up (for the animation), seconds. */
  keyUp: number;
  midi: number;
  /** 0..1 loudness. */
  vel: number;
}

export interface Performance {
  notes: PerfNote[];
  duration: number;
}

export interface PerformOptions {
  /** 1 = as written; 0.9 = 10% slower. */
  tempo?: number;
  seed?: number;
  /** Force automatic pedal even if the file has pedal marks. */
  autoPedal?: boolean;
  /** Pedal changes per bar: 1 or 2. */
  pedalPerBar?: 1 | 2;
  /** Rubato strength 0..1. */
  rubato?: number;
}

export function perform(m: MidiFile, o: PerformOptions = {}): Performance {
  const tempo = o.tempo ?? 0.94;
  const rand = mulberry32(o.seed ?? 11);
  const rubato = o.rubato ?? 0.6;
  const barLen = m.bars.length > 1 ? m.bars[1] - m.bars[0] : 2;
  const phrase = barLen * 4;

  // Smooth, monotonic time warp: gentle push-and-pull over 4-bar phrases,
  // plus a final ritardando over the last 2 bars.
  const end = m.duration;
  const A = ((rubato * 0.06) * phrase) / (2 * Math.PI); // max local tempo change ~6%
  const warp = (t: number) => {
    let w = t + A * Math.sin((2 * Math.PI * t) / phrase);
    const ritStart = end - 2 * barLen;
    if (t > ritStart) {
      const u = (t - ritStart) / (2 * barLen);
      w += 0.25 * 2 * barLen * (u * u * u) / 3; // up to ~25% slower at the very end
    }
    return w / tempo;
  };

  // Group notes that start together (chords) so they move as one.
  const groups = new Map<number, number>();
  const notes: PerfNote[] = [];
  const raw = m.notes;
  let maxVel = 1;
  for (const n of raw) maxVel = Math.max(maxVel, n.vel);
  for (let i = 0; i < raw.length; i++) {
    const n = raw[i];
    const key = Math.round(n.t * 100);
    if (!groups.has(key)) groups.set(key, gaussian(rand) * 0.007);
    const jitter = groups.get(key)! + rand() * 0.006; // tiny roll inside a chord
    const t = Math.max(0, warp(n.t) + jitter);
    const keyUp = Math.max(t + 0.05, warp(n.t + n.dur) - 0.01);
    // Highest note of a chord sings a little more; low notes a little less.
    const chordTop = raw.filter((x) => Math.abs(x.t - n.t) < 0.01).reduce((a, x) => Math.max(a, x.midi), 0);
    let vel = (n.vel / maxVel) * 0.8;
    if (n.midi === chordTop) vel *= 1.12;
    if (n.midi < 52) vel *= 0.85;
    vel *= 1 + gaussian(rand) * 0.05;
    notes.push({ t, keyUp, release: keyUp, midi: n.midi, vel: Math.min(1, Math.max(0.08, vel)) });
  }
  notes.sort((a, b) => a.t - b.t);

  // Pedal intervals (down..up) in performed time.
  const intervals: [number, number][] = [];
  if (m.pedal.length && !o.autoPedal) {
    let down: number | null = null;
    for (const p of m.pedal) {
      if (p.down && down === null) down = warp(p.t);
      else if (!p.down && down !== null) { intervals.push([down, warp(p.t)]); down = null; }
    }
    if (down !== null) intervals.push([down, warp(end) + 2]);
  } else {
    const per = o.pedalPerBar ?? 1;
    for (let b = 0; b < m.bars.length; b++) {
      const s = m.bars[b];
      const e = m.bars[b + 1] ?? end;
      for (let k = 0; k < per; k++) {
        const ps = s + ((e - s) * k) / per;
        const pe = s + ((e - s) * (k + 1)) / per;
        intervals.push([warp(ps) + 0.06, warp(pe) - 0.02]);
      }
    }
  }
  // Extend releases while the pedal is down.
  for (const n of notes) {
    for (const [a, b] of intervals) {
      if (n.keyUp >= a && n.keyUp < b) { n.release = Math.max(n.release, b); break; }
    }
  }
  const duration = Math.max(...notes.map((n) => n.release)) + 1.5;
  return { notes, duration };
}
