import { describe, expect, it } from 'vitest';
import { binomialP, blockSchedule, mean, median, pairedCI, pairedPower, pairsFromSchedule, permutationP, sd, tCdf, tQuantile } from '../src/lab/stats';

describe('basic stats', () => {
  it('mean, sd, median', () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBe(5);
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 4);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe('Student t', () => {
  it('matches standard table values', () => {
    expect(tQuantile(0.975, 1)).toBeCloseTo(12.706, 2);
    expect(tQuantile(0.975, 10)).toBeCloseTo(2.228, 3);
    expect(tQuantile(0.975, 29)).toBeCloseTo(2.045, 3);
    expect(tQuantile(0.975, 1000)).toBeCloseTo(1.962, 3);
    expect(tCdf(0, 5)).toBeCloseTo(0.5, 10);
    expect(tCdf(2.015, 5)).toBeCloseTo(0.95, 3);
  });
});

describe('paired comparison', () => {
  it('reproduces a hand-checked example', () => {
    // diffs: mean 1, sd sqrt(2.5) = 1.5811, n = 5, se = 0.7071, t4 = 2.776
    const r = pairedCI([1, -1, 2, 0, 3]);
    expect(r.meanDiff).toBe(1);
    expect(r.sdDiff).toBeCloseTo(1.5811, 4);
    expect(r.ciLow).toBeCloseTo(1 - 2.7764 * 0.70711, 3);
    expect(r.ciHigh).toBeCloseTo(1 + 2.7764 * 0.70711, 3);
    // t = 1.4142, df 4 -> two-sided p = 0.2302
    expect(r.tP).toBeCloseTo(0.2302, 3);
  });
  it('exact sign-flip permutation p matches a hand count', () => {
    // [1,2,3]: sums of +-1 +-2 +-3: |sum| >= 6 only for all-plus or all-minus -> 2/8.
    expect(permutationP([1, 2, 3]).p).toBeCloseTo(0.25, 10);
    expect(permutationP([1, 2, 3]).exact).toBe(true);
    // All zero -> p = 1.
    expect(permutationP([0, 0, 0, 0]).p).toBe(1);
  });
  it('Monte Carlo permutation is close to the t-test for many pairs', () => {
    const d = Array.from({ length: 30 }, (_, i) => Math.sin(i * 1.7) * 2 + 0.6);
    const mc = permutationP(d);
    expect(mc.exact).toBe(false);
    expect(Math.abs(mc.p - pairedCI(d).tP)).toBeLessThan(0.03);
  });
});

describe('binomial (blinding guesses)', () => {
  it('two-sided exact test', () => {
    expect(binomialP(5, 10)).toBeCloseTo(1, 10);
    expect(binomialP(9, 10)).toBeCloseTo(0.021484, 5);
    expect(binomialP(0, 10)).toBeCloseTo(0.001953, 5);
  });
});

describe('randomization', () => {
  it('blocks of 4 are balanced ABBA/BAAB and reproducible from the seed', () => {
    const s = blockSchedule(30, 42);
    expect(s).toHaveLength(60);
    expect(s.filter((x) => x === 'A')).toHaveLength(30);
    for (let b = 0; b < 60; b += 4) {
      const blk = s.slice(b, b + 4).join('');
      expect(['ABBA', 'BAAB']).toContain(blk);
    }
    expect(blockSchedule(30, 42)).toEqual(s);
    expect(blockSchedule(30, 43)).not.toEqual(s);
  });
  it('pairs sessions within blocks', () => {
    const p = pairsFromSchedule(['A', 'B', 'B', 'A', 'B', 'A', 'A', 'B']);
    expect(p).toEqual([[0, 1], [3, 2], [5, 4], [6, 7]]);
  });
});

describe('power', () => {
  it('about 34 pairs give 80% power for d = 0.5 (the research figure)', () => {
    expect(pairedPower(34, 0.5)).toBeGreaterThan(0.78);
    expect(pairedPower(34, 0.5)).toBeLessThan(0.83);
    expect(pairedPower(15, 0.8)).toBeGreaterThan(0.78);
  });
});
