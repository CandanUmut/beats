// Every sound the app can play, grouped by style.
// Classical pieces are played from free scores (Mutopia Project MIDI files)
// on real piano samples (FreePats Upright Piano KW, CC0). Licenses are listed
// per piece and in ATTRIBUTION.md.

import type { TrackId } from '../audio/dsp/synth';

export type Category = 'classical' | 'piano' | 'chill' | 'ambient' | 'strings' | 'musicbox' | 'nature';

export const CATEGORIES: { id: Category; name: string; blurb: string }[] = [
  { id: 'classical', name: 'Classical piano', blurb: 'Chopin, Satie, Debussy, Bach, played on a real piano sound' },
  { id: 'piano', name: 'Gentle piano', blurb: 'Endless, generated piano' },
  { id: 'chill', name: 'Chill', blurb: 'Lo-fi beats and warm keys' },
  { id: 'ambient', name: 'Ambient', blurb: 'Pads and drones, no surprises' },
  { id: 'strings', name: 'Strings', blurb: 'Cello, viola and violins' },
  { id: 'musicbox', name: 'Music box', blurb: 'Soft and simple' },
  { id: 'nature', name: 'Rain & noise', blurb: 'Steady sound for focus and sleep' },
];

export type Visual = 'piano' | 'strings' | 'orb';

export interface Piece {
  id: string;
  title: string;
  composer: string;
  collection: string;
  file: string;
  /** Tonic pitch class (0 = C), used to tune the beat tone to the music. */
  tonic: number;
  tempo: number;
  pedalPerBar?: 1 | 2;
  autoPedal?: boolean;
  license: 'Public Domain' | 'CC BY-SA 2.5' | 'CC BY-SA 3.0' | 'CC BY-SA 4.0';
  source: string;
}

const M = 'https://www.mutopiaproject.org/ftp/';

