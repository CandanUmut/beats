import { useEffect, useRef, useState } from 'preact/hooks';
import { GOALS, GOAL_BY_ID } from '../../data/goals';
import { SOUNDS, SOUND_BY_ID, carrierFor } from '../../music/catalog';
import { patternFor } from '../../audio/dsp/breath';
import { DEFAULT_PARAMS, type MixParams } from '../../audio/dsp/mixer';
import * as engine from '../../audio/engine';
import { settings } from '../../data/settings';
import { STOP_DAY, STOP_STUDY } from '../../data/safety';
import {
  FACTORS, OUTCOMES, SCALES, analyze, deletePlan, experimentCsv, getPlan, importCsv, listPlans, lockPlan, newPlan, nextSession,
  savePlan, saveTrial, totalSessions, trialsFor, warnings, DEFAULT_OUTCOME, DEFAULT_RATE,
  short, type Factor, type OutcomeId, type Plan, type Ratings, type Trial, type PvtResult,
} from '../../lab/model';
import { pairedPower, type Arm } from '../../lab/stats';
import { uid } from '../../data/db';
import { downloadText } from '../../lib/csv';
import { recordSession } from '../../data/usage';
import { Icon, Rating, Seg, Slider, Toggle, TopBar, fmtTime, Badge } from '../components';
import { Orb, VolumeCard, timingFor } from '../Player';
import { Pvt } from '../Pvt';
import { go } from '../router';

export function Lab({ path }: { path: string }) {
  const parts = path.split('/').filter(Boolean); // ['lab', id?, action?]
  if (parts[1] === 'new') return <NewExperiment />;
  if (parts[1] && parts[2] === 'session') return <LabSession id={parts[1]} />;
  if (parts[1] && parts[2] === 'results') return <Results id={parts[1]} />;
  if (parts[1]) return <ExperimentPage id={parts[1]} />;
  return <LabHome />;
}

function LabHome() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { listPlans().then(setPlans); }, []);
  return (
    <div class="accent-honey">
      <TopBar title="Lab" />
      <h1>Does it work for you?</h1>
      <p class="lead">Test one part at a time, with everything else kept the same. Sessions are randomized and, where possible, blinded: you won't know which version you got until the end.</p>
      <button class="btn primary block" onClick={() => go('/lab/new')}><Icon name="flask" size={18} /> New experiment</button>
      {plans && plans.length > 0 && <h2>Your experiments</h2>}
      {plans?.map((p) => (
        <button class="lib-item" onClick={() => go(`/lab/${p.id}`)}>
          <span class="ic"><Icon name="flask" /></span>
          <span><div class="tt">{p.name || FACTORS[p.factor].name}</div><div class="st">{GOAL_BY_ID[p.goal].name} · {p.status}</div></span>
        </button>
      ))}
      <div class="card">
        <h3 style="margin-top:0">How it works</h3>
        <ol class="small" style="padding-left:20px;margin:0">
          <li>Pick a goal and the one thing to test.</li>
          <li>Lock the plan: outcome, number of sessions and success rule. It can't be changed after that.</li>
          <li>5 baseline sessions, then about 30 pairs in shuffled blocks of 4.</li>
          <li>Rate yourself before and after each session, then guess which version it was.</li>
          <li>Results unlock at the end, with a plain verdict.</li>
        </ol>
      </div>
      <button class="btn small ghost" onClick={() => file.current?.click()}><Icon name="upload" size={16} /> Import from CSV</button>
      <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={async (e) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) return;
        try { const p = await importCsv(await f.text()); go(`/lab/${p.id}`); } catch (x) { setErr(String((x as Error).message)); }
      }} />
      {err && <div class="note danger-note">{err}</div>}
    </div>
  );
}

// --- New experiment wizard ---------------------------------------------------

const FACTOR_ORDER: Factor[] = ['binaural', 'pulse', 'breathing', 'sound'];

