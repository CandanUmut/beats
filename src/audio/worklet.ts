// AudioWorklet wrapper around SessionMixer. Runs on the audio thread.
/// <reference lib="webworker" />
import { SessionMixer, type LoopBuffer, type MixParams, type SessionTiming } from './dsp/mixer';

declare const sampleRate: number;
declare const currentTime: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

export type WorkletIn =
  | { type: 'load'; key: string; left: Float32Array; right: Float32Array }
  | { type: 'start'; params: MixParams; timing: SessionTiming; music: string | null; noise: string | null }
  | { type: 'params'; params: MixParams }
  | { type: 'timing'; timing: SessionTiming }
  | { type: 'music'; key: string | null }
  | { type: 'noise'; key: string | null }
  | { type: 'stop'; seconds: number };

export type WorkletOut =
  | { type: 'started'; at: number; latency: number }
  | { type: 'tick'; time: number; limiter: number }
  | { type: 'ended' };

class SteadyProcessor extends AudioWorkletProcessor {
  private buffers = new Map<string, LoopBuffer>();
  private mixer: SessionMixer | null = null;
  private announced = false;
  private lastTick = 0;
  private ended = false;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<WorkletIn>) => this.onMessage(e.data);
  }

  private onMessage(m: WorkletIn) {
    switch (m.type) {
      case 'load':
        this.buffers.set(m.key, { left: m.left, right: m.right });
        break;
      case 'start':
        this.mixer = new SessionMixer(sampleRate, m.params, m.timing);
        this.mixer.setMusic(m.music ? this.buffers.get(m.music) ?? null : null);
        this.mixer.setNoise(m.noise ? this.buffers.get(m.noise) ?? null : null);
        this.mixer.setParams(m.params);
        this.announced = false;
        this.ended = false;
        break;
      case 'params':
        this.mixer?.setParams(m.params);
        break;
      case 'timing':
        this.mixer?.setTiming(m.timing);
        break;
      case 'music':
        this.mixer?.setMusic(m.key ? this.buffers.get(m.key) ?? null : null);
        break;
      case 'noise':
        this.mixer?.setNoise(m.key ? this.buffers.get(m.key) ?? null : null);
        break;
      case 'stop':
        this.mixer?.stop(m.seconds);
        break;
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    const L = out[0];
    const R = out[1] ?? out[0];
    const mx = this.mixer;
    if (!mx || this.ended) {
      L.fill(0);
      R.fill(0);
      return true;
    }
    if (!this.announced) {
      this.announced = true;
      this.port.postMessage({ type: 'started', at: currentTime, latency: mx.latency / sampleRate } satisfies WorkletOut);
    }
    mx.process(L, R, L.length);
    if (currentTime - this.lastTick > 0.25) {
      this.lastTick = currentTime;
      this.port.postMessage({ type: 'tick', time: mx.time, limiter: mx.limiterMinGain } satisfies WorkletOut);
    }
    if (mx.finished) {
      this.ended = true;
      this.mixer = null;
      this.port.postMessage({ type: 'ended' } satisfies WorkletOut);
    }
    return true;
  }
}

registerProcessor('steady-mixer', SteadyProcessor);