export const PIECES: Piece[] = [
  { id: 'chopin-noct-9-2', title: 'Nocturne in E♭ major, Op. 9 No. 2', composer: 'Frédéric Chopin', collection: 'Chopin: Nocturnes', file: 'chopin_nocturne_op9_n2.mid', tonic: 3, tempo: 0.9, pedalPerBar: 2, license: 'CC BY-SA 3.0', source: `${M}ChopinFF/O9/chopin_nocturne_op9_n2/` },
  { id: 'chopin-noct-9-1', title: 'Nocturne in B♭ minor, Op. 9 No. 1', composer: 'Frédéric Chopin', collection: 'Chopin: Nocturnes', file: 'nocturne_in_b-flat_minor.mid', tonic: 10, tempo: 0.86, license: 'CC BY-SA 2.5', source: `${M}ChopinFF/O9/nocturne_in_b-flat_minor/` },
  { id: 'chopin-noct-27-2', title: 'Nocturne in D♭ major, Op. 27 No. 2', composer: 'Frédéric Chopin', collection: 'Chopin: Nocturnes', file: 'chopin-nocturne-8.mid', tonic: 1, tempo: 0.92, license: 'CC BY-SA 3.0', source: `${M}ChopinFF/O27/chopin-nocturne-8/` },
  { id: 'chopin-noct-72-1', title: 'Nocturne in E minor, Op. 72 No. 1', composer: 'Frédéric Chopin', collection: 'Chopin: Nocturnes', file: 'nocturne_in_e_minor.mid', tonic: 4, tempo: 0.92, license: 'CC BY-SA 4.0', source: `${M}ChopinFF/O72/nocturne_in_e_minor/` },
  { id: 'chopin-prel-4', title: 'Prelude in E minor, Op. 28 No. 4', composer: 'Frédéric Chopin', collection: 'Chopin: Preludes', file: 'Chop-28-4.mid', tonic: 4, tempo: 0.92, license: 'Public Domain', source: `${M}ChopinFF/O28/Chop-28-4/` },
  { id: 'chopin-prel-6', title: 'Prelude in B minor, Op. 28 No. 6', composer: 'Frédéric Chopin', collection: 'Chopin: Preludes', file: 'Chop-28-6.mid', tonic: 11, tempo: 0.95, license: 'Public Domain', source: `${M}ChopinFF/O28/Chop-28-6/` },
  { id: 'chopin-prel-15', title: 'Prelude in D♭ major, Op. 28 No. 15 ("Raindrop")', composer: 'Frédéric Chopin', collection: 'Chopin: Preludes', file: 'Chop-28-15.mid', tonic: 1, tempo: 0.92, license: 'Public Domain', source: `${M}ChopinFF/O28/Chop-28-15/` },
  { id: 'chopin-prel-20', title: 'Prelude in C minor, Op. 28 No. 20', composer: 'Frédéric Chopin', collection: 'Chopin: Preludes', file: 'Chop-28-20.mid', tonic: 0, tempo: 0.95, license: 'Public Domain', source: `${M}ChopinFF/O28/Chop-28-20/` },
  { id: 'chopin-prel-45', title: 'Prelude in C♯ minor, Op. 45', composer: 'Frédéric Chopin', collection: 'Chopin: Preludes', file: 'chopin_prelude_op45.mid', tonic: 1, tempo: 0.9, license: 'Public Domain', source: `${M}ChopinFF/O45/chopin_prelude_op45/` },
  { id: 'satie-gym-1', title: 'Gymnopédie No. 1', composer: 'Erik Satie', collection: 'Satie', file: 'gymnopedie_1.mid', tonic: 2, tempo: 0.92, license: 'Public Domain', source: `${M}SatieE/gymnopedie_1/` },
  { id: 'satie-gym-2', title: 'Gymnopédie No. 2', composer: 'Erik Satie', collection: 'Satie', file: 'gymnopedie_2.mid', tonic: 0, tempo: 0.92, license: 'Public Domain', source: `${M}SatieE/gymnopedie_2/` },
  { id: 'satie-gym-3', title: 'Gymnopédie No. 3', composer: 'Erik Satie', collection: 'Satie', file: 'gymnopedie_3.mid', tonic: 9, tempo: 0.92, license: 'Public Domain', source: `${M}SatieE/gymnopedie_3/` },
  { id: 'satie-gno-1', title: 'Gnossienne No. 1', composer: 'Erik Satie', collection: 'Satie', file: 'no_1.mid', tonic: 5, tempo: 0.82, license: 'CC BY-SA 4.0', source: `${M}SatieE/Gnossienne/no_1/` },
  { id: 'debussy-clair', title: 'Clair de lune', composer: 'Claude Debussy', collection: 'Debussy', file: 'debussy_Ste_Bergamesq_Clair.mid', tonic: 1, tempo: 0.92, license: 'Public Domain', source: `${M}DebussyC/L75/debussy_Ste_Bergamesq_Clair/` },
  { id: 'debussy-arab-1', title: 'Première Arabesque', composer: 'Claude Debussy', collection: 'Debussy', file: 'debussy_Arabesque_1.mid', tonic: 4, tempo: 0.82, pedalPerBar: 2, license: 'Public Domain', source: `${M}DebussyC/L66/debussy_Arabesque_1/` },
  { id: 'bach-prel-c', title: 'Prelude in C major, BWV 846', composer: 'J. S. Bach', collection: 'Bach', file: 'wtk1-prelude1.mid', tonic: 0, tempo: 0.85, license: 'Public Domain', source: `${M}BachJS/BWV846/wtk1-prelude1/` },
];

export const PIECE_BY_ID: Record<string, Piece> = Object.fromEntries(PIECES.map((p) => [p.id, p]));

export interface SoundItem {
  /** Stored in settings; 'piece:<id>' for classical, 'reverie', or a TrackId. */
  id: string;
  title: string;
  subtitle: string;
  category: Category;
  kind: 'buffer' | 'score';
  track?: TrackId;
  visual: Visual;
  tonic: number;
  license: string;
}

