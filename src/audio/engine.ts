// Main-thread audio engine: owns the AudioContext, the mixer worklet and the
// background worker. UI code talks only to this module.

import { signal } from '@preact/signals';
import workletUrl from './worklet.ts?worker&url';
import type { WorkletIn, WorkletOut } from './worklet';
import type { WorkerIn, WorkerOut } from './worker';
import type { MixParams, SessionTiming } from './dsp/mixer';
import type { TrackId } from './dsp/synth';
import { db } from '../data/db';
import type { SampleRegion } from './dsp/sampler';
import { SOUND_BY_ID } from '../music/catalog';
import { buildScore, type BuiltScore, type VisualNote } from '../music/score';

export type EngineStatus = 'idle' | 'preparing' | 'playing' | 'stopping';

export const status = signal<EngineStatus>('idle');
export const preparingLabel = signal('');
/** Lowest limiter gain seen this session (1 = never engaged). */
export const limiterGain = signal(1);
export const audioError = signal<string | null>(null);

const TRACK_CACHE_VERSION = 4;

let ctx: AudioContext | null = null;
let node: AudioWorkletNode | null = null;
let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (m: WorkerOut) => void; reject: (e: Error) => void; progress?: (p: number) => void }>();
/** Main-thread copies of loaded buffers (for export), by key. */
const buffers = new Map<string, { left: Float32Array; right: Float32Array }>();
const loadedInWorklet = new Set<string>();
let regions: SampleRegion[] | null = null;
let regionsPromise: Promise<SampleRegion[]> | null = null;
const scores = new Map<string, BuiltScore>();
const trackEvents = new Map<string, VisualNote[]>();
let musicClock = { time: 0, at: 0 };
let startedAt = 0;
let latency = 0;
let onEnded: (() => void) | null = null;
let endedResolvers: (() => void)[] = [];

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      const p = pending.get(m.id);
      if (!p) return;
      if (m.type === 'progress') return p.progress?.(m.done);
      pending.delete(m.id);
      if (m.type === 'error') p.reject(new Error(m.message));
      else p.resolve(m);
    };
  }
  return worker;
}

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function call(msg: DistOmit<WorkerIn, 'id'>, transfer: Transferable[] = [], progress?: (p: number) => void): Promise<WorkerOut> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, progress });
    getWorker().postMessage({ ...msg, id }, transfer);
  });
}

/** Create/resume the AudioContext. Must be called from a tap (iOS rule). */
export async function ensureAudio(): Promise<AudioContext> {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: 'playback' });
    await ctx.audioWorklet.addModule(workletUrl);
    node = new AudioWorkletNode(ctx, 'steady-mixer', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    node.connect(ctx.destination);
    node.port.onmessage = (e: MessageEvent<WorkletOut>) => onWorklet(e.data);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running' && status.value === 'playing') ctx.resume();
    });
  }
  if (ctx.state !== 'running') await ctx.resume();
  return ctx;
}

export function sampleRate(): number {
  return ctx?.sampleRate ?? 48000;
}

function post(m: WorkletIn, transfer: Transferable[] = []) {
  node?.port.postMessage(m, transfer);
}

function onWorklet(m: WorkletOut) {
  if (m.type === 'started') {
    startedAt = m.at;
    latency = m.latency;
  } else if (m.type === 'tick') {
    limiterGain.value = m.limiter;
    musicClock = { time: m.musicTime, at: m.at };
  } else if (m.type === 'ended') {
    status.value = 'idle';
    clearMediaSession();
    const cb = onEnded;
    onEnded = null;
    cb?.();
    endedResolvers.forEach((r) => r());
    endedResolvers = [];
  }
}

/** Seconds since the session started, as heard (latency-corrected). */
export function sessionTime(): number {
  if (!ctx || status.value === 'idle' || status.value === 'preparing') return 0;
  const out = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
  return Math.max(0, ctx.currentTime - startedAt - latency - out - ctx.baseLatency);
}

async function sendToWorklet(key: string) {
  if (loadedInWorklet.has(key)) return;
  const b = buffers.get(key);
  if (!b) throw new Error(`No buffer ${key}`);
  // Send copies; the main thread keeps its own for export.
  const l = b.left.slice(), r = b.right.slice();
  post({ type: 'load', key, left: l, right: r }, [l.buffer, r.buffer]);
  loadedInWorklet.add(key);
}

