
export type GoalId = 'calm' | 'urge' | 'relax' | 'sleep' | 'focus';

export interface Badge {
  label: string;
  evidence: string;
}

export interface Goal {
  id: GoalId;
  name: string;
  tagline: string;
  /** CSS accent variable name suffix. */
  accent: string;
  badges: Badge[];
  /** Suggested sound ids from src/music/catalog.ts. */
  sounds: string[];
  defaultSound: string;
  breathing: boolean;
  minutes: number;
}

export const GOALS: Goal[] = [
  {
    id: 'calm',
    name: 'Calm down',
    tagline: 'Angry or stressed. Step away, breathe, settle.',
    accent: 'calm',
    badges: [
      { label: 'Breathing', evidence: 'breathing' },
      { label: 'Music', evidence: 'music' },
      { label: 'Beats', evidence: 'beats-anger' },
    ],
    sounds: ['piece:satie-gym-1', 'piece:bach-prel-c', 'aurora', 'strings', 'rain'],
    defaultSound: 'piece:satie-gym-1',
    breathing: true,
    minutes: 10,
  },
  {
    id: 'urge',
    name: 'Ride an urge',
    tagline: 'A craving or impulse. Wait it out for 15 minutes.',
    accent: 'urge',
    badges: [
      { label: 'Urge surfing', evidence: 'urge-surfing' },
      { label: 'Movement', evidence: 'movement' },
      { label: 'Beats', evidence: 'beats-urge' },
    ],
    sounds: ['aurora', 'hush', 'rain', 'brown', 'lofi'],
    defaultSound: 'aurora',
    breathing: true,
    minutes: 15,
  },
  {
    id: 'relax',
    name: 'Relax',
    tagline: 'Calm music with a slow breathing swell.',
    accent: 'relax',
    badges: [
      { label: 'Music', evidence: 'music' },
      { label: 'Breathing', evidence: 'breathing' },
      { label: 'Beats', evidence: 'beats-relax' },
    ],
    sounds: ['piece:chopin-noct-9-2', 'piece:debussy-clair', 'reverie', 'lofi', 'strings'],
    defaultSound: 'piece:chopin-noct-9-2',
    breathing: true,
    minutes: 20,
  },
  {
    id: 'sleep',
    name: 'Sleep',
    tagline: 'Wind down. The sound fades out on its own.',
    accent: 'sleep',
    badges: [
      { label: 'Sleep habits', evidence: 'sleep-habits' },
      { label: 'Music', evidence: 'bedtime-music' },
      { label: 'Beats', evidence: 'beats-sleep' },
    ],
    sounds: ['reverie', 'piece:satie-gym-1', 'lullaby', 'hush', 'rain'],
    defaultSound: 'reverie',
    breathing: true,
    minutes: 25,
  },
  {
    id: 'focus',
    name: 'Focus',
    tagline: 'A timed work block with low-distraction sound.',
    accent: 'focus',
    badges: [
      { label: 'Steady sound', evidence: 'low-distraction' },
      { label: 'Beats', evidence: 'beats-focus' },
    ],
    sounds: ['lofi', 'piece:bach-prel-c', 'brown', 'rain', 'pink'],
    defaultSound: 'lofi',
    breathing: false,
    minutes: 25,
  },
];

export const GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g])) as Record<GoalId, Goal>;
