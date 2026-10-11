// Builds playable scores (one piece, a playlist, or the generated Reverie)
// and measures their loudness.

import { parseMidi } from './midi';
import { perform, type Performance } from './perform';
import { reverie } from './generative';
import { PIECE_BY_ID, playlistFrom, type Piece } from './catalog';
import { ScorePlayer, type SampleRegion, type ScoreNote } from '../audio/dsp/sampler';
import { integratedLoudness, dbToLin, TARGET_LUFS } from '../audio/dsp/loudness';
import gains from './gains.json';

export interface VisualNote {
  t: number;
  dur: number;
  midi: number;
  vel: number;
}

export interface BuiltScore {
  notes: ScoreNote[];
  /** Key-down spans for the animation. */
  visual: VisualNote[];
  /** Loop length in seconds. */
  length: number;
  /** Piece boundaries for the "now playing" label. */
  parts: { start: number; title: string; composer: string }[];
}

export const GAP_SECONDS = 3;

export function performPiece(p: Piece, midi: Uint8Array): Performance {
  return perform(parseMidi(midi), { tempo: p.tempo, pedalPerBar: p.pedalPerBar, autoPedal: p.autoPedal, seed: p.file.length * 7 + 1 });
}

/** Linear gain that brings a piece to -20 LUFS (precomputed in gains.json). */
export function pieceGain(id: string): number {
  const db = (gains as Record<string, number>)[id];
  return dbToLin(db ?? 0);
}

export function concat(items: { perf: Performance; gain: number; title: string; composer: string }[], gap = GAP_SECONDS): BuiltScore {
  const notes: ScoreNote[] = [];
  const visual: VisualNote[] = [];
  const parts: BuiltScore['parts'] = [];
  let offset = 0;
  for (const it of items) {
    parts.push({ start: offset, title: it.title, composer: it.composer });
    for (const n of it.perf.notes) {
      notes.push({ t: n.t + offset, release: n.release + offset, midi: n.midi, vel: n.vel, gain: it.gain });
      visual.push({ t: n.t + offset, dur: n.keyUp - n.t, midi: n.midi, vel: n.vel });
    }
    offset += it.perf.duration + gap;
  }
  return { notes, visual, length: offset, parts };
}

/** Build the score for a sound id. `loadMidi` fetches a MIDI file by name. */
export async function buildScore(id: string, loadMidi: (file: string) => Promise<Uint8Array>): Promise<BuiltScore> {
  if (id === 'reverie') {
    const perf = reverie();
    return { ...concat([{ perf, gain: pieceGain('reverie'), title: 'Reverie', composer: 'Generated' }], 0) };
  }
  const pieceId = id.replace(/^piece:/, '');
  if (!PIECE_BY_ID[pieceId]) throw new Error(`Unknown piece ${pieceId}`);
  const list = playlistFrom(pieceId);
  const items = [];
  for (const p of list) {
    items.push({ perf: performPiece(p, await loadMidi(p.file)), gain: pieceGain(p.id), title: p.title, composer: p.composer });
  }
  return concat(items);
}

/** Render a performance offline and measure its loudness (used to make gains.json). */
export function measurePerformance(perf: Performance, regions: SampleRegion[], rate: number): number {
  const notes: ScoreNote[] = perf.notes.map((n) => ({ t: n.t, release: n.release, midi: n.midi, vel: n.vel, gain: 1 }));
  const player = new ScorePlayer(rate, regions, notes, perf.duration + 4);
  const frames = Math.round((perf.duration + 2) * rate);
  const L = new Float32Array(frames), R = new Float32Array(frames);
  const block = 4096;
  for (let o = 0; o < frames; o += block) {
    const n = Math.min(block, frames - o);
    player.render(L.subarray(o, o + n), R.subarray(o, o + n), n);
  }
  return integratedLoudness([L, R], rate);
}

export function gainDbFor(lufs: number): number {
  return Number.isFinite(lufs) ? TARGET_LUFS - lufs : 0;
}
