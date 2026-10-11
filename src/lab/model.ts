// Experiment Lab: plans, trials, analysis and the plain-language verdict.

import { db, uid } from '../data/db';
import type { GoalId } from '../data/goals';
import type { TrackId } from '../audio/dsp/synth';
import type { BreathSettings } from '../audio/dsp/breath';
import { binomialP, blockSchedule, mean, pairedCI, pairsFromSchedule, permutationP, sd, type Arm, type PairedResult } from './stats';
import { parseCsv, toCsv } from '../lib/csv';

export type Factor = 'pulse' | 'binaural' | 'breathing' | 'sound';

export const FACTORS: Record<Factor, { name: string; a: string; b: string; blindable: boolean; note: string }> = {
  pulse: {
    name: 'Rhythm pulse vs sham',
    a: 'Pulse on',
    b: 'Sham (no pulse)',
    blindable: true,
    note: 'Works on speakers. The pulse is a gentle loudness wobble, so you may be able to hear which is which. The blinding check will tell you.',
  },
  binaural: {
    name: 'Binaural beat vs sham',
    a: 'Real beat',
    b: 'Sham (same tones, no beat)',
    blindable: true,
    note: 'Needs stereo headphones. The sham plays the same tones at the same level with no difference between ears, so it is hard to tell apart.',
  },
  breathing: {
    name: 'Breathing guide on vs off',
    a: 'Breathing guide on',
    b: 'Breathing guide off',
    blindable: false,
    note: "You'll obviously know which one you got, so this can't be blinded. The result shows what helps you, but expectation can't be ruled out.",
  },
  sound: {
    name: 'Sound A vs sound B',
    a: 'Sound A',
    b: 'Sound B',
    blindable: false,
    note: "You'll hear which sound is playing, so this can't be blinded.",
  },
};

/** Arm label without the explanation in brackets, for sentences. */
export const short = (label: string) => label.replace(/\s*\(.*\)$/, '');

export type Scale = 'calm' | 'anger' | 'craving' | 'focus' | 'sleepiness';
export const SCALES: { id: Scale; label: string; low: string; high: string }[] = [
  { id: 'calm', label: 'Calm', low: 'not at all', high: 'very calm' },
  { id: 'anger', label: 'Anger / irritation', low: 'none', high: 'furious' },
  { id: 'craving', label: 'Craving / urge', low: 'none', high: 'overwhelming' },
  { id: 'focus', label: 'Focus', low: 'scattered', high: 'sharp' },
  { id: 'sleepiness', label: 'Sleepiness', low: 'wide awake', high: 'very sleepy' },
];

export type OutcomeId = 'calm_up' | 'anger_down' | 'craving_down' | 'focus_up' | 'sleepy_up' | 'rt_post';

export const OUTCOMES: Record<OutcomeId, { label: string; unit: string; explain: string }> = {
  calm_up: { label: 'Calm: after minus before', unit: 'points', explain: 'How much calmer you got during the session (0–10 scale).' },
  anger_down: { label: 'Anger: drop from before to after', unit: 'points', explain: 'How much your anger/irritation went down.' },
  craving_down: { label: 'Craving: drop from before to after', unit: 'points', explain: 'How much the urge went down.' },
  focus_up: { label: 'Focus: after minus before', unit: 'points', explain: 'How much sharper you felt.' },
  sleepy_up: { label: 'Sleepiness: after minus before', unit: 'points', explain: 'How much sleepier you got (for wind-down).' },
  rt_post: { label: 'Reaction time after the session (faster is better)', unit: 'ms', explain: 'Median reaction time on the 2-minute test, shown so that a positive number means faster.' },
};

export const DEFAULT_OUTCOME: Record<GoalId, OutcomeId> = {
  relax: 'calm_up',
  calm: 'anger_down',
  urge: 'craving_down',
  sleep: 'sleepy_up',
  focus: 'focus_up',
};

/** Rates "used in studies" per goal (docs/RESEARCH.md table 3.5). */
export const DEFAULT_RATE: Record<GoalId, number> = { relax: 6, calm: 6, urge: 6, sleep: 2, focus: 14 };

