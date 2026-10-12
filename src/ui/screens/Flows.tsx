import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { MOOD_BY_ID, type MoodId } from '../../data/moods';
import { recipeFor } from '../../data/settings';
import { newCheckIn, saveCheckIn, type CheckIn } from '../../data/checkins';
import { Icon, MoodGlyph, Rating, Seg, TopBar, fmtTime, helpOpen } from '../components';
import { Player, autoplay } from '../Player';
import { go } from '../router';

function Head({ mood, kicker }: { mood: MoodId; kicker?: string }) {
  const m = MOOD_BY_ID[mood];
  return (
    <div class="session-head">
      <div class="eyebrow">{kicker ?? m.line}</div>
      <h1>{m.name}</h1>
    </div>
  );
}

/** One line about what the session just did, from its recipe. */
function afterLine(mood: MoodId, secs: number): string | null {
  const r = recipeFor(mood);
  if (!r.breathing || secs < 45) return null;
  const perMin = r.breath.mode === 'sigh' ? 6.7 : r.breath.bpm;
  const n = Math.round((secs / 60) * perMin);
  return `That was about ${n} slow breaths. Long, slow breaths out turn on your body's brake.`;
}

function Done({ mood, title, children, again }: { mood: MoodId; title: string; children?: ComponentChildren; again?: () => void }) {
  return (
    <div class="card center" style="padding:30px 18px">
      <div style="width:64px;height:64px;margin:0 auto;color:var(--accent)"><MoodGlyph id={mood} /></div>
      <h2 style="margin:8px 0 4px">{title}</h2>
      {children}
      <div class="btn-row">
        {again && <button class="btn" onClick={again}>Again</button>}
        <button class="btn primary" onClick={() => go('/')}>Home</button>
      </div>
    </div>
  );
}

// --- Relaxed ------------------------------------------------------------------

export function Relax() {
  const [done, setDone] = useState<number | null>(null);
  const [key, setKey] = useState(0);
  return (
    <div class="accent-honey">
      <TopBar />
      <Head mood="relaxed" />
      {done !== null ? (
        <Done mood="relaxed" title="That was yours." again={() => { setDone(null); setKey(key + 1); }}>
          <p class="muted">{afterLine('relaxed', done) ?? ''} Notice how your shoulders, jaw and breath feel now.</p>
        </Done>
      ) : (
        <Player key={key} moodId="relaxed" onFinish={(secs, early) => (!early || secs > 120) && setDone(secs)} />
      )}
    </div>
  );
}

// --- Calm ---------------------------------------------------------------------

const CALM_LINES = [
  'Make each breath out long and slow.',
  'Let your shoulders drop as you breathe out.',
  "You don't have to solve anything right now.",
  'Feel your feet on the floor.',
  'Unclench your jaw and your hands.',
  'Just this breath. Then the next one.',
];

export function Calm() {
  const [step, setStep] = useState(0);
  const ci = useRef<CheckIn>(newCheckIn('calm', 10));
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [secs, setSecs] = useState(0);
  return (
    <div class="accent-sage">
      <TopBar />
      {step === 0 && (
        <>
          <Head mood="calm" />
          <Player
            moodId="calm"
            note="Step away if you can. Nothing needs a reply right now."
            guide={(t) => (t < 180 ? CALM_LINES[Math.floor(t / 30) % CALM_LINES.length] : t < 220 ? 'Now let the music carry you.' : null)}
            onFinish={(s) => { ci.current.minutes = Math.round(s / 60); setSecs(s); setStep(1); }}
          >
            {(_, playing) => !playing && (
              <details class="card tight intro-card rate-card">
                <summary><span>Rate how heated you feel <span class="faint">(optional)</span></span> <Icon name="chevdown" size={16} /></summary>
                <Rating label="Before" value={before} onChange={(v) => { setBefore(v); ci.current.before = v; }} low="calm" high="boiling" />
              </details>
            )}
          </Player>
        </>
      )}
      {step === 1 && (
        <>
          <Head mood="calm" kicker="Checking in" />
          {afterLine('calm', secs) && <p class="lead">{afterLine('calm', secs)}</p>}
          <div class="card">
            <div class="field-head"><span>How heated do you feel now?</span></div>
            <Rating label="After" value={after} onChange={setAfter} low="calm" high="boiling" />
            {before !== null && after !== null && (
              <p class="small" style="margin-bottom:0">
                {after < before ? `From ${before} down to ${after}. Your body did that.` : after === before ? `Still ${after}. That's okay; it can take a while to settle.` : `Up from ${before} to ${after}. Maybe step away a bit longer, or talk it through with someone.`}
              </p>
            )}
          </div>
          <div class="btn-row">
            <button class="btn" onClick={() => { autoplay.mood = 'calm'; setStep(0); }}>Another round</button>
            <button class="btn" onClick={() => go('/move')}><Icon name="walk" /> Walk it off</button>
            <button class="btn" onClick={() => (helpOpen.value = true)}><Icon name="heart" /> Talk to someone</button>
          </div>
          <button class="btn primary block" onClick={async () => { ci.current.after = after; await saveCheckIn(ci.current); go('/'); }}>Done</button>
        </>
      )}
    </div>
  );
}

