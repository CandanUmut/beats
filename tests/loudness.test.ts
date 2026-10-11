import { describe, expect, it } from 'vitest';
import { integratedLoudness, truePeak, linToDb, dbToLin } from '../src/audio/dsp/loudness';
import { TruePeakLimiter } from '../src/audio/dsp/limiter';
import { sine } from './helpers';

describe('BS.1770 loudness meter', () => {
  for (const rate of [44100, 48000]) {
    it(`reads a -23 dBFS 1 kHz stereo sine as -23 LUFS at ${rate} Hz (EBU Tech 3341 case)`, () => {
      const x = sine(1000, rate, 20, dbToLin(-23));
      expect(integratedLoudness([x, x], rate)).toBeCloseTo(-23, 1);
    });
  }
  it('applies the relative gate (quiet passage does not drag the reading down)', () => {
    const rate = 48000;
    const loud = sine(1000, rate, 10, dbToLin(-20));
    const quiet = sine(1000, rate, 10, dbToLin(-50));
    const x = new Float32Array(loud.length + quiet.length);
    x.set(loud);
    x.set(quiet, loud.length);
    expect(integratedLoudness([x, x], rate)).toBeCloseTo(-20, 0);
  });
});

describe('true peak', () => {
  it('finds the inter-sample peak of a sine at fs/4 sampled at 45 degrees', () => {
    const rate = 48000;
    const x = sine(rate / 4, rate, 0.1, 1, Math.PI / 4);
    let samplePeak = 0;
    for (const v of x) samplePeak = Math.max(samplePeak, Math.abs(v));
    expect(linToDb(samplePeak)).toBeCloseTo(-3.01, 1);
    expect(Math.abs(linToDb(truePeak([x])))).toBeLessThan(0.3);
  });
});

describe('true-peak limiter', () => {
  it('keeps a hot signal at or below -1 dBTP', () => {
    const rate = 48000;
    const x = sine(997, rate, 2, 1.6);
    const y = sine(5003, rate, 2, 0.9, 1);
    for (let i = 0; i < x.length; i++) x[i] += y[i];
    // Add some sharp spikes.
    for (let i = 5000; i < x.length; i += 7919) x[i] = 1.9;
    const l = x.slice(), r = x.slice();
    const lim = new TruePeakLimiter(rate);
    lim.process(l, r, l.length);
    const tp = linToDb(truePeak([l.slice(lim.latency), r.slice(lim.latency)]));
    expect(tp).toBeLessThanOrEqual(-1);
  });
  it('leaves a quiet signal untouched apart from the delay', () => {
    const rate = 48000;
    const x = sine(440, rate, 0.5, 0.3);
    const l = x.slice(), r = x.slice();
    const lim = new TruePeakLimiter(rate);
    lim.process(l, r, l.length);
    for (let i = lim.latency; i < x.length; i++) expect(l[i]).toBeCloseTo(x[i - lim.latency], 6);
  });
});
