// The whole session signal chain as one pure, block-based processor.
// The same class runs inside the AudioWorklet (live) and inside a Worker
// (export), and the unit tests run it directly. One code path, so what you
// hear, what you export and what is tested are the same thing.
//
// Chain:  (music + noise) -> breathing swell -> pulse (AM) -> + binaural carriers
//         -> session fade -> true-peak limiter -> volume

import { breathAt, swellGain, type BreathPattern } from './breath';
import { TruePeakLimiter } from './limiter';
import { dbToLin, kGainDb, TARGET_LUFS } from './loudness';

export interface LoopBuffer {
  left: Float32Array;
  right: Float32Array;
}

export type RhythmMode = 'off' | 'pulse' | 'binaural';

export interface MixParams {
  musicGainDb: number;
  noiseGainDb: number;
  breath: { enabled: boolean; pattern: BreathPattern; depthDb: number };
  rhythm: {
    mode: RhythmMode;
    /** Beat / pulse rate in Hz (for binaural this is delta-f). */
    rate: number;
    /** Pulse depth 0..0.4. */
    depth: number;
    /** Binaural carrier centre frequency, Hz. */
    carrier: number;
    /** Binaural carrier level relative to the music, dB (-30..-12). */
    levelDb: number;
  };
  /** Linear output volume after the limiter, 0..1. */
  volume: number;
}

export interface SessionTiming {
  /** Total length in seconds (the session stops after this). */
  duration: number;
  fadeIn: number;
  /** Fade-out length at the end. Sleep uses a long one. */
  fadeOut: number;
}

export const DEFAULT_PARAMS: MixParams = {
  musicGainDb: 0,
  noiseGainDb: -12,
  breath: { enabled: true, pattern: { id: 'none', segments: [{ phase: 'in', seconds: 5, to: 1 }, { phase: 'out', seconds: 5, to: 0 }] }, depthDb: 4 },
  rhythm: { mode: 'off', rate: 6, depth: 0.15, carrier: 220, levelDb: -15 },
  volume: 0.7,
};

/** One-pole smoother so parameter changes never jump (no zipper noise). */
class Smooth {
  value: number;
  target: number;
  private readonly k: number;
  constructor(v: number, rate: number, ms = 60) {
    this.value = v;
    this.target = v;
    this.k = 1 - Math.exp(-1 / ((ms / 1000) * rate));
  }
  step(): number {
    this.value += this.k * (this.target - this.value);
    return this.value;
  }
}

export class SessionMixer {
  readonly rate: number;
  private music: LoopBuffer | null = null;
  private noise: LoopBuffer | null = null;
  private musicPos = 0;
  private noisePos = 0;
  private params: MixParams;
  private timing: SessionTiming;
  private limiter: TruePeakLimiter;
  /** Frames rendered since start (session clock). */
  frame = 0;
  private stopAt = -1;
  private stopLen = 0;
  finished = false;
  // Smoothed gains.
  private gMusic: Smooth;
  private gNoise: Smooth;
  private gVol: Smooth;
  private gDepth: Smooth;
  private gCarrier: Smooth;
  private gBreathDepth: Smooth;
  private gSwell: Smooth;
  // Sound swap: fade the old sound out, swap, fade the new one in.
  private pendingMusic: LoopBuffer | null | undefined = undefined;
  private swapLen: number;
  private swapPos = 0;
  // Phase-continuous oscillators.
  private phaseL = 0;
  private phaseR = 0;
  private phaseAm = 0;

  constructor(rate: number, params: MixParams, timing: SessionTiming) {
    this.rate = rate;
    this.params = params;
    this.timing = timing;
    this.limiter = new TruePeakLimiter(rate);
    const p = params;
    this.gMusic = new Smooth(dbToLin(p.musicGainDb), rate);
    this.gNoise = new Smooth(dbToLin(p.noiseGainDb), rate);
    this.gVol = new Smooth(p.volume, rate, 80);
    this.gDepth = new Smooth(p.rhythm.mode === 'pulse' ? p.rhythm.depth : 0, rate, 200);
    this.gCarrier = new Smooth(this.carrierAmp(p), rate, 200);
    this.gBreathDepth = new Smooth(p.breath.enabled ? p.breath.depthDb : 0, rate, 300);
    this.gSwell = new Smooth(1, rate, 40);
    this.swapLen = Math.round(0.35 * rate);
  }

  get latency(): number {
    return this.limiter.latency;
  }

  get time(): number {
    return this.frame / this.rate;
  }

  get limiterMinGain(): number {
    return this.limiter.minGain;
  }

  /** Change the music. Before the first sample it switches at once; later it crossfades through silence. */
  setMusic(b: LoopBuffer | null): void {
    if (this.frame === 0 || !this.music) {
      this.music = b;
      this.musicPos = 0;
      this.pendingMusic = undefined;
      return;
    }
    this.pendingMusic = b;
    if (this.swapPos === 0) this.swapPos = 1;
  }

  setNoise(b: LoopBuffer | null): void {
    this.noise = b;
    this.noisePos = 0;
  }

  setParams(p: MixParams): void {
    this.params = p;
    this.gMusic.target = this.music ? dbToLin(p.musicGainDb) : 0;
    this.gNoise.target = dbToLin(p.noiseGainDb);
    this.gVol.target = p.volume;
    this.gDepth.target = p.rhythm.mode === 'pulse' ? p.rhythm.depth : 0;
    this.gCarrier.target = this.carrierAmp(p);
    this.gBreathDepth.target = p.breath.enabled ? p.breath.depthDb : 0;
  }

  setTiming(t: SessionTiming): void {
    this.timing = t;
  }