function NewExperiment() {
  const [p, setP] = useState<Plan>(newPlan('relax'));
  const [confirm, setConfirm] = useState(false);
  const set = (patch: Partial<Plan>) => setP({ ...p, ...patch });
  const f = FACTORS[p.factor];
  const goal = GOAL_BY_ID[p.goal];
  const rhythm = p.factor === 'pulse' || p.factor === 'binaural';
  const mono = settings.value.headphones.mono === 'mono';
  const power = pairedPower(p.pairs, 0.5);
  const isRt = p.outcome === 'rt_post';

  return (
    <div class="accent-honey">
      <TopBar title="Lab" />
      <h1>Plan your experiment</h1>
      <div class="card">
        <h3 style="margin-top:0">1. Goal</h3>
        <div class="chips">
          {GOALS.map((g) => (
            <button class={`chip ${p.goal === g.id ? 'on' : ''}`} onClick={() => set({ goal: g.id, outcome: DEFAULT_OUTCOME[g.id], rhythm: { ...p.rhythm, rate: DEFAULT_RATE[g.id] }, pvt: g.id === 'focus', breathing: g.id !== 'focus', rule: { ...p.rule, minDiff: 1 } })}>{g.name}</button>
          ))}
        </div>
        {(p.goal === 'calm' || p.goal === 'urge') && (
          <p class="tiny muted">For this goal, both versions keep the breathing guide on: you compare "your coping routine + X" against "your coping routine + sham", never X instead of the routine.</p>
        )}
      </div>

      <div class="card">
        <h3 style="margin-top:0">2. The one thing to test</h3>
        {FACTOR_ORDER.map((id) => (
          <label class="check">
            <input type="radio" name="factor" checked={p.factor === id} onChange={() => set({ factor: id, breathing: id === 'breathing' ? true : p.breathing, rule: { ...p.rule, maxGuessAccuracy: FACTORS[id].blindable ? 0.6 : null } })} />
            <span>
              <b>{FACTORS[id].name}</b> {(id === 'pulse' || id === 'binaural') && <span class="exp-tag">Experimental</span>}
              <div class="tiny muted">{FACTORS[id].note}</div>
            </span>
          </label>
        ))}
        {p.factor === 'binaural' && mono && <div class="note warn small">Your stereo check said mono. Binaural beats disappear in mono. Re-run the check with stereo headphones in Settings first.</div>}
      </div>

      <div class="card">
        <h3 style="margin-top:0">3. Keep everything else the same</h3>
        <div class="field-head"><span>{p.factor === 'sound' ? 'Sound A' : 'Sound'}</span></div>
        <div class="chips">{[...new Set([p.sound, ...goal.sounds])].map((t) => <button class={`chip ${p.sound === t ? 'on' : ''}`} onClick={() => set({ sound: t, rhythm: { ...p.rhythm, carrier: carrierFor(SOUND_BY_ID[t]?.tonic ?? 9) } })}>{trackName(t)}</button>)}</div>
        {p.factor === 'sound' && (
          <>
            <div class="field-head"><span>Sound B</span></div>
            <div class="chips">{SOUNDS.map((t) => t.id).filter((t) => t !== p.sound).map((t) => <button class={`chip ${p.soundB === t ? 'on' : ''}`} onClick={() => set({ soundB: t })}>{trackName(t)}</button>)}</div>
          </>
        )}
        <Slider label="Session length" value={p.minutes} min={5} max={30} step={1} format={(v) => `${v} min`} onInput={(minutes) => set({ minutes })} />
        {p.factor !== 'breathing' && <Toggle label="Breathing guide in both versions" checked={p.breathing} onChange={(breathing) => set({ breathing })} />}
        {rhythm && (
          <>
            <Slider label={p.factor === 'binaural' ? 'Beat rate (Δf)' : 'Pulse rate'} value={p.rhythm.rate} min={1} max={20} step={0.5} format={(v) => `${v} Hz`} onInput={(rate) => set({ rhythm: { ...p.rhythm, rate } })} />
            {p.factor === 'pulse' && <Slider label="Pulse depth" value={Math.round(p.rhythm.depth * 100)} min={5} max={40} step={1} format={(v) => `${v}%`} onInput={(v) => set({ rhythm: { ...p.rhythm, depth: v / 100 } })} />}
            {p.factor === 'binaural' && (
              <>
                <Slider label="Carrier tone" value={p.rhythm.carrier} min={150} max={450} step={5} format={(v) => `${v} Hz`} onInput={(carrier) => set({ rhythm: { ...p.rhythm, carrier } })} />
                <Slider label="Tone level vs music" value={p.rhythm.levelDb} min={-30} max={-12} step={1} format={(v) => `${v} dB`} onInput={(levelDb) => set({ rhythm: { ...p.rhythm, levelDb } })} />
              </>
            )}
            <p class="tiny faint">Defaults are the rates used in studies for {goal.name.toLowerCase()} (research table 3.5). Most positive studies used 10–30 minutes; one found 24 minutes best.</p>
          </>
        )}
      </div>

      <div class="card">
        <h3 style="margin-top:0">4. Primary outcome</h3>
        {(Object.keys(OUTCOMES) as OutcomeId[]).map((o) => (
          <label class="check">
            <input type="radio" name="outcome" checked={p.outcome === o} onChange={() => set({ outcome: o, pvt: o === 'rt_post' ? true : p.pvt, rule: { ...p.rule, minDiff: o === 'rt_post' ? 20 : 1 } })} />
            <span><b>{OUTCOMES[o].label}</b><div class="tiny muted">{OUTCOMES[o].explain}</div></span>
          </label>
        ))}
        <Toggle label="Reaction-time test after each session" hint="2 minutes" checked={p.pvt} onChange={(pvt) => set({ pvt: isRt ? true : pvt })} />
      </div>

      <div class="card">
        <h3 style="margin-top:0">5. How many sessions</h3>
        <Seg value={p.pairs} onChange={(pairs) => set({ pairs })} label="Pairs" options={[{ v: 16, label: '16 pairs' }, { v: 30, label: '30 pairs' }, { v: 34, label: '34 pairs' }, { v: 40, label: '40 pairs' }]} />
        <p class="small muted">{p.baseline} baseline + {p.pairs * 2} main sessions = <b>{p.baseline + p.pairs * 2} sessions</b> of {p.minutes} min. At 1 a day that's about {Math.ceil((p.baseline + p.pairs * 2) / 7)} weeks.</p>
        <p class="tiny faint">Chance of detecting a medium effect (d = 0.5) if it's real: about {(power * 100).toFixed(0)}%. The research suggests ~34 pairs for 80%.</p>
      </div>

      <div class="card">
        <h3 style="margin-top:0">6. Success rule</h3>
        <p class="small" style="margin-top:0">It works for me if {f.a} beats {f.b} by at least:</p>
        <Seg value={p.rule.minDiff} onChange={(minDiff) => set({ rule: { ...p.rule, minDiff } })} label="Minimum difference"
          options={isRt ? [{ v: 10, label: '10 ms' }, { v: 20, label: '20 ms' }, { v: 40, label: '40 ms' }] : [{ v: 0.5, label: '0.5 pt' }, { v: 1, label: '1 point' }, { v: 2, label: '2 points' }]} />
        <p class="small muted">…and the 95% confidence interval excludes zero{f.blindable ? ', and my guesses are right no more than:' : '.'}</p>
        {f.blindable && (
          <Seg value={p.rule.maxGuessAccuracy ?? 0.6} onChange={(v) => set({ rule: { ...p.rule, maxGuessAccuracy: v } })} label="Blinding limit" options={[{ v: 0.55, label: '55%' }, { v: 0.6, label: '60%' }, { v: 0.7, label: '70%' }]} />
        )}
      </div>

      <div class="card">
        <div class="field-head"><span>Name (optional)</span></div>
        <input type="text" value={p.name} placeholder={`${goal.name}: ${f.name}`} onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />
      </div>

      {!confirm ? (
        <button class="btn primary block" disabled={p.factor === 'sound' && !p.soundB} onClick={() => setConfirm(true)}>Review and lock</button>
      ) : (
        <div class="card" style="border-color:var(--accent)">
          <h3 style="margin-top:0">Lock this plan?</h3>
          <p class="small">Once locked, the outcome, session count and success rule can't be changed, and you won't see results until the end. That's what makes the result trustworthy. You can always stop early for safety.</p>
          <div class="btn-row">
            <button class="btn" onClick={() => setConfirm(false)}>Edit</button>
            <button class="btn primary" onClick={async () => { const locked = lockPlan({ ...p, name: p.name || `${goal.name}: ${f.name}` }); await savePlan(locked); go(`/lab/${locked.id}`); }}>Lock plan</button>
          </div>
        </div>
      )}
    </div>
  );
}

