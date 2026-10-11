import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PianoSampler, ScorePlayer, type SampleRegion } from '../src/audio/dsp/sampler';
import { parseMidi } from '../src/music/midi';
import { perform } from '../src/music/perform';
import { reverie } from '../src/music/generative';
import { buildScore } from '../src/music/score';
import { PIECES, SOUNDS, carrierFor } from '../src/music/catalog';
import gains from '../src/music/gains.json';

const rate = 48000;

/** Synthetic "piano" sample: a decaying C4 with a smooth start and a loop. */
function region(): SampleRegion {
  const n = rate * 3;
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    d[i] = Math.sin(2 * Math.PI * 261.6256 * t) * Math.exp(-t / 1.5) * Math.min(1, i / 200);
  }
  return { lo: 21, hi: 108, center: 60, data: d, rate, loopStart: Math.round(rate * 2), loopEnd: Math.round(rate * 2) + Math.round(rate / 261.6256) * 20 };
}

function freqOf(x: Float32Array): number {
  let crossings = 0, first = -1, last = -1;
  for (let i = 1; i < x.length; i++) {
    if (x[i - 1] <= 0 && x[i] > 0) { if (first < 0) first = i; last = i; crossings++; }
  }
  return ((crossings - 1) * rate) / (last - first);
}

function render(s: PianoSampler, frames: number): Float32Array {
  const out = new Float32Array(frames);
  const o: [number, number] = [0, 0];
  for (let i = 0; i < frames; i++) { s.tick(o); out[i] = o[0]; }
  return out;
}

describe('piano sampler', () => {
  it('transposes to the right pitch', () => {
    const s = new PianoSampler(rate, [region()]);
    s.noteOn(64, 1);
    const f = freqOf(render(s, rate / 2));
    expect(f).toBeCloseTo(329.63, 0);
  });
  it('has no clicks on attack, release, re-strike or voice stealing', () => {
    const s = new PianoSampler(rate, [region()]);
    const out = new Float32Array(rate * 3);
    const o: [number, number] = [0, 0];
    let peak = 0, maxD2 = 0;
    for (let i = 0; i < out.length; i++) {
      if (i === 100) for (let m = 40; m < 95; m++) s.noteOn(m, 0.8); // forces stealing
      if (i === rate / 2) s.noteOn(60, 1); // re-strike a sounding key
      if (i === rate) for (let m = 40; m < 95; m++) s.noteOff(m);
      s.tick(o);
      out[i] = o[0];
      peak = Math.max(peak, Math.abs(o[0]));
      if (i >= 2) maxD2 = Math.max(maxD2, Math.abs(out[i] - 2 * out[i - 1] + out[i - 2]));
    }
    const wMax = (2 * Math.PI * 440 * Math.pow(2, (94 - 69) / 12)) / rate;
    // A click shows up as a second difference far above what the highest note can produce.
    expect(maxD2).toBeLessThan(peak * wMax * wMax * 4);
    expect(s.active).toBeLessThanOrEqual(40);
  });
  it('releases fade out and voices are freed', () => {
    const s = new PianoSampler(rate, [region()]);
    s.noteOn(60, 1);
    render(s, rate / 4);
    s.noteOff(60);
    const tail = render(s, rate);
    expect(Math.abs(tail[tail.length - 1])).toBeLessThan(1e-3);
    expect(s.active).toBe(0);
  });
  it('score player is deterministic and loops', () => {
    const notes = [{ t: 0.1, release: 0.5, midi: 60, vel: 0.7, gain: 1 }, { t: 0.6, release: 0.9, midi: 67, vel: 0.7, gain: 1 }];
    const a = new ScorePlayer(rate, [region()], notes, 1.2);
    const b = new ScorePlayer(rate, [region()], notes, 1.2);
    const n = Math.round(rate * 2.5);
    const L1 = new Float32Array(n), R1 = new Float32Array(n), L2 = new Float32Array(n), R2 = new Float32Array(n);
    a.render(L1, R1, n);
    b.render(L2, R2, n);
    expect(L1).toEqual(L2);
    // Second pass starts sounding again at 1.2 + 0.1 s.
    expect(Math.abs(L1[Math.round(1.25 * rate)])).toBeLessThan(Math.abs(L1[Math.round(1.32 * rate)]) + 1);
    expect(a.time).toBeCloseTo(2.5 - 2 * 1.2, 2);
  });
});