export interface Plan {
  id: string;
  name: string;
  goal: GoalId;
  factor: Factor;
  outcome: OutcomeId;
  minutes: number;
  sound: TrackId;
  soundB?: TrackId;
  breathing: boolean;
  breath: BreathSettings;
  rhythm: { rate: number; depth: number; carrier: number; levelDb: number };
  baseline: number;
  pairs: number;
  rule: { minDiff: number; maxGuessAccuracy: number | null };
  pvt: boolean;
  createdAt: number;
  lockedAt: number | null;
  seed: number;
  schedule: Arm[];
  status: 'draft' | 'running' | 'complete' | 'stopped';
  stopReason?: string;
}

export type Ratings = Partial<Record<Scale, number>>;

export interface PvtResult {
  medianMs: number;
  meanMs: number;
  lapses: number;
  falseStarts: number;
  n: number;
}

export interface Trial {
  id: string;
  expId: string;
  /** 0-based position: baseline sessions first, then the main schedule. */
  index: number;
  phase: 'baseline' | 'main';
  arm: Arm | null;
  startedAt: number;
  minutesPlayed: number;
  pre: Ratings;
  post: Ratings;
  pvt?: PvtResult;
  guess?: Arm | 'unsure';
  sideEffects: string[];
  note: string;
  stoppedEarly: boolean;
}

// --- Storage ---------------------------------------------------------------

export async function listPlans(): Promise<Plan[]> {
  try { return (await db.all<Plan>('experiments')).sort((a, b) => b.createdAt - a.createdAt); } catch { return []; }
}
export async function getPlan(id: string): Promise<Plan | undefined> {
  try { return await db.get<Plan>('experiments', id); } catch { return undefined; }
}
export async function savePlan(p: Plan): Promise<void> {
  await db.put('experiments', p);
}
export async function trialsFor(expId: string): Promise<Trial[]> {
  try { return (await db.all<Trial>('trials')).filter((t) => t.expId === expId).sort((a, b) => a.index - b.index); } catch { return []; }
}
export async function saveTrial(t: Trial): Promise<void> {
  await db.put('trials', t);
}
export async function deletePlan(id: string): Promise<void> {
  for (const t of await trialsFor(id)) await db.delete('trials', t.id);
  await db.delete('experiments', id);
}

export function newPlan(goal: GoalId): Plan {
  return {
    id: uid(),
    name: '',
    goal,
    factor: 'binaural',
    outcome: DEFAULT_OUTCOME[goal],
    minutes: 24,
    sound: goal === 'focus' ? 'brown' : goal === 'sleep' || goal === 'urge' ? 'hush' : 'drift',
    breathing: goal !== 'focus',
    breath: { mode: 'paced', bpm: 6, ratio: 1.5 },
    rhythm: { rate: DEFAULT_RATE[goal], depth: 0.15, carrier: 220, levelDb: -15 },
    baseline: 5,
    pairs: 30,
    rule: { minDiff: 1, maxGuessAccuracy: 0.6 },
    pvt: goal === 'focus',
    createdAt: Date.now(),
    lockedAt: null,
    seed: 0,
    schedule: [],
    status: 'draft',
  };
}

/** Lock the plan: fix it with a timestamp and draw the hidden schedule. */
export function lockPlan(p: Plan): Plan {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  const seed = a[0];
  return {
    ...p,
    lockedAt: Date.now(),
    seed,
    schedule: blockSchedule(p.pairs, seed),
    status: 'running',
    rule: { ...p.rule, maxGuessAccuracy: FACTORS[p.factor].blindable ? p.rule.maxGuessAccuracy : null },
  };
}

export function totalSessions(p: Plan): number {
  return p.baseline + p.pairs * 2;
}

/** What session comes next: baseline or a hidden arm. */
export function nextSession(p: Plan, trials: Trial[]): { index: number; phase: 'baseline' | 'main'; arm: Arm | null } | null {
  const done = new Set(trials.map((t) => t.index));
  for (let i = 0; i < totalSessions(p); i++) {
    if (!done.has(i)) {
      if (i < p.baseline) return { index: i, phase: 'baseline', arm: null };
      return { index: i, phase: 'main', arm: p.schedule[i - p.baseline] };
    }
  }
  return null;
}

// --- Outcomes and analysis -------------------------------------------------