function trackName(t: string): string {
  const it = SOUND_BY_ID[t];
  return it ? (it.category === 'classical' ? `${it.subtitle.split(' ').pop()}: ${it.title}` : it.title) : t;
}

// --- Experiment page ------------------------------------------------------------

function useExperiment(id: string) {
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [trials, setTrials] = useState<Trial[]>([]);
  const reload = async () => {
    setPlan((await getPlan(id)) ?? null);
    setTrials(await trialsFor(id));
  };
  useEffect(() => { void reload(); }, [id]);
  return { plan, trials, reload, setPlan };
}

function ExperimentPage({ id }: { id: string }) {
  const { plan, trials, reload } = useExperiment(id);
  const [stopping, setStopping] = useState(false);
  const [reason, setReason] = useState('');
  const [del, setDel] = useState(false);
  if (plan === undefined) return <div />;
  if (plan === null) return <div><TopBar title="Lab" /><p>Experiment not found.</p></div>;
  const total = totalSessions(plan);
  const done = trials.length;
  const next = nextSession(plan, trials);
  const finished = !next || plan.status !== 'running';
  const warn = warnings(plan, trials);
  const f = FACTORS[plan.factor];
  return (
    <div class="accent-honey">
      <TopBar title="Experiment" onBack={() => go('/lab')} />
      <h1>{plan.name}</h1>
      <p class="muted small">Locked {plan.lockedAt ? new Date(plan.lockedAt).toLocaleString() : ''} · {plan.status}</p>
      <div class="card">
        <div class="field-head"><span>Progress</span><span class="v">{done} of {total}</span></div>
        <div class="meter"><i style={{ width: `${(done / total) * 100}%` }} /></div>
        {next && plan.status === 'running' && (
          <>
            <p class="small" style="margin-bottom:4px">Next: <b>{next.phase === 'baseline' ? `baseline session ${next.index + 1} of ${plan.baseline}` : `session ${next.index - plan.baseline + 1} of ${plan.pairs * 2}`}</b>{next.phase === 'main' ? ' (version hidden)' : ''}</p>
            {warn.map((w) => <div class="note warn small">{w}</div>)}
            <button class="btn primary block" style="margin-top:8px" onClick={() => go(`/lab/${plan.id}/session`)}>Start session</button>
          </>
        )}
        {finished && <button class="btn primary block" style="margin-top:10px" onClick={() => go(`/lab/${plan.id}/results`)}>See results</button>}
        {!finished && <p class="tiny faint">Results unlock after the last session.</p>}
      </div>
      <div class="card">
        <h3 style="margin-top:0">Locked plan</h3>
        <ul class="small list">
          <li>Goal: {GOAL_BY_ID[plan.goal].name}</li>
          <li>Testing: {f.a} vs {f.b}</li>
          <li>Outcome: {OUTCOMES[plan.outcome].label}</li>
          <li>Sound: {trackName(plan.sound)}{plan.soundB ? ` / ${trackName(plan.soundB)}` : ''} · {plan.minutes} min · breathing guide {plan.factor === 'breathing' ? 'varies' : plan.breathing ? 'on' : 'off'}</li>
          {(plan.factor === 'pulse' || plan.factor === 'binaural') && <li>Rate {plan.rhythm.rate} Hz{plan.factor === 'pulse' ? `, depth ${Math.round(plan.rhythm.depth * 100)}%` : `, carrier ${plan.rhythm.carrier} Hz, ${plan.rhythm.levelDb} dB`}</li>}
          <li>{plan.baseline} baseline + {plan.pairs} pairs, blocks of 4</li>
          <li>Success: ≥ {plan.rule.minDiff} {OUTCOMES[plan.outcome].unit}, 95% CI excludes 0{plan.rule.maxGuessAccuracy !== null ? `, guesses ≤ ${Math.round(plan.rule.maxGuessAccuracy * 100)}% right` : ' (not blindable)'}</li>
        </ul>
      </div>
      <div class="note warn small">{STOP_DAY}<br />{STOP_STUDY}</div>
      <div class="btn-row">
        <button class="btn small" onClick={() => downloadText(`experiment-${plan.id}.csv`, experimentCsv(plan, trials))}><Icon name="download" size={16} /> Export CSV</button>
        {plan.status === 'running' && <button class="btn small" onClick={() => setStopping(true)}>Stop experiment</button>}
      </div>
      {stopping && (
        <div class="card">
          <p class="small" style="margin-top:0">Stopping early is always OK, especially for safety. Results will be shown, but they won't be reliable.</p>
          <input type="text" placeholder="Reason (optional)" value={reason} onInput={(e) => setReason((e.target as HTMLInputElement).value)} />
          <div class="btn-row">
            <button class="btn small" onClick={() => setStopping(false)}>Cancel</button>
            <button class="btn small primary" onClick={async () => { await savePlan({ ...plan, status: 'stopped', stopReason: reason }); await reload(); setStopping(false); }}>Stop</button>
          </div>
        </div>
      )}
      {!del ? <button class="btn small ghost" onClick={() => setDel(true)}>Delete experiment…</button> : (
        <div class="note danger-note small">Delete this experiment and all its sessions? Export a CSV first if you want to keep it.
          <div class="btn-row"><button class="btn small" onClick={() => setDel(false)}>Cancel</button><button class="btn small" onClick={async () => { await deletePlan(plan.id); go('/lab'); }}>Delete</button></div>
        </div>
      )}
    </div>
  );
}

