// Look-ahead true-peak limiter (stereo-linked).
//
// How it works:
// 1. Estimate the true peak of each incoming sample with the same 4x
//    oversampling filter the meter uses.
// 2. Required gain g = min(1, ceiling / truePeak).
// 3. Take the minimum of g over the look-ahead window, then smooth it with a
//    moving average of the same length. Because every value in the averaging
//    window is already <= the gain a peak needs, the smoothed gain is also
//    <= that gain when the peak comes out of the delay line. The result has
//    no hard corners, so it does not click.
// 4. Release back up slowly (one-pole).
//
// The audio is delayed by the look-ahead so the gain is in place in time.

import { TRUE_PEAK_FIR, dbToLin } from './loudness';

const TAPS = TRUE_PEAK_FIR[0].length;

export class TruePeakLimiter {
  readonly latency: number;
  private readonly look: number;
  private readonly ceiling: number;
  private readonly releaseCoef: number;
  // Input history for the true-peak FIR, per channel.
  private hist: Float64Array[];
  private histPos = 0;
  // Audio delay line.
  private delay: Float32Array[];
  private delayPos = 0;
  // Sliding minimum (monotonic deque over a ring of [index, value]).
  private dqIdx: Int32Array;
  private dqVal: Float64Array;
  private dqHead = 0;
  private dqTail = 0;
  private readonly dqCap: number;
  // Moving average of the held minimum.
  private box: Float64Array;
  private boxPos = 0;
  private boxSum: number;
  private n = 0;
  private gain = 1;
  /** Lowest gain applied so far (for meters and tests). */
  minGain = 1;

  constructor(rate: number, ceilingDb = -1.2, lookaheadMs = 5, releaseMs = 250) {
    this.ceiling = dbToLin(ceilingDb);
    this.look = Math.max(4, Math.round((lookaheadMs / 1000) * rate));
    // The FIR estimate for a sample is ready TAPS/2 samples later.
    this.latency = this.look + Math.ceil(TAPS / 2);
    this.releaseCoef = 1 - Math.exp(-1 / ((releaseMs / 1000) * rate));
    this.hist = [new Float64Array(TAPS), new Float64Array(TAPS)];
    this.delay = [new Float32Array(this.latency + 1), new Float32Array(this.latency + 1)];
    this.dqCap = this.look + 8;
    this.dqIdx = new Int32Array(this.dqCap);
    this.dqVal = new Float64Array(this.dqCap);
    this.box = new Float64Array(this.look + 1).fill(1);
    this.boxSum = this.look + 1;
  }

  /** Process in place. Channels may be the same array for mono. */
  process(left: Float32Array, right: Float32Array, frames: number): void {
    const hl = this.hist[0], hr = this.hist[1];
    const dl = this.delay[0], dr = this.delay[1];
    const dlen = dl.length;
    for (let i = 0; i < frames; i++) {
      const xl = left[i], xr = right[i];
      // 1. True-peak estimate of the newest window.
      hl[this.histPos] = xl;
      hr[this.histPos] = xr;
      this.histPos = (this.histPos + 1) % TAPS;
      let peak = Math.max(Math.abs(xl), Math.abs(xr));
      for (let p = 0; p < TRUE_PEAK_FIR.length; p++) {
        const ph = TRUE_PEAK_FIR[p];
        let sl = 0, sr = 0;
        for (let k = 0; k < TAPS; k++) {
          const j = (this.histPos + k) % TAPS;
          sl += ph[k] * hl[j];
          sr += ph[k] * hr[j];
        }
        const a = Math.max(Math.abs(sl), Math.abs(sr));
        if (a > peak) peak = a;
      }
      const req = peak > this.ceiling ? this.ceiling / peak : 1;

      // 2. Sliding minimum over the last look+3 values.
      const idx = this.n++;
      while (this.dqTail !== this.dqHead) {
        const last = (this.dqTail - 1 + this.dqCap) % this.dqCap;
        if (this.dqVal[last] >= req) this.dqTail = last;
        else break;
      }
      this.dqIdx[this.dqTail] = idx;
      this.dqVal[this.dqTail] = req;
      this.dqTail = (this.dqTail + 1) % this.dqCap;
      // Hold a little longer than the averaging window so peaks that fall
      // between two output samples are covered for both of them.
      while (this.dqIdx[this.dqHead] <= idx - (this.look + 3)) {
        this.dqHead = (this.dqHead + 1) % this.dqCap;
      }
      const held = this.dqVal[this.dqHead];

      // 3. Moving average of the held minimum.
      this.boxSum += held - this.box[this.boxPos];
      this.box[this.boxPos] = held;
      this.boxPos = (this.boxPos + 1) % this.box.length;
      const smooth = Math.min(1, this.boxSum / this.box.length);

      // 4. Instant attack (already smooth), slow release.
      if (smooth < this.gain) this.gain = smooth;
      else this.gain += this.releaseCoef * (smooth - this.gain);
      if (this.gain < this.minGain) this.minGain = this.gain;

      // Delay the audio.
      dl[this.delayPos] = xl;
      dr[this.delayPos] = xr;
      const out = (this.delayPos + 1) % dlen;
      left[i] = dl[out] * this.gain;
      right[i] = dr[out] * this.gain;
      this.delayPos = out;
    }
  }
}
