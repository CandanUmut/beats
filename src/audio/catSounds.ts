// The cat's voice: a soft purr and a gentle meow, synthesized with Web Audio
// (no recordings). Quiet by design, and scaled by the app volume.

import { ensureAudio } from './engine';

function out(ac: AudioContext, gain: number): GainNode {
  const g = ac.createGain();
  g.gain.value = gain;
  g.connect(ac.destination);
  return g;
}

/** A purr: low rumbling pulses (~25 per second) in slow "breaths". */
export async function purr(seconds: number, volume: number): Promise<void> {
  const ac = await ensureAudio();
  const t0 = ac.currentTime + 0.02;
  const len = Math.max(0.5, seconds);
  const n = Math.round(ac.sampleRate * (len + 0.2));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / ac.sampleRate;
    // Breath cycle: purr on the in- and out-breath with a tiny gap.
    const cyc = (t % 1.6) / 1.6;
    const breath = Math.sin(Math.PI * Math.min(1, cyc / 0.48)) * (cyc < 0.48 ? 1 : 0) + 0.8 * Math.sin(Math.PI * Math.max(0, (cyc - 0.52) / 0.48)) * (cyc > 0.52 ? 1 : 0);
    const pulse = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 24 * t)), 3);
    lp += 0.08 * ((Math.random() * 2 - 1) - lp);
    d[i] = lp * pulse * breath * 2.2;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 600; // enough upper rumble to come through phone speakers
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(1, t0 + 0.3);
  env.gain.setValueAtTime(1, t0 + len - 0.4);
  env.gain.linearRampToValueAtTime(0, t0 + len);
  src.connect(filt).connect(env).connect(out(ac, 1.2 * volume)); // ~6 LU under the music at the same volume
  src.start(t0);
  src.stop(t0 + len + 0.1);
}

/** A short, soft meow: a voiced glide shaped by two vowel-like filters. */
export async function meow(volume: number, variant = Math.random()): Promise<void> {
  const ac = await ensureAudio();
  const t0 = ac.currentTime + 0.02;
  const dur = 0.55 + variant * 0.25;
  const base = 520 + variant * 160;
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(base * 0.85, t0);
  osc.frequency.linearRampToValueAtTime(base * 1.35, t0 + dur * 0.35);
  osc.frequency.exponentialRampToValueAtTime(base * 0.75, t0 + dur);
  // Vowel shaping: "mi-a-ow" by sweeping two band-pass formants.
  const f1 = ac.createBiquadFilter();
  f1.type = 'bandpass';
  f1.Q.value = 6;
  f1.frequency.setValueAtTime(900, t0);
  f1.frequency.linearRampToValueAtTime(1300, t0 + dur * 0.4);
  f1.frequency.linearRampToValueAtTime(700, t0 + dur);
  const f2 = ac.createBiquadFilter();
  f2.type = 'bandpass';
  f2.Q.value = 8;
  f2.frequency.setValueAtTime(2400, t0);
  f2.frequency.linearRampToValueAtTime(1900, t0 + dur);
  const mix = ac.createGain();
  mix.gain.value = 1;
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(1, t0 + 0.06);
  env.gain.setValueAtTime(1, t0 + dur * 0.6);
  env.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.connect(f1).connect(mix);
  osc.connect(f2).connect(mix);
  mix.connect(env).connect(out(ac, 0.22 * volume));
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}