// --- Session runner -------------------------------------------------------

export function armParams(plan: Plan, arm: Arm | null): { params: MixParams; track: string } {
  const s = settings.value;
  const a = arm === 'A';
  const control = arm === null ? true : !a; // baseline uses the control setup
  const breathingOn = plan.factor === 'breathing' ? !control : plan.breathing;
  const pattern = patternFor(plan.breath);
  const rhythm = { ...DEFAULT_PARAMS.rhythm, carrier: plan.rhythm.carrier, levelDb: plan.rhythm.levelDb, depth: 0, rate: plan.rhythm.rate };
  let mode: MixParams['rhythm']['mode'] = 'off';
  if (plan.factor === 'pulse') { mode = 'pulse'; rhythm.depth = control ? 0 : plan.rhythm.depth; }
  if (plan.factor === 'binaural') { mode = 'binaural'; rhythm.rate = control ? 0 : plan.rhythm.rate; }
  const track = plan.factor === 'sound' && control && plan.soundB ? plan.soundB : plan.sound;
  return {
    track,
    params: {
      ...DEFAULT_PARAMS,
      musicGainDb: 0,
      noiseGainDb: -80,
      breath: { enabled: breathingOn, pattern, depthDb: s.swellDb },
      rhythm: { ...rhythm, mode },
      volume: s.volume,
    },
  };
}