// --- Grounded (ride an urge) -------------------------------------------------

const PLAN_IDEAS = ['Stay right where I am', 'Go for a short walk', 'Drink a glass of water', 'Text or call someone', 'Make tea', 'Take a shower'];

interface Prompt { at: number; text: string; rate?: boolean }
const URGE_PROMPTS: Prompt[] = [
  { at: 0, text: 'Notice where you feel the urge in your body. Chest? Stomach? Hands? Just notice it.' },
  { at: 60, text: "Breathe with the cue. You don't have to do anything about the urge. Just watch it." },
  { at: 180, text: 'Urges rise, peak and fade, like a wave. You are riding it, not fighting it.' },
  { at: 300, text: 'Check in: how strong is it right now?', rate: true },
  { at: 420, text: 'Is it the same, stronger, or weaker than a few minutes ago? Notice without judging.' },
  { at: 540, text: 'Remember your plan for when the timer ends.' },
  { at: 600, text: 'Check in again: how strong is it now?', rate: true },
  { at: 720, text: "You've waited 12 minutes. That's real effort, and it counts." },
  { at: 840, text: 'Almost there. Notice how the urge has changed.' },
];

export function Urge() {
  const [step, setStep] = useState(0);
  const ci = useRef<CheckIn>(newCheckIn('urge', 15));
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [plan, setPlan] = useState('');
  const [during, setDuring] = useState<{ t: number; v: number }[]>([]);

  return (
    <div class="accent-clay">
      <TopBar />
      {step < 2 && (
        <>
          <Head mood="grounded" />
          <Player moodId="grounded" note="Urges peak and pass. Your only job is to wait." onFinish={() => { ci.current.during = during; setStep(2); }}>
            {(t, playing) => {
              if (!playing) return (
                <details class="card tight intro-card rate-card">
                  <summary><span>{plan ? `My plan: ${plan}` : 'Rate the urge, make a plan'}{!plan && <span class="faint"> (optional)</span>}</span> <Icon name="chevdown" size={16} /></summary>
                  <div class="field-head" style="margin-top:10px"><span>How strong is the urge?</span></div>
                  <Rating label="Urge before" value={before} onChange={(v) => { setBefore(v); ci.current.before = v; }} low="none" high="overwhelming" />
                  <div class="field-head" style="margin-top:14px"><span>While I wait, I'll…</span></div>
                  <textarea value={plan} placeholder="My plan" onInput={(e) => { setPlan((e.target as HTMLTextAreaElement).value); ci.current.plan = (e.target as HTMLTextAreaElement).value; }} />
                  <div class="chips" style="margin-top:8px">
                    {PLAN_IDEAS.map((p) => <button class="chip" onClick={() => { const v = plan ? `${plan}, ${p.toLowerCase()}` : p; setPlan(v); ci.current.plan = v; }}>{p}</button>)}
                  </div>
                </details>
              );
              if (step === 0) setTimeout(() => setStep(1), 0);
              const current = [...URGE_PROMPTS].reverse().find((p) => t >= p.at) ?? URGE_PROMPTS[0];
              const rated = during.some((d) => d.t >= current.at && d.t < current.at + 120);
              return (
                <div class="prompt-card" key={current.at}>
                  <p style="margin:0">{current.text}</p>
                  {current.rate && !rated && (
                    <div style="margin-top:10px">
                      <Rating label="Urge now" value={null} onChange={(v) => setDuring([...during, { t: Math.round(t), v }])} low="none" high="overwhelming" />
                    </div>
                  )}
                  {current.rate && rated && <p class="tiny muted" style="margin:8px 0 0">Noted. Keep riding it.</p>}
                </div>
              );
            }}
          </Player>
          <p class="tiny faint center">Want to talk to someone? <button class="link-btn" onClick={() => (helpOpen.value = true)}>Support lines</button></p>
        </>
      )}
      {step === 2 && (
        <>
          <Head mood="grounded" kicker="You waited" />
          <div class="card">
            <div class="field-head"><span>How strong is the urge now?</span></div>
            <Rating label="Urge after" value={after} onChange={setAfter} low="none" high="overwhelming" />
            <UrgeChart points={[...(before !== null ? [{ t: 0, v: before }] : []), ...during, ...(after !== null ? [{ t: 900, v: after }] : [])]} />
            {before !== null && after !== null && (
              <p class="small" style="margin-bottom:0">
                {after < before ? `It went from ${before} to ${after}. You rode it out.` : 'Still strong. That happens. Try another round, move your body, or reach out to someone.'}
              </p>
            )}
          </div>
          <div class="btn-row">
            <button class="btn" onClick={() => go('/move')}><Icon name="walk" /> Move</button>
            <button class="btn" onClick={() => setStep(0)}>Another round</button>
          </div>
          <button class="btn block" onClick={() => (helpOpen.value = true)}><Icon name="heart" /> Talk to someone</button>
          <button class="btn primary block" style="margin-top:10px" onClick={async () => { ci.current.after = after; await saveCheckIn(ci.current); go('/'); }}>Done</button>
        </>
      )}
    </div>
  );
}

