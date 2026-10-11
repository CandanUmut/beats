// On-device usage log: listening time and flow use. Powers the weekly
// listening log and the gentle "talk to someone" nudges.

import { db, uid } from './db';

export interface SessionRecord {
  id: string;
  goal: string;
  startedAt: number;
  /** Seconds of sound actually played. */
  seconds: number;
}

export async function recordSession(goal: string, startedAt: number, seconds: number): Promise<void> {
  if (seconds < 5) return;
  try {
    await db.put<SessionRecord>('sessions', { id: uid(), goal, startedAt, seconds: Math.round(seconds) });
  } catch { /* storage unavailable */ }
}

export async function allSessions(): Promise<SessionRecord[]> {
  try {
    return (await db.all<SessionRecord>('sessions')).sort((a, b) => a.startedAt - b.startedAt);
  } catch {
    return [];
  }
}

const DAY = 86400000;

/** WHO-ITU H.870: 80 dB(A) for 40 h/week; every +3 dB halves the time. */
export function weeklyBudgetHours(assumedDb: number): number {
  return 40 / Math.pow(2, (assumedDb - 80) / 3);
}

export function listenedHoursLast7Days(sessions: SessionRecord[], now = Date.now()): number {
  return sessions.filter((s) => s.startedAt > now - 7 * DAY).reduce((a, s) => a + s.seconds, 0) / 3600;
}

export interface Nudge {
  id: 'urge' | 'calm';
  text: string;
}

/**
 * Nudges from the research (section 4.3): the urge flow more than about
 * 5 times in a week, or the calm-down flow (nearly) every day for 2 weeks.
 * "Daily" is read as at least 12 of the last 14 days.
 */
export function nudges(sessions: SessionRecord[], now = Date.now()): Nudge[] {
  const out: Nudge[] = [];
  const urgeWeek = sessions.filter((s) => s.goal === 'urge' && s.startedAt > now - 7 * DAY).length;
  if (urgeWeek > 5) {
    out.push({
      id: 'urge',
      text: `You've used Ride an urge ${urgeWeek} times this week. That takes effort. Urges this frequent are worth talking through with someone who can help. A counselor, doctor or support line can add a lot to what you're already doing.`,
    });
  }
  const calmDays = new Set(
    sessions.filter((s) => s.goal === 'calm' && s.startedAt > now - 14 * DAY).map((s) => Math.floor((s.startedAt - new Date(s.startedAt).getTimezoneOffset() * 60000) / DAY)),
  ).size;
  if (calmDays >= 12) {
    out.push({
      id: 'calm',
      text: `You've needed Calm down on ${calmDays} of the last 14 days. That sounds like a lot to carry. A professional can help with what keeps setting it off.`,
    });
  }
  return out;
}