const SIDE_EFFECTS = ['Headache', 'Dizziness', 'Nausea', 'Ringing or muffled hearing', 'Rising panic or anger', 'Feeling detached'];

function LabSession({ id }: { id: string }) {
  const { plan, trials } = useExperiment(id);
  const [step, setStep] = useState<'pre' | 'play' | 'post' | 'saved'>('pre');
  const [pre, setPre] = useState<Ratings>({});
  const [post, setPost] = useState<Ratings>({});
  const [pvt, setPvt] = useState<PvtResult | undefined>();
  const [guess, setGuess] = useState<Arm | 'unsure' | null>(null);
  const [side, setSide] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const startedAt = useRef(0);
  const stoppedEarly = useRef(false);
  const played = useRef(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(engine.sessionTime()), 250);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => () => { if (engine.status.value !== 'idle') void engine.stopSession(1); }, []);
  useEffect(() => {
    if (running && plan) engine.updateParams({ ...armParams(plan, next!.arm).params });
  }, [settings.value.volume]);

  if (!plan) return <div />;
  const next = nextSession(plan, trials);
  if (!next && step !== 'saved') return <div class="accent-honey"><TopBar title="Lab session" /><p>All sessions are done. <a href={`#/lab/${plan.id}/results`}>See results</a></p></div>;
  const f = FACTORS[plan.factor];
  // The scale that matters for this experiment comes first; the rest are optional.
  const primary = ({ calm_up: 'calm', anger_down: 'anger', craving_down: 'craving', focus_up: 'focus', sleepy_up: 'sleepiness', rt_post: 'focus' } as const)[plan.outcome];
  const scales = [...SCALES.filter((x) => x.id === primary), ...SCALES.filter((x) => x.id !== primary)];

  async function startPlay() {
    if (!plan || !next) return;
    setLoading(true);
    await engine.ensureAudio();
    const { params, track } = armParams(plan, next.arm);
    const key = (await engine.loadSound(track)).key;
    setLoading(false);
    startedAt.current = Date.now();
    setStep('play');
    setRunning(true);
    await engine.startSession({
      music: key, noise: null, params, timing: timingFor(plan.minutes), title: 'Lab session',
      onEnded: () => { played.current = plan.minutes * 60; setRunning(false); setStep('post'); },
    });
  }

  async function stopEarly() {
    stoppedEarly.current = true;
    played.current = engine.sessionTime();
    await engine.stopSession(2);
    setRunning(false);
    setStep('post');
  }

  async function save() {
    if (!plan || !next) return;
    const t: Trial = {
      id: uid(), expId: plan.id, index: next.index, phase: next.phase, arm: next.arm,
      startedAt: startedAt.current, minutesPlayed: Math.round(played.current / 6) / 10,
      pre, post, pvt, guess: next.phase === 'main' ? guess ?? 'unsure' : undefined,
      sideEffects: side, note, stoppedEarly: stoppedEarly.current,
    };
    await saveTrial(t);
    await recordSession('lab', t.startedAt, played.current);
    const remaining = nextSession(plan, [...trials, t]);
    if (!remaining) await savePlan({ ...plan, status: 'complete' });
    setStep('saved');
  }

  const isMain = next?.phase === 'main';
  const breathingOn = next ? armParams(plan, next.arm).params.breath.enabled : false;
  const allPre = pre[primary] !== undefined;
  const allPost = post[primary] !== undefined;

  return (
    <div class="accent-honey">
      <TopBar title={isMain ? `Session ${next!.index - plan.baseline + 1}` : 'Baseline'} onBack={() => go(`/lab/${plan.id}`)} />
      {step === 'pre' && (
        <>
          <h1>Before you start</h1>
          <p class="lead">Rate how you feel right now. Same headphones, same volume as always.</p>
          <div class="card">
            {scales.slice(0, 1).map((s) => (
              <div style="margin-bottom:8px">
                <div class="field-head"><span>{s.label}</span></div>
                <Rating label={s.label} value={pre[s.id] ?? null} onChange={(v) => setPre({ ...pre, [s.id]: v })} low={s.low} high={s.high} />
              </div>
            ))}
            <details class="more"><summary>Rate more (optional)</summary>
              {scales.slice(1).map((s) => (
                <div style="margin-bottom:8px">
                  <div class="field-head"><span>{s.label}</span></div>
                  <Rating label={s.label} value={pre[s.id] ?? null} onChange={(v) => setPre({ ...pre, [s.id]: v })} low={s.low} high={s.high} />
                </div>
              ))}
            </details>
          </div>
          <VolumeCard />
          <div class="note warn small">{STOP_DAY}</div>
          <button class="btn primary block" disabled={!allPre || loading} onClick={startPlay}>{loading ? 'Preparing sound…' : `Start ${plan.minutes}-minute session`}</button>
        </>
      )}
      {step === 'play' && (
        <>
          <div class="stage">
            <Orb pattern={patternFor(plan.breath)} active={breathingOn} playing={running} label="Just listen" />
            <div class="timer">{fmtTime(plan.minutes * 60 - elapsed)}</div>
            <div class="timer-sub">Listen without multitasking</div>
          </div>
          <div class="play-row">
            <button class="btn" onClick={stopEarly}>Stop session (safety or discomfort)</button>
          </div>
          <p class="tiny faint center">{isMain ? "Which version this is stays hidden until the end of the study." : 'Baseline: the plain version, to learn your normal ups and downs.'}</p>
        </>
      )}
      {step === 'post' && (
        <>
          <h1>How do you feel now?</h1>
          {stoppedEarly.current && <div class="note warn small">Session stopped early. It will be saved but left out of the analysis.</div>}
          <div class="card">
            {scales.slice(0, 1).map((s) => (
              <div style="margin-bottom:8px">
                <div class="field-head"><span>{s.label}</span></div>
                <Rating label={s.label} value={post[s.id] ?? null} onChange={(v) => setPost({ ...post, [s.id]: v })} low={s.low} high={s.high} />
              </div>
            ))}
            <details class="more"><summary>Rate more (optional)</summary>
              {scales.slice(1).map((s) => (
                <div style="margin-bottom:8px">
                  <div class="field-head"><span>{s.label}</span></div>
                  <Rating label={s.label} value={post[s.id] ?? null} onChange={(v) => setPost({ ...post, [s.id]: v })} low={s.low} high={s.high} />
                </div>
              ))}
            </details>
          </div>
          {plan.pvt && !pvt && <Pvt onDone={setPvt} />}
          {plan.pvt && pvt && <p class="small muted">Reaction time saved: {Number.isFinite(pvt.medianMs) ? `${pvt.medianMs.toFixed(0)} ms median` : 'not enough taps'}.</p>}
          {isMain && (
            <div class="card">
              <h3 style="margin-top:0">Which version do you think this was?</h3>
              <div class="btn-row">
                <button class={`btn ${guess === 'A' ? 'primary' : ''}`} onClick={() => setGuess('A')}>{f.a}</button>
                <button class={`btn ${guess === 'B' ? 'primary' : ''}`} onClick={() => setGuess('B')}>{f.b}</button>
              </div>
              <button class={`btn block small ${guess === 'unsure' ? 'primary' : 'ghost'}`} onClick={() => setGuess('unsure')}>No idea</button>
            </div>
          )}
          <div class="card">
            <h3 style="margin-top:0">Anything unpleasant? <span class="faint small">(optional)</span></h3>
            {SIDE_EFFECTS.map((s) => (
              <label class="check"><input type="checkbox" checked={side.includes(s)} onChange={() => setSide(side.includes(s) ? side.filter((x) => x !== s) : [...side, s])} /><span class="small">{s}</span></label>
            ))}
            <textarea placeholder="Notes (optional)" value={note} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
            {side.length > 0 && <div class="note danger-note small">Please stop for today. {STOP_STUDY}</div>}
          </div>
          <button class="btn primary block" disabled={!allPost || (isMain && !guess) || (plan.pvt && !pvt && !stoppedEarly.current)} onClick={save}>Save session</button>
        </>
      )}
      {step === 'saved' && (
        <div class="card center" style="padding:28px 18px">
          <h2 style="margin-top:0">Saved</h2>
          <p class="muted">Thank you. Same time tomorrow is ideal.</p>
          <button class="btn primary block" onClick={() => go(`/lab/${plan.id}`)}>Back to experiment</button>
        </div>
      )}
    </div>
  );
}

