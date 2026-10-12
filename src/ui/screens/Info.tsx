import { useEffect, useState } from 'preact/hooks';
import { EVIDENCE, EVIDENCE_BY_ID, GRADE_KEY, MYTHS, type Grade } from '../../data/evidence';
import { DISCLAIMER, STOP_DAY, STOP_STUDY, ASK_FIRST, NEVER_WHILE } from '../../data/safety';
import { REGIONS } from '../../data/helplines';
import { settings, updateSettings, isCustom, resetRecipe } from '../../data/settings';
import { MOODS } from '../../data/moods';
import { allSessions, listenedHoursLast7Days, weeklyBudgetHours, type SessionRecord } from '../../data/usage';
import { allCheckIns, allDiary, saveDiary, hoursBetween, type CheckIn, type DiaryEntry } from '../../data/checkins';
import { uid, db } from '../../data/db';
import { GradeChip, Icon, Rating, Seg, Slider, Toggle, TopBar } from '../components';
import { VolumeCard } from '../Player';
import { go } from '../router';
import { UrgeChart } from './Flows';
import { downloadText, toCsv } from '../../lib/csv';

export function EvidenceList() {
  return (
    <div class="accent-relax">
      <TopBar title="Research" />
      <h1>The research <em>behind it</em></h1>
      <p class="lead">Every part of Steady comes from published studies on breathing, music, sound and habits. Here is what each one found, the strong results and the null ones, so you can decide for yourself.</p>
      <div class="card">
        {EVIDENCE.map((e) => (
          <button class="row-link" onClick={() => go(`/evidence/${e.id}`)}>
            <span>
              <div style="font-weight:600">{e.title}</div>
              <div class="muted small">{e.summary}</div>
            </span>
            <span style="flex:none"><GradeChip grade={e.grade} /></span>
          </button>
        ))}
      </div>
      <button class="btn block" onClick={() => go('/myths')}>Myths, briefly</button>
      <div class="card">
        <h3 style="margin-top:0">Grading key</h3>
        {(Object.keys(GRADE_KEY) as Grade[]).map((g) => (
          <p class="small"><GradeChip grade={g} /> <span class="muted">{GRADE_KEY[g]}</span></p>
        ))}
      </div>
      <p class="tiny faint">Source: the project's research summary (docs/RESEARCH.md, October 2026). Some numbers come from abstracts; check the primary paper before relying on any single figure.</p>
    </div>
  );
}

export function EvidenceDetail({ id }: { id: string }) {
  const e = EVIDENCE_BY_ID[id];
  if (!e) return <div><TopBar title="Evidence" /><p>Not found.</p></div>;
  return (
    <div class="accent-relax">
      <TopBar title="Why?" />
      <h1>{e.title}</h1>
      <p><GradeChip grade={e.grade} /></p>
      <p class="lead">{e.summary}</p>
      <div class="card">
        <h3 style="margin-top:0">What studies found</h3>
        <ul style="padding-left:20px;margin:0">{e.findings.map((f) => <li class="small" style="margin:6px 0">{f}</li>)}</ul>
      </div>
      <div class="card">
        <h3 style="margin-top:0">What it means for you</h3>
        <p class="small" style="margin:0">{e.takeaway}</p>
      </div>
      {e.note && <div class="note warn">{e.note}</div>}
      <h3>Sources</h3>
      <ul class="list small">
        {e.sources.map((s) => (
          <li>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}</li>
        ))}
      </ul>
      <p class="tiny faint">{GRADE_KEY[e.grade]}</p>
    </div>
  );
}

export function Myths() {
  return (
    <div class="accent-relax">
      <TopBar title="Myths" />
      <h1>Myths, briefly</h1>
      <p class="lead">Things you'll hear about brainwaves and sound, and what the evidence says.</p>
      {MYTHS.map((m) => (
        <div class="card tight">
          <div style="font-weight:600">{m.claim}</div>
          <div class="small" style="margin:4px 0"><span class="exp-tag">{m.verdict}</span></div>
          <div class="small muted">{m.why}</div>
        </div>
      ))}
    </div>
  );
}

export function About() {
  return (
    <div class="accent-relax">
      <TopBar title="About" />
      <h1>About Steady</h1>
      <p class="lead">A free, open-source experiment: the best-supported self-help tools (breathing, calm music, urge surfing, movement, sleep habits, steady sound) in one place, with every part labeled by how good its evidence is, plus a Lab to test what works for you.</p>
      <div class="card">
        <h3 style="margin-top:0">Disclaimer</h3>
        <p class="small" style="margin:0">{DISCLAIMER}</p>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Safety</h3>
        <ul class="small" style="padding-left:20px;margin:0">
          <li>{NEVER_WHILE}</li>
          <li>{ASK_FIRST}</li>
          <li>{STOP_DAY}</li>
          <li>{STOP_STUDY}</li>
          <li>Nothing in the app flashes or flickers.</li>
        </ul>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Your data</h3>
        <p class="small" style="margin:0">Everything stays in this browser on this device (IndexedDB). No account, no server, no analytics, no trackers. Music files you pick are decoded locally and never uploaded. You can export your data as CSV in Settings.</p>
      </div>
      <p class="small muted">Code: MIT license. Sounds are generated by the app's own code. See ATTRIBUTION.md.</p>
    </div>
  );
}