export function UrgeChart({ points }: { points: { t: number; v: number }[] }) {
  if (points.length < 2) return null;
  const W = 320, H = 90, pad = 8;
  const maxT = Math.max(...points.map((p) => p.t), 1);
  const x = (t: number) => pad + (t / maxT) * (W - 2 * pad);
  const y = (v: number) => H - pad - (v / 10) * (H - 2 * pad);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return (
    <svg class="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Urge strength over the session">
      <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="var(--line)" />
      <path d={d} fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      {points.map((p) => <circle cx={x(p.t)} cy={y(p.v)} r="4" fill="var(--accent)" />)}
    </svg>
  );
}

// --- Sleepy -------------------------------------------------------------------

export const SLEEP_HABITS = [
  'Same wake-up time every day, even on weekends',
  'Screens dimmed or away for the last 30–60 minutes',
  'No caffeine after early afternoon',
  'Room cool, dark and quiet',
  'Bed only for sleep (not work or scrolling)',
  'If awake for ~20 minutes, get up and do something calm until sleepy',
  'Some daylight soon after waking',
  'Go easy on alcohol near bedtime',
];

export function Sleep() {
  const [done, setDone] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [showHabits, setShowHabits] = useState(false);
  const morning = new Date().getHours() >= 5 && new Date().getHours() < 12;
  return (
    <div class="accent-dusk">
      <TopBar />
      <Head mood="sleepy" />
      {done ? (
        <Done mood="sleepy" title="Good night." />
      ) : (
        <>
          {morning && (
            <button class="resume" style="margin-bottom:12px" onClick={() => go('/sleep/diary')}>
              <span class="dot"><Icon name="moon" /></span>
              <span><div class="eyebrow">Good morning</div><div style="font-weight:650">How did you sleep? Two taps.</div></span>
            </button>
          )}
          <Player moodId="sleepy" sleep note="Start it once you're in bed. It fades to silence on its own." guide={(t) => (t < 60 ? 'Get comfortable. Close your eyes when you like.' : null)} onFinish={(_, early) => !early && setDone(true)}>
            {(_, playing) => !playing && (
              <div class="card tight">
                <button class="row-link" style="border:0;padding:4px 0" onClick={() => setShowHabits(!showHabits)}>
                  <span><b>Tonight's habits</b> <span class="muted small">· {checked.size} of {SLEEP_HABITS.length}</span></span>
                  <Icon name={showHabits ? 'chevdown' : 'chev'} />
                </button>
                {showHabits && SLEEP_HABITS.map((h, i) => (
                  <label class="check">
                    <input type="checkbox" checked={checked.has(i)} onChange={() => { const n = new Set(checked); n.has(i) ? n.delete(i) : n.add(i); setChecked(n); }} />
                    <span class="small">{h}</span>
                  </label>
                ))}
              </div>
            )}
          </Player>
        </>
      )}
    </div>
  );
}