// --- Results ------------------------------------------------------------

function Results({ id }: { id: string }) {
  const { plan, trials } = useExperiment(id);
  if (!plan) return <div />;
  const next = nextSession(plan, trials);
  if (next && plan.status === 'running') {
    return (
      <div class="accent-honey">
        <TopBar title="Results" onBack={() => go(`/lab/${plan.id}`)} />
        <h1>Not yet</h1>
        <p class="lead">Results stay hidden until the planned end ({trials.length} of {totalSessions(plan)} sessions done). Peeking early makes it too easy to fool yourself.</p>
      </div>
    );
  }
  const a = analyze(plan, trials);
  const f = FACTORS[plan.factor];
  const unit = OUTCOMES[plan.outcome].unit;
  const fmt = (x: number | null) => (x === null ? '–' : unit === 'ms' ? `${x.toFixed(0)} ms` : x.toFixed(2));
  const tone = a.verdict === 'works' ? 'var(--strong)' : a.verdict === 'worse' ? 'var(--danger)' : 'var(--moderate)';
  return (
    <div class="accent-honey">
      <TopBar title="Results" onBack={() => go(`/lab/${plan.id}`)} />
      <h1>{plan.name}</h1>
      {plan.status === 'stopped' && <div class="note warn">This experiment was stopped early{plan.stopReason ? ` (${plan.stopReason})` : ''}. The numbers below are not reliable.</div>}
      <div class="card" style={{ borderColor: tone }}>
        <h2 style="margin-top:0">{a.headline}</h2>
        {a.detail.map((d) => <p class="small">{d}</p>)}
      </div>
      <div class="card">
        <h3 style="margin-top:0">Averages ({OUTCOMES[plan.outcome].label})</h3>
        <div class="field-head"><span>{f.a}</span><span class="v">{fmt(a.meanA)} · {a.nA} sessions</span></div>
        <div class="field-head"><span>{f.b}</span><span class="v">{fmt(a.meanB)} · {a.nB} sessions</span></div>
        <div class="field-head"><span>Baseline</span><span class="v">{fmt(a.meanBaseline)}{a.sdBaseline !== null ? ` (SD ${fmt(a.sdBaseline)})` : ''}</span></div>
        {a.paired && <div class="field-head"><span>Effect size d<sub>z</sub></span><span class="v">{Number.isFinite(a.paired.dz) ? a.paired.dz.toFixed(2) : '–'}</span></div>}
        <DiffPlot diffs={a.diffs} min={plan.rule.minDiff} ci={a.paired ? [a.paired.ciLow, a.paired.ciHigh] : null} mean={a.paired?.meanDiff ?? null} />
        <p class="tiny faint">Each dot is one pair ({short(f.a)} minus {short(f.b)}). Right of zero means the {short(f.a).toLowerCase()} version did better. The bar is the 95% confidence interval.</p>
      </div>
      {a.guesses && (
        <div class="card">
          <h3 style="margin-top:0">Blinding check</h3>
          <p class="small" style="margin:0">You guessed right {(a.guesses.accuracy * 100).toFixed(0)}% of the time over {a.guesses.n} sessions (binomial p = {a.guesses.p.toFixed(3)} vs pure guessing). {plan.rule.maxGuessAccuracy !== null ? `Your limit was ${Math.round(plan.rule.maxGuessAccuracy * 100)}%.` : 'This factor could not be blinded.'}</p>
        </div>
      )}
      <div class="btn-row">
        <button class="btn small" onClick={() => downloadText(`experiment-${plan.id}.csv`, experimentCsv(plan, trials))}><Icon name="download" size={16} /> Export CSV</button>
      </div>
      <p class="tiny faint">If the version you tested did better with good blinding, the research suggests confirming it with a second block of the same size before believing it. A clear "no effect" is a useful result too.</p>
      <Badge label="What the research says" evidence={plan.factor === 'binaural' || plan.factor === 'pulse' ? 'beats-entrainment' : plan.factor === 'breathing' ? 'breathing' : 'music'} />
    </div>
  );
}