describe('performance (humanize + pedal)', () => {
  const m = parseMidi(new Uint8Array(readFileSync('public/music/midi/gymnopedie_1.mid')));
  const p = perform(m, { tempo: 0.92 });
  it('keeps notes in order, inside the piece, and releases after key-up', () => {
    for (let i = 1; i < p.notes.length; i++) expect(p.notes[i].t).toBeGreaterThanOrEqual(p.notes[i - 1].t);
    for (const n of p.notes) {
      expect(n.release).toBeGreaterThanOrEqual(n.keyUp);
      expect(n.vel).toBeGreaterThan(0);
      expect(n.vel).toBeLessThanOrEqual(1);
    }
    expect(p.duration).toBeGreaterThan(m.duration / 0.92 * 0.95);
  });
  it('adds pedal when the file has none (short notes ring past key-up)', () => {
    const noct = parseMidi(new Uint8Array(readFileSync('public/music/midi/chopin_nocturne_op9_n2.mid')));
    expect(noct.pedal.length).toBe(0);
    const pn = perform(noct, { tempo: 0.9, pedalPerBar: 2 });
    const extended = pn.notes.filter((n) => n.release > n.keyUp + 0.05).length;
    expect(extended / pn.notes.length).toBeGreaterThan(0.3);
  });
  it('is deterministic', () => {
    expect(perform(m, { tempo: 0.92 })).toEqual(p);
  });
});

describe('music library', () => {
  it('every piece has a MIDI file, a license and a loudness gain', () => {
    for (const p of PIECES) {
      expect(readFileSync(`public/music/midi/${p.file}`).length).toBeGreaterThan(1000);
      expect(['Public Domain', 'CC BY-SA 2.5', 'CC BY-SA 3.0', 'CC BY-SA 4.0']).toContain(p.license);
      expect((gains as Record<string, number>)[p.id]).toBeTypeOf('number');
    }
    expect((gains as Record<string, number>).reverie).toBeTypeOf('number');
  });
  it('no NC or ND licenses anywhere', () => {
    for (const s of SOUNDS) expect(s.license).not.toMatch(/NC|ND/);
  });
  it('a classical pick plays its whole collection as a playlist', async () => {
    const sc = await buildScore('piece:chopin-noct-9-2', async (f) => new Uint8Array(readFileSync(`public/music/midi/${f}`)));
    expect(sc.parts.map((x) => x.title)[0]).toContain('Op. 9 No. 2');
    expect(sc.parts.length).toBe(PIECES.filter((p) => p.collection === 'Chopin: Nocturnes').length);
    expect(sc.length).toBeGreaterThan(600);
    expect(sc.visual.length).toBe(sc.notes.length);
  });
  it('Reverie is long and in D', () => {
    const r = reverie();
    expect(r.duration).toBeGreaterThan(180);
    expect(r.notes.length).toBeGreaterThan(300);
  });
  it('beat carrier is tuned to the key and stays in 150-450 Hz', () => {
    for (let pc = 0; pc < 12; pc++) {
      const f = carrierFor(pc);
      expect(f).toBeGreaterThanOrEqual(150);
      expect(f).toBeLessThanOrEqual(450);
      const semis = 12 * Math.log2(f / 440) + 69;
      expect(((Math.round(semis) % 12) + 12) % 12).toBe(pc);
    }
    expect(carrierFor(9)).toBeCloseTo(220, 1);
  });
});