export function outcomeValue(o: OutcomeId, t: Trial): number | null {
  const d = (s: Scale, sign: 1 | -1) => {
    const a = t.pre[s], b = t.post[s];
    return a === undefined || b === undefined ? null : sign * (b - a);
  };
  switch (o) {
    case 'calm_up': return d('calm', 1);
    case 'anger_down': return d('anger', -1);
    case 'craving_down': return d('craving', -1);
    case 'focus_up': return d('focus', 1);
    case 'sleepy_up': return d('sleepiness', 1);
    case 'rt_post': return t.pvt && t.pvt.n >= 5 ? -t.pvt.medianMs : null;
  }
}

export type VerdictKind = 'works' | 'no-effect' | 'blinding-failed' | 'worse' | 'not-enough' | 'unclear';

export interface Analysis {
  meanA: number | null;
  meanB: number | null;
  meanBaseline: number | null;
  sdBaseline: number | null;
  nA: number;
  nB: number;
  paired: PairedResult | null;
  perm: { p: number; exact: boolean } | null;
  guesses: { n: number; correct: number; accuracy: number; p: number } | null;
  diffs: number[];
  verdict: VerdictKind;
  headline: string;
  detail: string[];
}

export function analyze(p: Plan, trials: Trial[]): Analysis {
  const byIndex = new Map(trials.map((t) => [t.index, t]));
  const val = (t: Trial | undefined) => (t && !t.stoppedEarly ? outcomeValue(p.outcome, t) : null);
  const main = trials.filter((t) => t.phase === 'main');
  const A = main.filter((t) => t.arm === 'A').map(val).filter((v): v is number => v !== null);
  const B = main.filter((t) => t.arm === 'B').map(val).filter((v): v is number => v !== null);
  const base = trials.filter((t) => t.phase === 'baseline').map(val).filter((v): v is number => v !== null);
  const diffs: number[] = [];
  for (const [ia, ib] of pairsFromSchedule(p.schedule)) {
    const a = val(byIndex.get(ia + p.baseline)), b = val(byIndex.get(ib + p.baseline));
    if (a !== null && b !== null) diffs.push(a - b);
  }
  const paired = diffs.length >= 2 ? pairedCI(diffs) : null;
  const perm = diffs.length >= 2 ? permutationP(diffs, 20000, p.seed || 7) : null;
  const g = main.filter((t) => t.guess === 'A' || t.guess === 'B' || t.guess === 'unsure');
  // "Unsure" counts as half right, the honest chance-level answer.
  const correct = g.reduce((a, t) => a + (t.guess === 'unsure' ? 0.5 : t.guess === t.arm ? 1 : 0), 0);
  const guesses = g.length ? { n: g.length, correct, accuracy: correct / g.length, p: binomialP(Math.round(correct), g.length) } : null;

  const unit = OUTCOMES[p.outcome].unit;
  const fmt = (x: number) => (unit === 'ms' ? `${x.toFixed(0)} ms` : `${x.toFixed(2)} points`);
  const detail: string[] = [];
  let verdict: VerdictKind;
  let headline: string;
  const minDiff = p.rule.minDiff;
  if (!paired || diffs.length < 5) {
    verdict = 'not-enough';
    headline = "Not enough complete pairs to say anything yet.";
  } else {
    const ciExcludes0 = paired.ciLow > 0 || paired.ciHigh < 0;
    const blindOk = p.rule.maxGuessAccuracy === null || !guesses || guesses.accuracy <= p.rule.maxGuessAccuracy;
    detail.push(`${short(FACTORS[p.factor].a)} minus ${short(FACTORS[p.factor].b)}: ${fmt(paired.meanDiff)} on average (95% CI ${fmt(paired.ciLow)} to ${fmt(paired.ciHigh)}), from ${paired.n} pairs.`);
    if (perm) detail.push(`Permutation test: p = ${perm.p.toFixed(3)}${perm.exact ? ' (exact)' : ''}. Below 0.05 means a difference this big would be unlikely if there were no real effect.`);
    if (guesses) detail.push(`You guessed the version right ${(guesses.accuracy * 100).toFixed(0)}% of the time (50% = pure guessing).`);
    if (!blindOk && Math.abs(paired.meanDiff) >= minDiff && ciExcludes0) {
      verdict = 'blinding-failed';
      headline = "Can't tell: you could tell the versions apart, so expectation may explain the difference.";
    } else if (paired.meanDiff >= minDiff && ciExcludes0 && blindOk) {
      verdict = 'works';
      headline = `Works for you: ${short(FACTORS[p.factor].a).toLowerCase()} beat ${short(FACTORS[p.factor].b).toLowerCase()} by ${fmt(paired.meanDiff)}.`;
      detail.push('Before fully believing it, the research suggests confirming with a second block of the same size.');
    } else if (paired.meanDiff <= -minDiff && ciExcludes0) {
      verdict = 'worse';
      headline = `The ${short(FACTORS[p.factor].a).toLowerCase()} version did worse for you.`;
    } else if (!ciExcludes0 || Math.abs(paired.meanDiff) < minDiff) {
      verdict = 'no-effect';
      headline = 'No clear effect for you.';
      detail.push('That is a useful result. Keep what helps (music, breathing, the routine) and drop the part that made no difference.');
    } else {
      verdict = 'unclear';
      headline = 'A difference, but smaller than the size you said would matter.';
    }
    if (!blindOk && verdict !== 'blinding-failed') detail.push('Your guesses beat your blinding limit, so be cautious about any difference.');
  }
  return {
    meanA: A.length ? mean(A) : null,
    meanB: B.length ? mean(B) : null,
    meanBaseline: base.length ? mean(base) : null,
    sdBaseline: base.length >= 2 ? sd(base) : null,
    nA: A.length,
    nB: B.length,
    paired,
    perm,
    guesses,
    diffs,
    verdict,
    headline,
    detail,
  };
}

