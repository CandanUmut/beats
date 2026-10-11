export function sine(freq: number, rate: number, seconds: number, amp = 1, phase = 0): Float32Array {
  const n = Math.round(rate * seconds);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / rate + phase);
  return x;
}

/** Largest absolute second difference: spikes here are audible clicks. */
export function maxSecondDiff(x: Float32Array, from = 1, to = x.length - 1): number {
  let m = 0;
  for (let i = Math.max(1, from); i < Math.min(x.length - 1, to); i++) {
    const d = Math.abs(x[i + 1] - 2 * x[i] + x[i - 1]);
    if (d > m) m = d;
  }
  return m;
}

export function rms(x: Float32Array, from = 0, to = x.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, to - from));
}
