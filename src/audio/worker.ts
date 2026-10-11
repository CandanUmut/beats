// Background worker: renders generative tracks, measures loudness of
// uploaded files, and renders WAV exports. Keeps the UI smooth.
/// <reference lib="webworker" />
import { renderTrack, type TrackId } from './dsp/synth';
import { integratedLoudness, dbToLin, TARGET_LUFS } from './dsp/loudness';
import { crossfadeLoop } from './dsp/noise';
import { SessionMixer, type MixParams, type SessionTiming } from './dsp/mixer';
import { PcmEncoder, wavHeader } from './dsp/wav';

export type WorkerIn =
  | { id: number; type: 'track'; track: TrackId; rate: number }
  | { id: number; type: 'prepareUpload'; rate: number; left: Float32Array; right: Float32Array }
  | {
      id: number;
      type: 'export';
      rate: number;
      bits: 16 | 24;
      params: MixParams;
      timing: SessionTiming;
      music: { left: Float32Array; right: Float32Array } | null;
      noise: { left: Float32Array; right: Float32Array } | null;
    };

export type WorkerOut =
  | { id: number; type: 'track'; left: Float32Array; right: Float32Array; lufs: number }
  | { id: number; type: 'prepared'; left: Float32Array; right: Float32Array; lufs: number; gainDb: number }
  | { id: number; type: 'progress'; done: number }
  | { id: number; type: 'exported'; blob: Blob }
  | { id: number; type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  try {
    if (m.type === 'track') {
      const t = renderTrack(m.track, m.rate);
      ctx.postMessage({ id: m.id, type: 'track', left: t.left, right: t.right, lufs: t.lufs } satisfies WorkerOut, [t.left.buffer, t.right.buffer]);
    } else if (m.type === 'prepareUpload') {
      const before = integratedLoudness([m.left, m.right], m.rate);
      const gainDb = Number.isFinite(before) ? TARGET_LUFS - before : 0;
      const g = dbToLin(gainDb);
      let left = m.left, right = m.right;
      // Make long files loop smoothly with a 3 s crossfade.
      const xf = Math.round(3 * m.rate);
      if (left.length > xf * 4) {
        left = crossfadeLoop(left, left.length - xf);
        right = crossfadeLoop(right, right.length - xf);
      }
      for (let i = 0; i < left.length; i++) { left[i] *= g; right[i] *= g; }
      const lufs = integratedLoudness([left, right], m.rate);
      ctx.postMessage({ id: m.id, type: 'prepared', left, right, lufs, gainDb } satisfies WorkerOut, [left.buffer, right.buffer]);
    } else if (m.type === 'export') {
      const mx = new SessionMixer(m.rate, m.params, m.timing);
      mx.setMusic(m.music);
      mx.setNoise(m.noise);
      mx.setParams(m.params);
      const frames = Math.round(m.timing.duration * m.rate);
      const enc = new PcmEncoder(m.bits);
      const parts: BlobPart[] = [wavHeader(m.rate, 2, m.bits, frames) as Uint8Array<ArrayBuffer>];
      const block = 8192;
      const L = new Float32Array(block), R = new Float32Array(block);
      // Skip the limiter's look-ahead so the file starts on time.
      let skip = mx.latency;
      let written = 0;
      let lastReport = 0;
      while (written < frames) {
        mx.process(L, R, block);
        let start = 0;
        if (skip > 0) { start = Math.min(skip, block); skip -= start; }
        const n = Math.min(block - start, frames - written);
        if (n > 0) {
          parts.push(enc.encode(L.subarray(start, start + n), R.subarray(start, start + n), n) as Uint8Array<ArrayBuffer>);
          written += n;
        }
        if (written - lastReport > m.rate * 10) {
          lastReport = written;
          ctx.postMessage({ id: m.id, type: 'progress', done: written / frames } satisfies WorkerOut);
        }
      }
      ctx.postMessage({ id: m.id, type: 'exported', blob: new Blob(parts, { type: 'audio/wav' }) } satisfies WorkerOut);
    }
  } catch (err) {
    ctx.postMessage({ id: m.id, type: 'error', message: String(err) } satisfies WorkerOut);
  }
};
