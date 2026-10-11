import { describe, expect, it } from 'vitest';
import { analyze, newPlan, nextSession, outcomeValue, type Plan, type Trial } from '../src/lab/model';
import { blockSchedule } from '../src/lab/stats';
import { mulberry32, gaussian } from '../src/audio/dsp/random';

function plan(factor: Plan['factor'] = 'binaural'): Plan {
  const p = newPlan('relax');
  return { ...p, factor, seed: 99, schedule: blockSchedule(30, 99), lockedAt: 1, status: 'running' };
}

/** Simulate a study: true effect `effect` points, guess accuracy `guessAcc`. */
function simulate(p: Plan, effect: number, guessAcc: number, seed = 1): Trial[] {
  const rand = mulberry32(seed);
  const trials: Trial[] = [];
  for (let i = 0; i < p.baseline + p.schedule.length; i++) {
    const arm = i < p.baseline ? null : p.schedule[i - p.baseline];
    const pre = 4 + Math.round(rand() * 2);
    const change = 1.5 + (arm === 'A' ? effect : 0) + gaussian(rand) * 1.2;
    const post = Math.max(0, Math.min(10, pre + change));
    const right = rand() < guessAcc;
    trials.push({
      id: String(i), expId: p.id, index: i, phase: arm ? 'main' : 'baseline', arm,
      startedAt: Date.now(), minutesPlayed: 24,
      pre: { calm: pre }, post: { calm: post },
      guess: arm ? (right ? arm : arm === 'A' ? 'B' : 'A') : undefined,
      sideEffects: [], note: '', stoppedEarly: false,
    });
  }
  return trials;
}

describe('lab analysis verdicts', () => {
  it('a clear, blinded effect reads "works"', () => {
    const p = plan();
    const a = analyze(p, simulate(p, 2, 0.5));
    expect(a.paired!.n).toBe(30);
    expect(a.verdict).toBe('works');
  });
  it('no true effect reads "no clear effect"', () => {
    const p = plan();
    expect(analyze(p, simulate(p, 0, 0.5, 3)).verdict).toBe('no-effect');
  });
  it('an effect with failed blinding reads "can\'t tell"', () => {
    const p = plan();
    expect(analyze(p, simulate(p, 2, 0.95)).verdict).toBe('blinding-failed');
  });
  it('a harmful effect reads "worse"', () => {
    const p = plan();
    expect(analyze(p, simulate(p, -2, 0.5)).verdict).toBe('worse');
  });
  it('unblindable factors ignore the guess rule', () => {
    const p = { ...plan('breathing'), rule: { minDiff: 1, maxGuessAccuracy: null } };
    expect(analyze(p, simulate(p, 2, 1)).verdict).toBe('works');
  });
  it('outcome directions: drops count as positive', () => {
    const t = { pre: { anger: 8 }, post: { anger: 5 } } as unknown as Trial;
    expect(outcomeValue('anger_down', t)).toBe(3);
  });
  it('next session walks baseline first, then the hidden schedule', () => {
    const p = plan();
    expect(nextSession(p, [])).toEqual({ index: 0, phase: 'baseline', arm: null });
    const done = simulate(p, 0, 0.5).slice(0, 5);
    expect(nextSession(p, done)).toEqual({ index: 5, phase: 'main', arm: p.schedule[0] });
  });
});
