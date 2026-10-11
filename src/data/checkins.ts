import { db, uid } from './db';

export interface CheckIn {
  id: string;
  goal: string;
  at: number;
  before: number | null;
  after: number | null;
  /** Ratings during the session: seconds from start and value 0-10. */
  during: { t: number; v: number }[];
  minutes: number;
  plan?: string;
}

export function newCheckIn(goal: string, minutes: number): CheckIn {
  return { id: uid(), goal, at: Date.now(), before: null, after: null, during: [], minutes };
}

export async function saveCheckIn(c: CheckIn): Promise<void> {
  try { await db.put('checkins', c); } catch { /* storage unavailable */ }
}

export async function allCheckIns(): Promise<CheckIn[]> {
  try { return (await db.all<CheckIn>('checkins')).sort((a, b) => a.at - b.at); } catch { return []; }
}

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD (the morning)
  bedtime: string; // HH:MM
  wake: string; // HH:MM
  rating: number | null;
  windDown: boolean;
  note: string;
}

export async function saveDiary(e: DiaryEntry): Promise<void> {
  try { await db.put('diary', e); } catch { /* storage unavailable */ }
}

export async function allDiary(): Promise<DiaryEntry[]> {
  try { return (await db.all<DiaryEntry>('diary')).sort((a, b) => b.date.localeCompare(a.date)); } catch { return []; }
}

export function hoursBetween(bed: string, wake: string): number | null {
  const p = (s: string) => { const [h, m] = s.split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN; };
  const b = p(bed), w = p(wake);
  if (!Number.isFinite(b) || !Number.isFinite(w)) return null;
  let d = w - b;
  if (d <= 0) d += 24 * 60;
  return d / 60;
}
