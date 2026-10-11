import { describe, expect, it } from 'vitest';
import { renderTrack, TRACKS } from '../src/audio/dsp/synth';
import { integratedLoudness } from '../src/audio/dsp/loudness';
import { maxSecondDiff } from './helpers';

const rate = 48000;

describe('generative tracks', () => {
  for (const t of TRACKS) {
    it(`${t.id}: renders a ${t.loop.toFixed(1)}s loop at -20 LUFS (+-1 LU) with no seam click`, () => {
      const t0 = performance.now();
      const tr = renderTrack(t.id, rate);
      const ms = performance.now() - t0;
      expect(tr.left.length).toBe(Math.round(t.loop * rate));
      expect(Math.abs(integratedLoudness([tr.left, tr.right], rate) + 20)).toBeLessThanOrEqual(1);
      // Seam: join the end to the start and compare the second difference
      // at the join with the loop's own normal maximum.
      for (const ch of [tr.left, tr.right]) {
        const n = ch.length;
        const joined = new Float32Array(400);
        joined.set(ch.subarray(n - 200));
        joined.set(ch.subarray(0, 200), 200);
        const atSeam = maxSecondDiff(joined, 190, 210);
        const normal = maxSecondDiff(ch);
        expect(atSeam).toBeLessThanOrEqual(normal * 1.01);
      }
      console.log(`${t.id}: ${ms.toFixed(0)} ms`);
    }, 60000);
  }
});
