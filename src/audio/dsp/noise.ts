// Pink and brown noise generators and loop helpers.

import { mulberry32 } from './random';

export type Stereo = [Float32Array, Float32Array];

/** Pink noise (Paul Kellet's refined filter), roughly -3 dB/octave. */
export function pinkNoise(frames: number, seed: number): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(frames);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < frames; i++) {
    const w = rand() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

/** Brown (red) noise: leaky integrated white noise, about -6 dB/octave. */
export function brownNoise(frames: number, seed: number): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(frames);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const w = rand() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    out[i] = last * 3.5;
  }
  // Remove any DC drift.
  let m = 0;
  for (let i = 0; i < frames; i++) m += out[i];
  m /= frames;
  for (let i = 0; i < frames; i++) out[i] -= m;
  return out;
}

/**
 * Turn a buffer of loop+xfade frames into a seamless loop of `loop` frames
 * using an equal-power crossfade (right for uncorrelated material like noise).
 */
export function crossfadeLoop(x: Float32Array, loop: number): Float32Array {
  const xf = x.length - loop;
  const out = x.slice(0, loop);
  for (let i = 0; i < xf; i++) {
    const u = (i + 0.5) / xf;
    const fadeIn = Math.sin((Math.PI / 2) * u);
    const fadeOut = Math.cos((Math.PI / 2) * u);
    out[i] = x[i] * fadeIn + x[loop + i] * fadeOut;
  }
  return out;
}

/**
 * Fold everything after `loop` back onto the start. For material where every
 * event already starts and ends smoothly (synth notes, reverb tails) this
 * gives a perfectly circular loop with no seam at all.
 */
export function foldLoop(x: Float32Array, loop: number): Float32Array {
  const out = x.slice(0, loop);
  for (let i = loop; i < x.length; i++) out[i % loop] += x[i];
  return out;
}

/** One-pole low-pass, in place. */
export function lowpass(x: Float32Array, cutoff: number, rate: number): void {
  const a = Math.exp((-2 * Math.PI * cutoff) / rate);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y = (1 - a) * x[i] + a * y;
    x[i] = y;
  }
}

/** One-pole high-pass, in place. */
export function highpass(x: Float32Array, cutoff: number, rate: number): void {
  const a = Math.exp((-2 * Math.PI * cutoff) / rate);
  let lp = 0;
  for (let i = 0; i < x.length; i++) {
    lp = (1 - a) * x[i] + a * lp;
    x[i] = x[i] - lp;
  }
}