export function Settings() {
  const s = settings.value;
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { allSessions().then(setSessions); }, []);
  const hours = listenedHoursLast7Days(sessions);
  const budget = weeklyBudgetHours(s.assumedDb);
  return (
    <div class="accent-relax">
      <TopBar title="Settings" />
      <h1>Settings</h1>
      <VolumeCard />
      <div class="card">
        <h3 style="margin-top:0">Weekly listening</h3>
        <div class="field-head"><span>Last 7 days</span><span class="v">{hours.toFixed(1)} h of {budget.toFixed(0)} h</span></div>
        <div class="meter"><i style={{ width: `${Math.min(100, (hours / budget) * 100)}%`, background: hours > budget ? 'var(--weak)' : 'var(--accent)' }} /></div>
        <Slider label="Assumed level" value={s.assumedDb} min={75} max={89} step={1} format={(v) => `${v} dB(A) → ${weeklyBudgetHours(v).toFixed(0)} h/week`} onInput={(assumedDb) => updateSettings({ assumedDb })} />
        <p class="tiny faint" style="margin:0">Based on the WHO-ITU safe-listening reference (80 dB for 40 h a week; every +3 dB halves it). A browser can't measure how loud it really is in your ears, so this assumes a conservative level.</p>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Your moods</h3>
        {MOODS.map((m) => (
          <div class="field-head" style="align-items:center">
            <span>{m.name} <span class="muted small">· {isCustom(m.id) ? 'tuned by you' : 'starting point'}</span></span>
            <span>
              <button class="link-btn" onClick={() => go(`/tune/${m.id}`)}>Taste test</button>
              {isCustom(m.id) && <button class="link-btn" style="margin-left:12px" onClick={() => resetRecipe(m.id)}>Reset</button>}
            </span>
          </div>
        ))}
      </div>
      <div class="card">
        <h3 style="margin-top:0">Visuals</h3>
        <Seg value={s.visual} onChange={(visual) => updateSettings({ visual })} label="Visual" options={[{ v: 'instrument', label: 'Piano / strings' }, { v: 'circle', label: 'Lamp' }]} />
        <p class="tiny faint" style="margin-bottom:0">Animations move slowly and never flash. If your device asks for reduced motion, the falling notes are turned off.</p>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Help lines region</h3>
        <Seg value={s.region} onChange={(region) => updateSettings({ region })} label="Region" options={REGIONS.map((r) => ({ v: r.id, label: r.name }))} />
      </div>
      <div class="card">
        <h3 style="margin-top:0">Breathing</h3>
        <Toggle label="Vibrate on each breath" hint="Android only" checked={s.vibrate} onChange={(vibrate) => updateSettings({ vibrate })} />
      </div>
      <div class="card">
        <h3 style="margin-top:0">Checks</h3>
        <p class="small muted" style="margin-top:0">
          Left/right: <b>{s.headphones.lr ?? 'not checked'}</b> · Stereo: <b>{s.headphones.mono ?? 'not checked'}</b>
        </p>
        <button class="btn small" onClick={() => go('/recheck')}>Run headphone checks again</button>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Your data</h3>
        <div class="btn-row">
          <button class="btn small" onClick={() => go('/log')}><Icon name="chart" size={18} /> History</button>
          <button class="btn small" onClick={exportAll}><Icon name="download" size={18} /> Export CSV</button>
        </div>
        {!confirm ? (
          <button class="btn small ghost" onClick={() => setConfirm(true)}>Delete all my data…</button>
        ) : (
          <div class="note danger-note">
            This permanently deletes your sessions, check-ins, diary and experiments on this device.
            <div class="btn-row">
              <button class="btn small" onClick={() => setConfirm(false)}>Cancel</button>
              <button class="btn small" style="color:var(--danger)" onClick={async () => { for (const st of ['sessions', 'checkins', 'diary', 'experiments', 'trials'] as const) await db.clear(st).catch(() => {}); setConfirm(false); setSessions([]); }}>Delete</button>
            </div>
          </div>
        )}
      </div>
      <button class="row-link" onClick={() => go('/about')}><span>About & disclaimer</span><Icon name="chev" /></button>
      <button class="row-link" onClick={() => go('/evidence')}><span>Evidence</span><Icon name="chev" /></button>
    </div>
  );
}

