import { signal, effect } from '@preact/signals';
import { db } from './db';
import type { BreathSettings } from '../audio/dsp/breath';
import { DEFAULT_BREATH } from '../audio/dsp/breath';
import { MOOD_BY_ID, type MoodId, type Recipe } from './moods';

export interface Settings {
  onboarded: boolean;
  /** Output volume 0..1 (after the limiter). */
  volume: number;
  breath: BreathSettings;
  /** How far the music dips on each exhale, dB. */
  swellDb: number;
  vibrate: boolean;
  region: string;
  headphones: { lr: 'ok' | 'swapped' | 'unsure' | null; mono: 'stereo' | 'mono' | 'unsure' | null; at: number | null };
  /** Assumed listening level for the weekly log, dB(A). */
  assumedDb: number;
  /** Last sound picked per goal. */
  lastSound: Record<string, string>;
  /** Add the experimental beat layer automatically (not in Calm down / Ride an urge). */
  autoBeats: boolean;
  beatMode: 'binaural' | 'pulse';
  /** Show the instrument animation or the breathing circle. */
  visual: 'instrument' | 'circle';
  /** The user's own version of each mood (from Fine-tune or the taste test). */
  recipes: Partial<Record<MoodId, Recipe>>;
  lastMood: MoodId | null;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  volume: 0.6,
  breath: DEFAULT_BREATH,
  swellDb: 4,
  vibrate: false,
  region: 'US',
  headphones: { lr: null, mono: null, at: null },
  assumedDb: 83,
  lastSound: {},
  autoBeats: true,
  beatMode: 'binaural',
  visual: 'instrument',
  recipes: {},
  lastMood: null,
};

export const settings = signal<Settings>(DEFAULT_SETTINGS);
export const settingsLoaded = signal(false);

export async function loadSettings(): Promise<void> {
  try {
    const s = await db.get<Partial<Settings>>('kv', 'settings');
    if (s) settings.value = { ...DEFAULT_SETTINGS, ...s, headphones: { ...DEFAULT_SETTINGS.headphones, ...s.headphones } };
  } catch {
    // Private mode or blocked storage: run with defaults.
  }
  settingsLoaded.value = true;
  effect(() => {
    const v = settings.value;
    db.put('kv', v, 'settings').catch(() => {});
  });
}

export function updateSettings(patch: Partial<Settings>): void {
  settings.value = { ...settings.value, ...patch };
}

/** The recipe to use for a mood: the user's version if they made one. */
export function recipeFor(mood: MoodId): Recipe {
  const mine = settings.value.recipes[mood];
  const base = MOOD_BY_ID[mood].recipe;
  return mine ? { ...base, ...mine, breath: { ...base.breath, ...mine.breath }, beat: { ...base.beat, ...mine.beat } } : base;
}

export function saveRecipe(mood: MoodId, r: Recipe): void {
  settings.value = { ...settings.value, recipes: { ...settings.value.recipes, [mood]: r } };
}

export function resetRecipe(mood: MoodId): void {
  const recipes = { ...settings.value.recipes };
  delete recipes[mood];
  settings.value = { ...settings.value, recipes };
}

export function isCustom(mood: MoodId): boolean {
  return !!settings.value.recipes[mood];
}