  /** Begin a smooth stop now. */
  stop(seconds = 2.5): void {
    if (this.stopAt >= 0) return;
    this.stopAt = this.frame;
    this.stopLen = Math.max(1, Math.round(seconds * this.rate));
  }

  private carrierAmp(p: MixParams): number {
    if (p.rhythm.mode !== 'binaural') return 0;
    const level = Math.min(-12, Math.max(-30, p.rhythm.levelDb));
    // Two sines of amplitude A (one per ear) measure 20*log10(A) - 0.691 + K(f)
    // LUFS, where K(f) is the K-weighting gain at the carrier. Solve for A so the
    // carriers sit exactly `level` dB relative to the -20 LUFS music.
    return dbToLin(TARGET_LUFS + level + 0.691 - kGainDb(p.rhythm.carrier, this.rate));
  }

  /** Session envelope (fade in, fade out, early stop) at a frame. */
  private envelope(f: number): number {
    const r = this.rate;
    const { duration, fadeIn, fadeOut } = this.timing;
    const total = Math.round(duration * r);
    if (f >= total) return 0;
    let e = 1;
    const fi = Math.round(fadeIn * r);
    if (f < fi) e = 0.5 - 0.5 * Math.cos((Math.PI * f) / fi);
    const fo = Math.round(fadeOut * r);
    const left = total - f;
    if (left < fo) e *= 0.5 - 0.5 * Math.cos((Math.PI * left) / fo);
    if (this.stopAt >= 0) {
      const k = f - this.stopAt;
      if (k >= this.stopLen) return 0;
      e *= 0.5 + 0.5 * Math.cos((Math.PI * k) / this.stopLen);
    }
    return e;
  }

  /** Render `frames` samples into outL/outR (overwrites). */
  process(outL: Float32Array, outR: Float32Array, frames: number): void {
    const p = this.params;
    const r = this.rate;
    const twoPi = 2 * Math.PI;
    let m = this.music;
    const n = this.noise;
    const wAm = (twoPi * p.rhythm.rate) / r;
    const fL = p.rhythm.carrier - p.rhythm.rate / 2;
    const fR = p.rhythm.carrier + p.rhythm.rate / 2;
    const wL = (twoPi * fL) / r;
    const wR = (twoPi * fR) / r;
    const breathOn = p.breath.enabled || this.gBreathDepth.value > 0.001;
    for (let i = 0; i < frames; i++) {
      const f = this.frame + i;
      let l = 0, rr = 0;
      let gm = this.gMusic.step();
      if (this.swapPos > 0) {
        // 1..swapLen: fading out; swapLen..2*swapLen: fading in.
        const k = this.swapPos;
        if (k === this.swapLen && this.pendingMusic !== undefined) {
          this.music = this.pendingMusic;
          this.pendingMusic = undefined;
          this.musicPos = 0;
          m = this.music;
        }
        const u = k <= this.swapLen ? 1 - k / this.swapLen : (k - this.swapLen) / this.swapLen;
        gm *= 0.5 - 0.5 * Math.cos(Math.PI * u);
        this.swapPos = k >= 2 * this.swapLen ? 0 : k + 1;
      }
      if (m) {
        l += m.left[this.musicPos] * gm;
        rr += m.right[this.musicPos] * gm;
        if (++this.musicPos >= m.left.length) this.musicPos = 0;
      }
      const gn = this.gNoise.step();
      if (n) {
        l += n.left[this.noisePos] * gn;
        rr += n.right[this.noisePos] * gn;
        if (++this.noisePos >= n.left.length) this.noisePos = 0;
      }
      // Breathing swell (computed every sample: cheap and exactly in time).
      const bd = this.gBreathDepth.step();
      if (breathOn && bd > 0.001) {
        this.gSwell.target = swellGain(breathAt(p.breath.pattern, f / r).level, bd);
      } else {
        this.gSwell.target = 1;
      }
      const sw = this.gSwell.step();
      l *= sw;
      rr *= sw;
      // Pulse: raised-cosine amplitude modulation, 1 - m(0.5 - 0.5cos).
      const depth = this.gDepth.step();
      // Power-matched: divide by the RMS of the modulator so the pulse (and
      // its depth-0 sham) play at the same average loudness.
      const amNorm = 1 / Math.sqrt((1 - depth / 2) ** 2 + (depth * depth) / 8);
      const am = (1 - depth * (0.5 - 0.5 * Math.cos(this.phaseAm))) * amNorm;
      this.phaseAm += wAm;
      if (this.phaseAm > twoPi) this.phaseAm -= twoPi;
      l *= am;
      rr *= am;
      // Binaural carriers, hard-panned, phase-continuous.
      const ca = this.gCarrier.step();
      if (ca > 1e-7) {
        l += ca * Math.sin(this.phaseL);
        rr += ca * Math.sin(this.phaseR);
      }
      this.phaseL += wL;
      if (this.phaseL > twoPi) this.phaseL -= twoPi;
      this.phaseR += wR;
      if (this.phaseR > twoPi) this.phaseR -= twoPi;

      const e = this.envelope(f);
      outL[i] = l * e;
      outR[i] = rr * e;
    }
    this.frame += frames;
    this.limiter.process(outL, outR, frames);
    for (let i = 0; i < frames; i++) {
      const v = this.gVol.step();
      outL[i] *= v;
      outR[i] *= v;
    }
    const end = Math.round(this.timing.duration * r);
    if (this.frame >= end + this.limiter.latency) this.finished = true;
    if (this.stopAt >= 0 && this.frame >= this.stopAt + this.stopLen + this.limiter.latency) this.finished = true;
  }
}