async function exportAll() {
  const sessions = await allSessions();
  const checkins = await allCheckIns();
  const diary = await allDiary();
  const day = new Date().toISOString().slice(0, 10);
  downloadText(`steady-sessions-${day}.csv`, toCsv(sessions.map((s) => ({ ...s, startedAt: new Date(s.startedAt).toISOString() }))));
  if (checkins.length) downloadText(`steady-checkins-${day}.csv`, toCsv(checkins.map((c) => ({ id: c.id, goal: c.goal, at: new Date(c.at).toISOString(), before: c.before, after: c.after, minutes: c.minutes, plan: c.plan ?? '', during: c.during.map((d) => `${d.t}s:${d.v}`).join(' ') }))));
  if (diary.length) downloadText(`steady-sleep-diary-${day}.csv`, toCsv(diary as unknown as Record<string, unknown>[]));
}

export function Log() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  useEffect(() => {
    allSessions().then(setSessions);
    allCheckIns().then(setCheckins);
  }, []);
  const byGoal = new Map<string, number>();
  for (const s of sessions) byGoal.set(s.goal, (byGoal.get(s.goal) ?? 0) + s.seconds);
  return (
    <div class="accent-relax">
      <TopBar title="History" />
      <h1>History</h1>
      <div class="card">
        <h3 style="margin-top:0">Time listened</h3>
        {byGoal.size === 0 && <p class="muted small">Nothing yet.</p>}
        {[...byGoal].map(([g, s]) => (
          <div class="field-head"><span style="text-transform:capitalize">{g}</span><span class="v">{(s / 60).toFixed(0)} min</span></div>
        ))}
      </div>
      <h2>Check-ins</h2>
      {checkins.length === 0 && <p class="muted small">Calm-down and urge sessions you rate will show up here.</p>}
      {[...checkins].reverse().map((c) => (
        <div class={`card tight accent-${c.goal}`}>
          <div class="field-head">
            <span style="font-weight:600">{c.goal === 'urge' ? 'Urge' : 'Calm down'}</span>
            <span class="v">{new Date(c.at).toLocaleString()}</span>
          </div>
          <div class="small">Before {c.before ?? '–'} → after {c.after ?? '–'}</div>
          {c.plan && <div class="small muted">Plan: {c.plan}</div>}
          <UrgeChart points={[...(c.before !== null ? [{ t: 0, v: c.before }] : []), ...c.during, ...(c.after !== null ? [{ t: c.minutes * 60 || 900, v: c.after }] : [])]} />
        </div>
      ))}
    </div>
  );
}

export function SleepDiary() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const [e, setE] = useState<DiaryEntry>({ id: uid(), date: today, bedtime: '23:00', wake: '07:00', rating: null, windDown: false, note: '' });
  const [saved, setSaved] = useState(false);
  useEffect(() => { allDiary().then(setEntries); }, [saved]);
  const h = hoursBetween(e.bedtime, e.wake);
  return (
    <div class="accent-sleep">
      <TopBar title="Sleep diary" />
      <h1>Morning check-in</h1>
      <div class="card">
        <div class="grid2">
          <div><div class="field-head"><span>Went to bed</span></div><input type="time" value={e.bedtime} onInput={(x) => setE({ ...e, bedtime: (x.target as HTMLInputElement).value })} /></div>
          <div><div class="field-head"><span>Woke up</span></div><input type="time" value={e.wake} onInput={(x) => setE({ ...e, wake: (x.target as HTMLInputElement).value })} /></div>
        </div>
        {h !== null && <p class="small muted">{h.toFixed(1)} hours in bed</p>}
        <div class="field-head"><span>How rested do you feel?</span></div>
        <Rating label="Rested" value={e.rating} onChange={(rating) => setE({ ...e, rating })} low="exhausted" high="fully rested" />
        <Toggle label="Used the wind-down last night" checked={e.windDown} onChange={(windDown) => setE({ ...e, windDown })} />
        <textarea placeholder="Anything worth noting (optional)" value={e.note} onInput={(x) => setE({ ...e, note: (x.target as HTMLTextAreaElement).value })} />
        <button class="btn primary block" style="margin-top:10px" onClick={async () => { await saveDiary(e); setSaved(!saved); setE({ ...e, id: uid(), note: '' }); }}>Save</button>
      </div>
      <h2>Recent nights</h2>
      {entries.length === 0 && <p class="muted small">No entries yet.</p>}
      {entries.slice(0, 14).map((d) => (
        <div class="card tight">
          <div class="field-head"><span>{d.date}</span><span class="v">{d.bedtime}–{d.wake} · {hoursBetween(d.bedtime, d.wake)?.toFixed(1)} h</span></div>
          <div class="small">Rested: {d.rating ?? '–'}/10 {d.windDown ? '· wind-down' : ''}</div>
          {d.note && <div class="small muted">{d.note}</div>}
        </div>
      ))}
      <p class="tiny faint">If you sleep badly most nights for several weeks, talk to a doctor. Structured sleep programs work well.</p>
    </div>
  );
}