function DiffPlot({ diffs, min, ci, mean }: { diffs: number[]; min: number; ci: [number, number] | null; mean: number | null }) {
  if (diffs.length === 0) return null;
  const W = 320, H = 110;
  const ext = Math.max(Math.abs(min) * 2, ...diffs.map(Math.abs), ...(ci ? ci.map(Math.abs) : [])) * 1.1 || 1;
  const x = (v: number) => W / 2 + (v / ext) * (W / 2 - 10);
  return (
    <svg class="spark" style="height:120px" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pair differences">
      <rect x={x(-min)} y={8} width={x(min) - x(-min)} height={H - 34} fill="var(--surface-2)" />
      <line x1={x(0)} x2={x(0)} y1={4} y2={H - 22} stroke="var(--muted)" stroke-dasharray="3 3" />
      {diffs.map((d, i) => <circle cx={x(d)} cy={14 + ((i * 37) % 52)} r="3.5" fill="var(--accent)" opacity="0.8" />)}
      {ci && mean !== null && (
        <>
          <line x1={x(ci[0])} x2={x(ci[1])} y1={H - 16} y2={H - 16} stroke="var(--text)" stroke-width="3" stroke-linecap="round" />
          <circle cx={x(mean)} cy={H - 16} r="5" fill="var(--text)" />
        </>
      )}
      <text x={x(0)} y={H - 2} fill="var(--faint)" font-size="10" text-anchor="middle">0</text>
      <text x={x(min)} y={H - 2} fill="var(--faint)" font-size="10" text-anchor="middle">+{min}</text>
      <text x={x(-min)} y={H - 2} fill="var(--faint)" font-size="10" text-anchor="middle">−{min}</text>
    </svg>
  );
}
