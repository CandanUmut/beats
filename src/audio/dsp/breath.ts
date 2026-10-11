// Breathing patterns and the envelope that drives both the visual pacer and
// the music "swell". Pure functions of time, so the circle on screen and the
// sound always agree.

export type BreathPhase = 'in' | 'topup' | 'hold' | 'out';

export interface BreathSegment {
  phase: BreathPhase;
  seconds: number;
  /** Envelope level (0..1) reached at the end of this segment. */
  to: number;
}

export interface BreathPattern {
  id: string;
  segments: BreathSegment[];
}

export type BreathMode = 'paced' | 'sigh';

export interface BreathSettings {
  mode: BreathMode;
  /** Breaths per minute for paced mode (research: ~6/min). */
  bpm: number;
  /** Exhale length divided by inhale length, paced mode only. */
  ratio: number;
}

export const DEFAULT_BREATH: BreathSettings = { mode: 'paced', bpm: 6, ratio: 1.5 };
export const BPM_MIN = 4.5;
export const BPM_MAX = 7;
export const RATIO_MIN = 1;
export const RATIO_MAX = 2;

export function pacedPattern(bpm: number, ratio: number): BreathPattern {
  const b = clamp(bpm, BPM_MIN, BPM_MAX);
  const r = clamp(ratio, RATIO_MIN, RATIO_MAX);
  const cycle = 60 / b;
  const inhale = cycle / (1 + r);
  return {
    id: `paced-${b}-${r}`,
    segments: [
      { phase: 'in', seconds: inhale, to: 1 },
      { phase: 'out', seconds: cycle - inhale, to: 0 },
    ],
  };
}

/**
 * Cyclic sighing: a full inhale, a short second "top-up" inhale, then a long,
 * slow exhale. About 6.7 breaths per minute.
 */
export function sighPattern(): BreathPattern {
  return {
    id: 'sigh',
    segments: [
      { phase: 'in', seconds: 2.2, to: 0.78 },
      { phase: 'topup', seconds: 0.9, to: 1 },
      { phase: 'out', seconds: 5.9, to: 0 },
    ],
  };
}

export function patternFor(s: BreathSettings): BreathPattern {
  return s.mode === 'sigh' ? sighPattern() : pacedPattern(s.bpm, s.ratio);
}

export function cycleSeconds(p: BreathPattern): number {
  let t = 0;
  for (const s of p.segments) t += s.seconds;
  return t;
}

export interface BreathState {
  /** Smooth envelope 0 (empty) .. 1 (full). */
  level: number;
  phase: BreathPhase;
  /** 0..1 progress through the current segment. */
  progress: number;
  /** Seconds left in the current segment. */
  remaining: number;
  /** Index of the current breath (0-based). */
  cycle: number;
}

/** Raised-cosine ease: smooth start and end, no corners (no clicks). */
export function ease(u: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp(u, 0, 1));
}

export function breathAt(p: BreathPattern, t: number): BreathState {
  const total = cycleSeconds(p);
  const tt = Math.max(0, t);
  const cycle = Math.floor(tt / total);
  let local = tt - cycle * total;
  let from = p.segments[p.segments.length - 1].to;
  for (const seg of p.segments) {
    if (local < seg.seconds || seg === p.segments[p.segments.length - 1]) {
      const u = seg.seconds > 0 ? Math.min(1, local / seg.seconds) : 1;
      return {
        level: from + (seg.to - from) * ease(u),
        phase: seg.phase,
        progress: u,
        remaining: Math.max(0, seg.seconds - local),
        cycle,
      };
    }
    local -= seg.seconds;
    from = seg.to;
  }
  // Unreachable, kept for the type checker.
  return { level: 0, phase: 'out', progress: 1, remaining: 0, cycle };
}

/**
 * Linear gain for the music swell. The swell is centred on 0 dB (full breath
 * +depth/2, empty breath -depth/2), so turning it on does not change the
 * session's average loudness.
 */
export function swellGain(level: number, depthDb: number): number {
  return Math.pow(10, (depthDb * (level - 0.5)) / 20);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