// --- Warnings (warn only, never block) -----------------------------------

export function warnings(p: Plan, trials: Trial[], now = new Date()): string[] {
  const out: string[] = [];
  const today = trials.filter((t) => new Date(t.startedAt).toDateString() === now.toDateString()).length;
  if (today >= 2) out.push(`You've already done ${today} sessions today. The protocol suggests at most 1–2 a day, so sessions stay independent.`);
  const hours = trials.map((t) => new Date(t.startedAt).getHours() + new Date(t.startedAt).getMinutes() / 60);
  if (hours.length >= 3) {
    const typical = [...hours].sort((a, b) => a - b)[hours.length >> 1];
    const h = now.getHours() + now.getMinutes() / 60;
    if (Math.abs(h - typical) > 3) out.push(`Your sessions are usually around ${fmtHour(typical)}. Keeping the same time of day makes the comparison fairer.`);
  }
  if (p.factor === 'binaural') out.push('Use the same stereo headphones (wired is best) at the same volume every time.');
  return out;
}

function fmtHour(h: number): string {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// --- CSV export / import --------------------------------------------------

export function experimentCsv(p: Plan, trials: Trial[]): string {
  const rows: Record<string, unknown>[] = [
    { type: 'plan', id: p.id, name: p.name, goal: p.goal, factor: p.factor, outcome: p.outcome, locked_at: p.lockedAt ? new Date(p.lockedAt).toISOString() : '', status: p.status, json: JSON.stringify(p) },
  ];
  for (const t of trials) {
    rows.push({
      type: 'trial',
      id: t.id,
      index: t.index,
      phase: t.phase,
      arm: t.arm ?? '',
      condition: t.arm === 'A' ? FACTORS[p.factor].a : t.arm === 'B' ? FACTORS[p.factor].b : 'baseline',
      started_at: new Date(t.startedAt).toISOString(),
      minutes: t.minutesPlayed,
      outcome: outcomeValue(p.outcome, t) ?? '',
      ...Object.fromEntries(Object.entries(t.pre).map(([k, v]) => [`pre_${k}`, v])),
      ...Object.fromEntries(Object.entries(t.post).map(([k, v]) => [`post_${k}`, v])),
      pvt_median_ms: t.pvt?.medianMs ?? '',
      pvt_lapses: t.pvt?.lapses ?? '',
      guess: t.guess ?? '',
      side_effects: t.sideEffects.join('; '),
      note: t.note,
      stopped_early: t.stoppedEarly,
      json: JSON.stringify(t),
    });
  }
  return toCsv(rows);
}

export async function importCsv(text: string): Promise<Plan> {
  const rows = parseCsv(text);
  const planRow = rows.find((r) => r.type === 'plan');
  if (!planRow?.json) throw new Error('No plan row found in this file.');
  const plan = JSON.parse(planRow.json) as Plan;
  await savePlan(plan);
  for (const r of rows.filter((x) => x.type === 'trial' && x.json)) await saveTrial(JSON.parse(r.json) as Trial);
  return plan;
}
