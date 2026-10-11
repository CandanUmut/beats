// Statistics for N-of-1 experiments. Pure functions, tested against known
// answers in tests/stats.test.ts.

import { mulberry32 } from '../audio/dsp/random';

export function mean(x: number[]): number {
  return x.reduce((a, b) => a + b, 0) / x.length;
}

/** Sample standard deviation (n - 1). */
export function sd(x: number[]): number {
  if (x.length < 2) return NaN;
  const m = mean(x);
  return Math.sqrt(x.reduce((a, v) => a + (v - m) ** 2, 0) / (x.length - 1));
}

export function median(x: number[]): number {
  if (x.length === 0) return NaN;
  const s = [...x].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

// --- Student t distribution -----------------------------------------------

function logGamma(z: number): number {
  // Lanczos approximation (g = 7, n = 9).
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Regularized incomplete beta I_x(a, b), via Lentz's continued fraction. */
export function incBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x > (a + 1) / (a + b + 2)) return 1 - incBeta(1 - x, b, a);
  const tiny = 1e-300;
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return (bt * h) / a;
}

/** CDF of Student's t with df degrees of freedom. */
export function tCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  const tail = 0.5 * incBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Quantile of Student's t (bisection on the CDF). */
export function tQuantile(p: number, df: number): number {
  let lo = -1000, hi = 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface PairedResult {
  n: number;
  meanDiff: number;
  sdDiff: number;
  ciLow: number;
  ciHigh: number;
  /** Two-sided paired t-test p-value. */
  tP: number;
  /** Standardized effect d_z = mean / sd of differences. */
  dz: number;
}

/** Paired comparison of differences (active - control). */
export function pairedCI(diffs: number[], level = 0.95): PairedResult {
  const n = diffs.length;
  const m = mean(diffs);
  const s = sd(diffs);
  if (n < 2) return { n, meanDiff: m, sdDiff: NaN, ciLow: NaN, ciHigh: NaN, tP: NaN, dz: NaN };
  const se = s / Math.sqrt(n);
  const q = tQuantile(1 - (1 - level) / 2, n - 1);
  const t = se > 0 ? m / se : m === 0 ? 0 : Infinity * Math.sign(m);
  const tP = se > 0 ? 2 * (1 - tCdf(Math.abs(t), n - 1)) : m === 0 ? 1 : 0;
  return { n, meanDiff: m, sdDiff: s, ciLow: m - q * se, ciHigh: m + q * se, tP, dz: s > 0 ? m / s : NaN };
}

/**
 * Sign-flip permutation test on paired differences (two-sided). Exact for
 * n <= 18, otherwise Monte Carlo with a fixed seed (reproducible).
 */
export function permutationP(diffs: number[], iterations = 20000, seed = 7): { p: number; exact: boolean } {
  const n = diffs.length;
  if (n === 0) return { p: NaN, exact: true };
  const obs = Math.abs(diffs.reduce((a, b) => a + b, 0));
  const eps = 1e-9;
  if (n <= 18) {
    let count = 0;
    const total = 1 << n;
    for (let mask = 0; mask < total; mask++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += mask & (1 << i) ? -diffs[i] : diffs[i];
      if (Math.abs(s) >= obs - eps) count++;
    }
    return { p: count / total, exact: true };
  }
  const rand = mulberry32(seed);
  let count = 0;
  for (let k = 0; k < iterations; k++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += rand() < 0.5 ? -diffs[i] : diffs[i];
    if (Math.abs(s) >= obs - eps) count++;
  }
  return { p: (count + 1) / (iterations + 1), exact: false };
}

/** Two-sided exact binomial test against p = 0.5. */
export function binomialP(k: number, n: number): number {
  if (n === 0) return 1;
  const logC = (n_: number, k_: number) => logGamma(n_ + 1) - logGamma(k_ + 1) - logGamma(n_ - k_ + 1);
  const pk = (i: number) => Math.exp(logC(n, i) - n * Math.LN2);
  const obs = pk(k);
  let p = 0;
  for (let i = 0; i <= n; i++) if (pk(i) <= obs * (1 + 1e-9)) p += pk(i);
  return Math.min(1, p);
}

// --- Randomization ---------------------------------------------------------

export type Arm = 'A' | 'B';

/** Balanced blocks of 4: each block is ABBA or BAAB, chosen by a seeded coin. */
export function blockSchedule(pairs: number, seed: number): Arm[] {
  const rand = mulberry32(seed);
  const out: Arm[] = [];
  const blocks = Math.ceil(pairs / 2);
  for (let b = 0; b < blocks; b++) {
    const block: Arm[] = rand() < 0.5 ? ['A', 'B', 'B', 'A'] : ['B', 'A', 'A', 'B'];
    out.push(...block);
  }
  return out.slice(0, pairs * 2);
}

/**
 * Pair sessions within each block of 4: first A with first B, second A with
 * second B. Returns [indexA, indexB] pairs over the schedule positions.
 */
export function pairsFromSchedule(schedule: Arm[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let b = 0; b < schedule.length; b += 4) {
    const a: number[] = [], c: number[] = [];
    for (let i = b; i < Math.min(b + 4, schedule.length); i++) (schedule[i] === 'A' ? a : c).push(i);
    for (let k = 0; k < Math.min(a.length, c.length); k++) pairs.push([a[k], c[k]]);
  }
  return pairs;
}

/** Approximate power of a two-sided paired t-test for effect size dz. */
export function pairedPower(n: number, dz: number, alpha = 0.05): number {
  if (n < 2) return 0;
  const df = n - 1;
  const crit = tQuantile(1 - alpha / 2, df);
  const ncp = dz * Math.sqrt(n);
  // Normal approximation to the noncentral t.
  const z = (crit - ncp) / Math.sqrt(1 + (crit * crit) / (2 * df));
  return 1 - normCdf(z);
}

export function normCdf(z: number): number {
  // Abramowitz-Stegun 7.1.26 via erf.
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
