import { signal, effect } from '@preact/signals';
import { db } from './db';
import type { BreathSettings } from '../audio/dsp/breath';
import { DEFAULT_BREATH } from '../audio/dsp/breath';

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