/** Get a generative track (from cache or freshly rendered). */
export async function loadTrack(id: TrackId): Promise<string> {
  const rate = sampleRate();
  const key = `track:${id}:${rate}`;
  if (!buffers.has(key)) {
    const cacheKey = `${key}:v${TRACK_CACHE_VERSION}`;
    let cached: { left: Float32Array; right: Float32Array; events?: VisualNote[] } | undefined;
    try { cached = await db.get('cache', cacheKey); } catch { /* no storage */ }
    if (cached) {
      buffers.set(key, cached);
      trackEvents.set(key, cached.events ?? []);
    } else {
      const m = await call({ type: 'track', track: id, rate });
      if (m.type !== 'track') throw new Error('Unexpected worker reply');
      const b = { left: m.left, right: m.right, events: m.events };
      buffers.set(key, b);
      trackEvents.set(key, m.events);
      db.put('cache', b, cacheKey).catch(() => {});
    }
  }
  await sendToWorklet(key);
  return key;
}

/** Load and decode the piano samples once (CC0 FreePats Upright Piano KW). */
export async function loadPianoBank(): Promise<SampleRegion[]> {
  if (regions) return regions;
  if (!regionsPromise) {
    regionsPromise = (async () => {
      const ac = await ensureAudio();
      const base = new URL('samples/piano-kw/', document.baseURI);
      const bank = await (await fetch(new URL('bank.json', base))).json() as { regions: { lo: number; hi: number; center: number; file: string; loopStart?: number; loopEnd?: number }[] };
      const decoded = new Map<string, AudioBuffer>();
      await Promise.all([...new Set(bank.regions.map((r) => r.file))].map(async (f) => {
        const data = await (await fetch(new URL(f, base))).arrayBuffer();
        decoded.set(f, await ac.decodeAudioData(data));
      }));
      const out: SampleRegion[] = bank.regions.map((r) => {
        const buf = decoded.get(r.file)!;
        const ratio = buf.sampleRate / 44100;
        return {
          lo: r.lo, hi: r.hi, center: r.center, rate: buf.sampleRate, data: buf.getChannelData(0).slice(),
          loopStart: r.loopStart !== undefined ? Math.round(r.loopStart * ratio) : undefined,
          loopEnd: r.loopEnd !== undefined ? Math.round(r.loopEnd * ratio) : undefined,
        };
      });
      const copies = out.map((r) => ({ ...r, data: r.data.slice() }));
      post({ type: 'bank', regions: copies }, copies.map((r) => r.data.buffer));
      regions = out;
      return out;
    })();
  }
  return regionsPromise;
}

async function loadMidiFile(file: string): Promise<Uint8Array> {
  const res = await fetch(new URL(`music/midi/${file}`, document.baseURI));
  if (!res.ok) throw new Error(`Could not load ${file}`);
  return new Uint8Array(await res.arrayBuffer());
}

export interface LoadedSound {
  key: string;
  /** Notes for the animation, and the loop length they repeat over. */
  visual: { notes: VisualNote[]; length: number; parts?: BuiltScore['parts'] } | null;
}

/** Load any sound from the library (generated buffer or piano score). */
export async function loadSound(id: string): Promise<LoadedSound> {
  const item = SOUND_BY_ID[id];
  if (!item) throw new Error(`Unknown sound ${id}`);
  if (item.kind === 'buffer') {
    const key = await loadTrack(item.track!);
    const b = buffers.get(key)!;
    return { key, visual: { notes: trackEvents.get(key) ?? [], length: b.left.length / sampleRate() } };
  }
  await loadPianoBank();
  const key = `score:${id}`;
  let sc = scores.get(key);
  if (!sc) {
    sc = await buildScore(id, loadMidiFile);
    scores.set(key, sc);
    post({ type: 'score', key, notes: sc.notes, length: sc.length });
  }
  return { key, visual: { notes: sc.visual, length: sc.length, parts: sc.parts } };
}

/** Playback position inside the current music, seconds (as heard). */
export function musicTime(): number {
  if (!ctx || status.value === 'idle') return 0;
  const out = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
  return Math.max(0, musicClock.time + (ctx.currentTime - musicClock.at) - latency - out - ctx.baseLatency);
}

export interface UploadInfo {
  key: string;
  name: string;
  seconds: number;
  gainDb: number;
}

