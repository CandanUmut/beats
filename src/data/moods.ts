// Moods: the state you want to be in. Each mood carries a full "recipe"
// (music, breathing, beat, length) so one tap sets everything up. Users can
// tune a mood and the app remembers their version.

import type { BreathSettings } from '../audio/dsp/breath';
import type { GoalId } from './goals';

export type MoodId = 'calm' | 'relaxed' | 'sleepy' | 'focused' | 'grounded' | 'brighter';

export interface BeatSetting {
  on: boolean;
  /** Beat rate in Hz. */
  rate: number;
  type: 'binaural' | 'pulse';
  strength: 'subtle' | 'medium' | 'strong';
}

export interface Recipe {
  sound: string;
  breathing: boolean;
  breath: BreathSettings;
  /** How much the music rises and falls with the breath, dB. */
  swellDb: number;
  beat: BeatSetting;
  minutes: number;
}

export interface Mood {
  id: MoodId;
  name: string;
  /** "I want to feel …" phrasing for the home screen. */
  line: string;
  /** Flow that runs this mood. */
  flow: GoalId | 'breathe';
  accent: string;
  /** One short, research-traced line about why this setup is shaped this way. */
  fact: string;
  evidence: string;
  recipe: Recipe;
  /** Music the taste test compares (first = default). */
  tasteMusic: string[];
  /** Beat feels the taste test compares (Hz; 0 = no beat). */
  tasteBeats: number[];
  minuteOptions: number[];
}

export const BEAT_FEELS: { rate: number; name: string; hint: string }[] = [
  { rate: 2, name: 'Deep', hint: 'very slow, for sleep (2 Hz)' },
  { rate: 6, name: 'Dreamy', hint: 'slow and soft (6 Hz)' },
  { rate: 10, name: 'Easy', hint: 'relaxed but awake (10 Hz)' },
  { rate: 14, name: 'Alert', hint: 'steady and clear (14 Hz)' },
];

export function feelName(rate: number): string {
  const f = BEAT_FEELS.reduce((a, b) => (Math.abs(b.rate - rate) < Math.abs(a.rate - rate) ? b : a));
  return f.name;
}

export const STRENGTH: Record<BeatSetting['strength'], { levelDb: number; depth: number; label: string }> = {
  subtle: { levelDb: -24, depth: 0.08, label: 'Subtle' },
  medium: { levelDb: -18, depth: 0.15, label: 'Medium' },
  strong: { levelDb: -12, depth: 0.25, label: 'Noticeable' },
};

const paced = (bpm: number, ratio = 1.5): BreathSettings => ({ mode: 'paced', bpm, ratio });
const beat = (rate: number, strength: BeatSetting['strength'] = 'medium'): BeatSetting => ({ on: true, rate, type: 'binaural', strength });

export const MOODS: Mood[] = [
  {
    id: 'calm',
    name: 'Calm',
    line: 'Cool down after anger or stress',
    flow: 'calm',
    accent: 'sage',
    fact: 'Breathing at about six breaths a minute engages your body’s own brake within minutes.',
    evidence: 'breathing',
    recipe: { sound: 'piece:satie-gym-1', breathing: true, breath: paced(6, 1.6), swellDb: 4, beat: beat(6), minutes: 10 },
    tasteMusic: ['piece:satie-gym-1', 'aurora', 'piece:bach-prel-c'],
    tasteBeats: [6, 10, 0],
    minuteOptions: [5, 10, 15],
  },
  {
    id: 'relaxed',
    name: 'Relaxed',
    line: 'Unwind and let the day go',
    flow: 'relax',
    accent: 'honey',
    fact: 'Calm music around 60–90 beats a minute lowered stress across more than a hundred trials.',
    evidence: 'music',
    recipe: { sound: 'piece:chopin-noct-9-2', breathing: true, breath: paced(6), swellDb: 4, beat: beat(10), minutes: 20 },
    tasteMusic: ['piece:chopin-noct-9-2', 'piece:debussy-clair', 'strings'],
    tasteBeats: [10, 6, 0],
    minuteOptions: [10, 20, 30],
  },
  {
    id: 'sleepy',
    name: 'Sleepy',
    line: 'Wind down for bed',
    flow: 'sleep',
    accent: 'dusk',
    fact: 'A steady, repeatable wind-down routine is one of the best-supported sleep habits.',
    evidence: 'sleep-habits',
    recipe: { sound: 'reverie', breathing: true, breath: paced(5, 2), swellDb: 3, beat: beat(2, 'subtle'), minutes: 25 },
    tasteMusic: ['reverie', 'piece:satie-gym-1', 'rain'],
    tasteBeats: [2, 6, 0],
    minuteOptions: [20, 25, 30],
  },
  {
    id: 'focused',
    name: 'Focused',
    line: 'Settle into one task',
    flow: 'focus',
    accent: 'moss',
    fact: 'Steady sound without lyrics masks distractions and protects verbal work.',
    evidence: 'low-distraction',
    recipe: { sound: 'lofi', breathing: false, breath: paced(6), swellDb: 0, beat: beat(14, 'subtle'), minutes: 25 },
    tasteMusic: ['lofi', 'piece:bach-prel-c', 'brown'],
    tasteBeats: [14, 10, 0],
    minuteOptions: [15, 25, 50],
  },
  {
    id: 'grounded',
    name: 'Grounded',
    line: 'Ride out a craving or urge',
    flow: 'urge',
    accent: 'clay',
    fact: 'Urges rise, peak and pass, usually within minutes, if you don’t act on them.',
    evidence: 'urge-surfing',
    recipe: { sound: 'aurora', breathing: true, breath: paced(6, 1.6), swellDb: 4, beat: beat(6), minutes: 15 },
    tasteMusic: ['aurora', 'hush', 'rain'],
    tasteBeats: [6, 10, 0],
    minuteOptions: [10, 15, 20],
  },
  {
    id: 'brighter',
    name: 'Brighter',
    line: 'Lift your mood a little',
    flow: 'breathe',
    accent: 'marigold',
    fact: 'Five minutes a day of cyclic sighing lifted mood more than meditation in a 108-person study.',
    evidence: 'breathing',
    recipe: { sound: 'piece:debussy-arab-1', breathing: true, breath: { mode: 'sigh', bpm: 6, ratio: 1.5 }, swellDb: 4, beat: beat(10), minutes: 5 },
    tasteMusic: ['piece:debussy-arab-1', 'lofi', 'lullaby'],
    tasteBeats: [10, 14, 0],
    minuteOptions: [3, 5, 10],
  },
];

export const MOOD_BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m])) as Record<MoodId, Mood>;

export const MOOD_FOR_FLOW: Record<string, MoodId> = { calm: 'calm', relax: 'relaxed', sleep: 'sleepy', focus: 'focused', urge: 'grounded', breathe: 'brighter' };
