import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parseMidi, tonicPitchClass, PITCH_NAMES } from '../src/music/midi';

describe('MIDI reader', () => {
  for (const f of readdirSync('public/music/midi')) {
    it(`parses ${f}`, () => {
      const m = parseMidi(new Uint8Array(readFileSync(`public/music/midi/${f}`)));
      expect(m.notes.length).toBeGreaterThan(50);
      expect(m.duration).toBeGreaterThan(30);
      expect(m.duration).toBeLessThan(900);
      for (const n of m.notes) {
        expect(n.midi).toBeGreaterThanOrEqual(21);
        expect(n.midi).toBeLessThanOrEqual(108);
      }
      const key = m.key ? `${PITCH_NAMES[tonicPitchClass(m.key)]} ${m.key.minor ? 'minor' : 'major'}` : '?';
      console.log(`${f}: ${m.notes.length} notes, ${m.duration.toFixed(0)} s, key ${key}, ${m.timeSig?.num}/${m.timeSig?.den}, pedal events ${m.pedal.length}, tempo ${(60 / m.firstTempo).toFixed(0)} qpm`);
    });
  }
  it('knows key signatures', () => {
    expect(tonicPitchClass({ sf: -3, minor: false })).toBe(3); // E-flat major
    expect(tonicPitchClass({ sf: 1, minor: true })).toBe(4); // E minor
    expect(tonicPitchClass({ sf: 0, minor: false })).toBe(0);
  });
});
