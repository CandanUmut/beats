import { describe, expect, it } from 'vitest';
import { MOODS, STRENGTH } from '../src/data/moods';

// SAFETY.md promises headphone beat tones sit at least 12 dB below the music.
describe('mood recipes match SAFETY.md', () => {
  it('every beat strength puts headphone tones at least 12 dB below the music', () => {
    for (const s of Object.values(STRENGTH)) expect(s.levelDb).toBeLessThanOrEqual(-12);
  });

  it('every mood can be played with no beat in the taste test', () => {
    for (const m of MOODS) expect(m.tasteBeats).toContain(0);
  });
});