// --- Focused ------------------------------------------------------------------

export function Focus() {
  const [after, setAfter] = useState(false);
  const [task, setTask] = useState('');
  const [blocks, setBlocks] = useState(0);
  const [key, setKey] = useState(0);
  return (
    <div class="accent-moss">
      <TopBar />
      <Head mood="focused" kicker={task ? `Working on: ${task}` : undefined} />
      {after ? (
        <Done mood="focused" title={blocks ? `Block done${blocks > 1 ? ` · ${blocks} today` : ''}` : 'Block stopped'}>
          <p class="muted">Take five. Stand up, look at something far away, move a little.</p>
          <div class="btn-row">
            <button class="btn" onClick={() => go('/move')}><Icon name="walk" /> Move</button>
            <button class="btn" onClick={() => { setKey(key + 1); setAfter(false); }}>Next block</button>
          </div>
        </Done>
      ) : (
        <>
          <div class="card tight intro-card">
            <div class="field-head"><span>This block I'll work on <span class="faint">(optional)</span></span></div>
            <input type="text" value={task} placeholder="e.g. draft the intro" onInput={(e) => setTask((e.target as HTMLInputElement).value)} />
          </div>
          <Player key={key} moodId="focused" onFinish={(_, early) => { if (!early) setBlocks(blocks + 1); setAfter(true); }} />
        </>
      )}
    </div>
  );
}

// --- Brighter (cyclic sighing practice) -------------------------------------

const MINDFUL = [
  'Notice the air, cool coming in, warm going out.',
  'Let the breath out be the longest part.',
  'If your mind wanders, that is normal. Come back to the next breath.',
  'Notice your shoulders. Let them drop.',
  'Notice three sounds around you, then come back to the breath.',
  'Feel where your body touches the chair or floor.',
];

export function Breathe() {
  const [done, setDone] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <div class="accent-marigold">
      <TopBar />
      <Head mood="brighter" />
      {done ? (
        <Done mood="brighter" title="Nicely done." again={() => { setDone(false); setKey(key + 1); }}>
          <p class="muted">{afterLine('brighter', recipeFor('brighter').minutes * 60) ?? ''} A few minutes a day is enough to notice a difference.</p>
        </Done>
      ) : (
        <Player
          key={key}
          moodId="brighter"
          allowNone
          guide={(t, total) => (t > 20 && t < total ? MINDFUL[Math.floor(t / 40) % MINDFUL.length] : 'In through the nose, a small extra sip, then a long, slow breath out.')}
          onFinish={(_, early) => !early && setDone(true)}
        />
      )}
    </div>
  );
}

// --- Movement break -----------------------------------------------------------

const MOVES = [
  'Walk around the block, or around your home',
  'Go up and down the stairs a few times',
  '10–20 slow squats or wall push-ups',
  'Stretch: reach up tall, fold down, roll your shoulders',
  'Shake out your hands and arms for 30 seconds',
  'March in place and swing your arms',
];

export function Move() {
  const [mins, setMins] = useState(5);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (start === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [start]);
  const left = start === null ? mins * 60 : Math.max(0, mins * 60 - (now - start) / 1000);
  const finished = start !== null && left <= 0;
  return (
    <div class="accent-sage">
      <TopBar />
      <div class="session-head"><div class="eyebrow">Get out of your head</div><h1>{finished ? 'Nice work.' : 'Move a little'}</h1></div>
      <p class="lead">A few minutes of movement takes the edge off an urge and clears your head.</p>
      <div class="card center">
        <div class="timer" style="font-size:52px">{fmtTime(left)}</div>
        {start === null ? (
          <>
            <div style="margin:12px 0"><Seg value={mins} onChange={setMins} label="Length" options={[{ v: 5, label: '5 min' }, { v: 10, label: '10 min' }]} /></div>
            <button class="btn primary block" onClick={() => setStart(Date.now())}>Start</button>
          </>
        ) : finished ? (
          <button class="btn primary block" style="margin-top:12px" onClick={() => go('/')}>Home</button>
        ) : (
          <button class="btn block" style="margin-top:12px" onClick={() => setStart(null)}>Stop</button>
        )}
      </div>
      <div class="card">
        <h3 style="margin-top:0">Pick one</h3>
        <ul class="list small">{MOVES.map((m) => <li>{m}</li>)}</ul>
      </div>
    </div>
  );
}