/** Decode a local file (never leaves the device) and normalize it. */
export async function loadUpload(file: File): Promise<UploadInfo> {
  const ac = await ensureAudio();
  const data = await file.arrayBuffer();
  const decoded = await ac.decodeAudioData(data);
  const left = decoded.getChannelData(0).slice();
  const right = (decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : decoded.getChannelData(0)).slice();
  const m = await call({ type: 'prepareUpload', rate: ac.sampleRate, left, right }, [left.buffer, right.buffer]);
  if (m.type !== 'prepared') throw new Error('Unexpected worker reply');
  const key = `upload:${file.name}:${file.size}`;
  buffers.set(key, { left: m.left, right: m.right });
  loadedInWorklet.delete(key);
  await sendToWorklet(key);
  return { key, name: file.name, seconds: m.left.length / ac.sampleRate, gainDb: m.gainDb };
}

export interface StartOptions {
  music: string | null;
  noise: string | null;
  params: MixParams;
  timing: SessionTiming;
  title: string;
  onEnded?: () => void;
}

export async function startSession(o: StartOptions): Promise<void> {
  await ensureAudio();
  limiterGain.value = 1;
  onEnded = o.onEnded ?? null;
  startedAt = ctx!.currentTime + 10; // until the worklet reports
  musicClock = { time: 0, at: ctx!.currentTime + 10 };
  post({ type: 'start', params: o.params, timing: o.timing, music: o.music, noise: o.noise });
  status.value = 'playing';
  setMediaSession(o.title);
}

export function updateParams(params: MixParams): void {
  post({ type: 'params', params });
}

export function updateTiming(timing: SessionTiming): void {
  post({ type: 'timing', timing });
}

export function setMusic(key: string | null): void {
  post({ type: 'music', key });
}

export function setNoise(key: string | null): void {
  post({ type: 'noise', key });
}

/** Fade out and stop. Resolves when the sound has ended. */
export function stopSession(seconds = 2.5): Promise<void> {
  if (status.value !== 'playing') return Promise.resolve();
  status.value = 'stopping';
  post({ type: 'stop', seconds });
  return new Promise((r) => endedResolvers.push(r));
}

/** Short test tone for the headphone checks. pan: -1 left, 1 right, 'anti' = out of phase. */
export async function playTestTone(kind: 'left' | 'right' | 'anti', seconds = 1.6, volume = 0.6): Promise<void> {
  const ac = await ensureAudio();
  const t0 = ac.currentTime + 0.05;
  const merger = ac.createChannelMerger(2);
  const gain = ac.createGain();
  const level = 0.12 * Math.max(0.05, volume);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(level, t0 + 0.12);
  gain.gain.setValueAtTime(level, t0 + seconds - 0.2);
  gain.gain.linearRampToValueAtTime(0, t0 + seconds);
  const osc = ac.createOscillator();
  osc.frequency.value = kind === 'anti' ? 330 : 523.25;
  osc.connect(gain);
  if (kind === 'left') gain.connect(merger, 0, 0);
  else if (kind === 'right') gain.connect(merger, 0, 1);
  else {
    const inv = ac.createGain();
    inv.gain.value = -1;
    gain.connect(merger, 0, 0);
    gain.connect(inv);
    inv.connect(merger, 0, 1);
  }
  merger.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.05);
  await new Promise((r) => setTimeout(r, (seconds + 0.15) * 1000));
  merger.disconnect();
}

export interface ExportOptions {
  music: string | null;
  noise: string | null;
  params: MixParams;
  timing: SessionTiming;
  bits: 16 | 24;
  onProgress?: (p: number) => void;
}

export async function exportWav(o: ExportOptions): Promise<Blob> {
  const rate = sampleRate();
  const m = await call(
    {
      type: 'export',
      rate,
      bits: o.bits,
      params: o.params,
      timing: o.timing,
      music: o.music ? buffers.get(o.music) ?? null : null,
      score: o.music && scores.has(o.music) && regions ? { regions, notes: scores.get(o.music)!.notes, length: scores.get(o.music)!.length } : undefined,
      noise: o.noise ? buffers.get(o.noise) ?? null : null,
    },
    [],
    o.onProgress,
  );
  if (m.type !== 'exported') throw new Error('Export failed');
  return m.blob;
}

/** A neutral random file name, so a blinded export does not reveal its condition. */
export function neutralName(ext = 'wav'): string {
  const a = new Uint8Array(4);
  crypto.getRandomValues(a);
  return `session-${Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 7)}.${ext}`;
}

function setMediaSession(title: string) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'Steady' });
    navigator.mediaSession.setActionHandler('pause', () => { stopSession(); });
    navigator.mediaSession.setActionHandler('stop', () => { stopSession(); });
    navigator.mediaSession.playbackState = 'playing';
  } catch { /* not supported */ }
}

function clearMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try { navigator.mediaSession.playbackState = 'none'; } catch { /* ignore */ }
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
