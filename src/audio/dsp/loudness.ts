// ITU-R BS.1770-4 loudness (LUFS) and true-peak measurement.
// K-weighting filter design follows the sample-rate-independent formulas
// used by libebur128, so it matches the standard at 48 kHz and works at
// 44.1 kHz and other rates.

export interface Biquad {
  b0: number; b1: number; b2: number; a1: number; a2: number;
}

export function kWeighting(rate: number): [Biquad, Biquad] {
  // Stage 1: high-shelf (head effects).
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / rate);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Stage 2: high-pass (RLB).
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / rate);
  a0 = 1 + K / Q + K * K;
  const hp: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  return [shelf, hp];
}

/** K-weighting gain in dB at one frequency (both stages). */
export function kGainDb(freq: number, rate: number): number {
  const w = (2 * Math.PI * freq) / rate;
  let mag = 1;
  for (const f of kWeighting(rate)) {
    // |H(e^jw)| for a biquad.
    const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
    const nr = f.b0 + f.b1 * c1 + f.b2 * c2, ni = -(f.b1 * s1 + f.b2 * s2);
    const dr = 1 + f.a1 * c1 + f.a2 * c2, di = -(f.a1 * s1 + f.a2 * s2);
    mag *= Math.hypot(nr, ni) / Math.hypot(dr, di);
  }
  return 20 * Math.log10(mag);
}

function filter(x: Float32Array, f: Biquad): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = f.b0 * xi + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = yi;
    y[i] = yi;
  }
  return y;
}

/** Integrated loudness in LUFS, with the absolute (-70) and relative (-10 LU) gates. */
export function integratedLoudness(channels: Float32Array[], rate: number): number {
  const [s1, s2] = kWeighting(rate);
  const weighted = channels.map((c) => {
    const a = filter(c, s1);
    // Second stage in double precision.
    const y = new Float64Array(a.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < a.length; i++) {
      const xi = a[i];
      const yi = s2.b0 * xi + s2.b1 * x1 + s2.b2 * x2 - s2.a1 * y1 - s2.a2 * y2;
      x2 = x1; x1 = xi; y2 = y1; y1 = yi;
      y[i] = yi;
    }
    return y;
  });
  const n = channels[0].length;
  const block = Math.round(0.4 * rate);
  const step = Math.round(0.1 * rate);
  if (n < block) return -Infinity;
  // Prefix sums of squares make each 400 ms block O(1).
  const prefix = weighted.map((w) => {
    const p = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) p[i + 1] = p[i] + w[i] * w[i];
    return p;
  });
  const z: number[] = [];
  for (let start = 0; start + block <= n; start += step) {
    let sum = 0;
    for (const p of prefix) sum += (p[start + block] - p[start]) / block;
    z.push(sum);
  }
  const lk = (ms: number) => -0.691 + 10 * Math.log10(ms);
  const abs = z.filter((ms) => lk(ms) > -70);
  if (abs.length === 0) return -Infinity;
  const relGate = lk(mean(abs)) - 10;
  const rel = abs.filter((ms) => lk(ms) > relGate);
  if (rel.length === 0) return -Infinity;
  return lk(mean(rel));
}

function mean(a: number[]): number {
  let s = 0;
  for (const v of a) s += v;
  return s / a.length;
}

// --- True peak (BS.1770-4 Annex 2: 4x oversampling) ---------------------

const TP_TAPS_PER_PHASE = 12;
const TP_PHASES = 4;

/** Polyphase windowed-sinc interpolation filter for 4x oversampling. */
export const TRUE_PEAK_FIR: Float64Array[] = (() => {
  const total = TP_TAPS_PER_PHASE * TP_PHASES;
  const h = new Float64Array(total);
  const center = (total - 1) / 2;
  for (let i = 0; i < total; i++) {
    const x = (i - center) / TP_PHASES;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    // Kaiser-like smooth window (Blackman) keeps ripple small.
    const w =
      0.42 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / total) +
      0.08 * Math.cos((4 * Math.PI * (i + 0.5)) / total);
    h[i] = sinc * w;
  }
  const phases: Float64Array[] = [];
  for (let p = 0; p < TP_PHASES; p++) {
    const ph = new Float64Array(TP_TAPS_PER_PHASE);
    let sum = 0;
    for (let k = 0; k < TP_TAPS_PER_PHASE; k++) {
      ph[k] = h[k * TP_PHASES + p];
      sum += ph[k];
    }
    // Normalize each phase to unity DC gain.
    for (let k = 0; k < TP_TAPS_PER_PHASE; k++) ph[k] /= sum;
    phases.push(ph);
  }
  return phases;
})();

export const TRUE_PEAK_DELAY = TP_TAPS_PER_PHASE / 2;

/** Maximum true-peak level (linear) over all channels. */
export function truePeak(channels: Float32Array[]): number {
  let peak = 0;
  for (const x of channels) {
    for (let i = 0; i < x.length; i++) {
      const a = Math.abs(x[i]);
      if (a > peak) peak = a;
    }
    for (let i = 0; i + TP_TAPS_PER_PHASE <= x.length; i++) {
      for (const ph of TRUE_PEAK_FIR) {
        let s = 0;
        for (let k = 0; k < TP_TAPS_PER_PHASE; k++) s += ph[k] * x[i + k];
        const a = Math.abs(s);
        if (a > peak) peak = a;
      }
    }
  }
  return peak;
}

export const dbToLin = (db: number) => Math.pow(10, db / 20);
export const linToDb = (lin: number) => 20 * Math.log10(lin);

export const TARGET_LUFS = -20;
export const CEILING_DBTP = -1;
