// The cat's voice: recordings of a real cat (CC0, BigSoundBank / Joseph Sardin;
// see ATTRIBUTION.md), with a synthesized stand-in if they can't be loaded.
// Kept well under the music: about 6 LU quieter at the same volume setting.

import { ensureAudio } from './engine';

const MEOWS = ['meow1', 'meow2', 'meow3', 'meow4'];
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function load(ac: AudioContext, name: string): Promise<AudioBuffer | null> {
  let p = buffers.get(name);
  if (!p) {
    p = fetch(new URL(`samples/cat/${name}.flac`, document.baseURI))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((d) => ac.decodeAudioData(d))
      .catch(() => null);
    buffers.set(name, p);
  }
  return p;
}

/** Fetch and decode the cat's sounds ahead of time, so the first pet isn't silent. */
export async function warmCatSounds(): Promise<void> {
  const ac = await ensureAudio();
  await Promise.all([...MEOWS, 'purr'].map((n) => load(ac, n)));
}

function out(ac: AudioContext, gain: number): GainNode {
  const g = ac.createGain();
  g.gain.value = gain;
  g.connect(ac.destination);
  return g;
}

// --- Purr -------------------------------------------------------------------

let current: { env: GainNode; src: AudioBufferSourceNode; until: number } | null = null;

/** Purr for (at least) `seconds` more. Petting again keeps the same purr going. */
export async function purr(seconds: number, volume: number): Promise<void> {
  const ac = await ensureAudio();
  const now = ac.currentTime;
  const until = now + Math.max(1, seconds);
  if (current && current.until > now + 0.1) {
    // Extend the purr that's already playing: move its fade-out later.
    const { env } = current;
    env.gain.cancelScheduledValues(now);
    env.gain.setValueAtTime(env.gain.value, now);
    env.gain.linearRampToValueAtTime(1, now + 0.2);
    env.gain.setValueAtTime(1, until - 0.6);
    env.gain.linearRampToValueAtTime(0, until);
    current.src.stop(until + 0.05);
    current.until = until;
    return;
  }
  const buf = await load(ac, 'purr');
  if (!buf) return synthPurr(ac, seconds, volume);
  const t0 = ac.currentTime + 0.02;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = 0.4;
  src.loopEnd = buf.duration - 0.4;
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(1, t0 + 0.5);
  env.gain.setValueAtTime(1, until - 0.6);
  env.gain.linearRampToValueAtTime(0, until);
  src.connect(env).connect(out(ac, 0.7 * volume));
  const offset = 0.4 + Math.random() * (buf.duration - 1.2);
  src.start(t0, offset);
  src.stop(until + 0.05);
  const me = { env, src, until };
  current = me;
  src.onended = () => { if (current === me) current = null; };
}

// --- Meow -------------------------------------------------------------------

let lastMeow = -1;

/** A short, soft meow, picked from a few recordings and very slightly varied. */
export async function meow(volume: number): Promise<void> {
  const ac = await ensureAudio();
  let i = Math.floor(Math.random() * MEOWS.length);
  if (i === lastMeow) i = (i + 1) % MEOWS.length;
  lastMeow = i;
  const buf = await load(ac, MEOWS[i]);
  if (!buf) return synthMeow(ac, volume);
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 0.96 + Math.random() * 0.1;
  src.connect(out(ac, 0.5 * volume));
  src.start(ac.currentTime + 0.02);
}

// --- Synthesized stand-ins (offline before the files are cached) ------------

function synthPurr(ac: AudioContext, seconds: number, volume: number): void {
  const t0 = ac.currentTime + 0.02;
  const len = Math.max(0.5, seconds);
  const n = Math.round(ac.sampleRate * (len + 0.2));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / ac.sampleRate;
    const cyc = (t % 1.6) / 1.6;
    const breath = (cyc < 0.48 ? Math.sin(Math.PI * cyc / 0.48) : 0) + (cyc > 0.52 ? 0.8 * Math.sin(Math.PI * (cyc - 0.52) / 0.48) : 0);
    const pulse = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 24 * t)), 3);
    lp += 0.08 * ((Math.random() * 2 - 1) - lp);
    d[i] = lp * pulse * breath * 2.2;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 600;
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(1, t0 + 0.3);
  env.gain.setValueAtTime(1, t0 + len - 0.4);
  env.gain.linearRampToValueAtTime(0, t0 + len);
  src.connect(filt).connect(env).connect(out(ac, 1.2 * volume));
  src.start(t0);
  src.stop(t0 + len + 0.1);
}

function synthMeow(ac: AudioContext, volume: number): void {
  const t0 = ac.currentTime + 0.02;
  const v = Math.random();
  const dur = 0.55 + v * 0.25;
  const base = 520 + v * 160;
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(base * 0.85, t0);
  osc.frequency.linearRampToValueAtTime(base * 1.35, t0 + dur * 0.35);
  osc.frequency.exponentialRampToValueAtTime(base * 0.75, t0 + dur);
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
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(1, t0 + 0.06);
  env.gain.setValueAtTime(1, t0 + dur * 0.6);
  env.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.connect(f1).connect(env);
  osc.connect(f2).connect(env);
  env.connect(out(ac, 0.22 * volume));
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}