export const SOUNDS: SoundItem[] = [
  ...PIECES.map<SoundItem>((p) => ({ id: `piece:${p.id}`, title: p.title, subtitle: p.composer, category: 'classical', kind: 'score', visual: 'piano', tonic: p.tonic, license: p.license })),
  { id: 'reverie', title: 'Reverie', subtitle: 'Endless slow piano in 3/4, real piano sound', category: 'piano', kind: 'score', visual: 'piano', tonic: 2, license: 'MIT (generated)' },
  { id: 'drift', title: 'Drift', subtitle: 'Soft pentatonic notes over a pad', category: 'piano', kind: 'buffer', track: 'drift', visual: 'piano', tonic: 2, license: 'MIT (generated)' },
  { id: 'lofi', title: 'Lo-fi chill', subtitle: 'Warm keys, swung drums, vinyl hiss', category: 'chill', kind: 'buffer', track: 'lofi', visual: 'piano', tonic: 0, license: 'MIT (generated)' },
  { id: 'aurora', title: 'Aurora', subtitle: 'Wide pads, distant bells', category: 'ambient', kind: 'buffer', track: 'aurora', visual: 'orb', tonic: 2, license: 'MIT (generated)' },
  { id: 'hush', title: 'Hush', subtitle: 'A warm, slowly moving drone', category: 'ambient', kind: 'buffer', track: 'hush', visual: 'orb', tonic: 2, license: 'MIT (generated)' },
  { id: 'strings', title: 'Warm strings', subtitle: 'Slow chords for cello, viola and violins', category: 'strings', kind: 'buffer', track: 'strings', visual: 'strings', tonic: 2, license: 'MIT (generated)' },
  { id: 'lullaby', title: 'Lullaby', subtitle: 'A music-box waltz', category: 'musicbox', kind: 'buffer', track: 'lullaby', visual: 'piano', tonic: 5, license: 'MIT (generated)' },
  { id: 'rain', title: 'Soft rain', subtitle: 'Steady rain with gentle drops', category: 'nature', kind: 'buffer', track: 'rain', visual: 'orb', tonic: 2, license: 'MIT (generated)' },
  { id: 'pink', title: 'Pink noise', subtitle: 'Even, soft hiss', category: 'nature', kind: 'buffer', track: 'pink', visual: 'orb', tonic: 2, license: 'MIT (generated)' },
  { id: 'brown', title: 'Brown noise', subtitle: 'Deep, rumbling, gentle', category: 'nature', kind: 'buffer', track: 'brown', visual: 'orb', tonic: 2, license: 'MIT (generated)' },
];

export const SOUND_BY_ID: Record<string, SoundItem> = Object.fromEntries(SOUNDS.map((s) => [s.id, s]));

/** Playlist starting at a piece: the rest of its collection follows, then it loops. */
export function playlistFrom(pieceId: string): Piece[] {
  const p = PIECE_BY_ID[pieceId];
  if (!p) return [];
  const col = PIECES.filter((x) => x.collection === p.collection);
  const i = col.findIndex((x) => x.id === pieceId);
  return [...col.slice(i), ...col.slice(0, i)];
}

/**
 * Beat carrier tuned to the music: the tonic in the octave closest to 220 Hz,
 * kept inside the 150-450 Hz range the research recommends.
 */
export function carrierFor(tonic: number): number {
  let best = 220, err = Infinity;
  for (let oct = 2; oct <= 5; oct++) {
    const f = 440 * Math.pow(2, (tonic + 12 * (oct + 1) - 69) / 12);
    if (f >= 150 && f <= 450 && Math.abs(Math.log2(f / 220)) < err) { err = Math.abs(Math.log2(f / 220)); best = f; }
  }
  return Math.round(best * 100) / 100;
}
