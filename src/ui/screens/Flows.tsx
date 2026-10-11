import { useEffect, useRef, useState } from 'preact/hooks';
import { GOAL_BY_ID, type GoalId } from '../../data/goals';
import { NOT_TREATMENT } from '../../data/safety';
import { settings, updateSettings } from '../../data/settings';
import { newCheckIn, saveCheckIn, type CheckIn } from '../../data/checkins';
import { Badge, HelpButton, Icon, Rating, Seg, Steps, TopBar, fmtTime, helpOpen } from '../components';
import { Player } from '../Player';
import { go } from '../router';

function GoalBadges({ id }: { id: GoalId }) {
  return (
    <div class="badges" style="margin:4px 0 8px">
      {GOAL_BY_ID[id].badges.map((b) => <Badge label={b.label} evidence={b.evidence} />)}
    </div>
  );
}

function Done({ title, children, again }: { title: string; children?: preact.ComponentChildren; again?: () => void }) {
  return (
    <div class="card center" style="padding:28px 18px">
      <div class="goal-glyph" style="margin:0 auto 10px;width:52px;height:52px"><Icon name="check" size={26} /></div>
      <h2 style="margin:6px 0">{title}</h2>
      {children}
      <div class="btn-row">
        {again && <button class="btn" onClick={again}>Again</button>}
        <button class="btn primary" onClick={() => go('/')}>Home</button>
      </div>
    </div>
  );
}

// --- Relax -------------------------------------------------------------------

export function Relax() {
  const g = GOAL_BY_ID.relax;
  const [done, setDone] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <div class="accent-relax">
      <TopBar title={g.name} />
      <GoalBadges id="relax" />
      {done ? (
        <Done title="Nice. Session complete." again={() => { setDone(false); setKey(key + 1); }}>
          <p class="muted">Notice how your body feels now compared with before.</p>
        </Done>
      ) : (
        <Player
          key={key}
          goalId="relax"
          title="Relax"
          sounds={g.sounds}
          defaultSound={g.defaultSound}
          minutes={g.minutes}
          minuteOptions={[10, 20, 30]}
          breathing
          guide={(t) => (t < 45 ? 'Breathe with the circle, or just listen.' : null)}
          onFinish={(_, early) => !early && setDone(true)}
        />
      )}
    </div>
  );
}

// --- Calm down ------------------------------------------------------------

const CALM_LINES = [
  'Follow the circle. Make each breath out long and slow.',
  'Let your shoulders drop as you breathe out.',
  "You don't have to solve anything right now.",
  'Feel your feet on the floor.',
  'Unclench your jaw and your hands.',
  'Just this breath. Then the next one.',
];

export function Calm() {
  const g = GOAL_BY_ID.calm;
  const [step, setStep] = useState(0);
  const [breathMin, setBreathMin] = useState(3);
  const ci = useRef<CheckIn>(newCheckIn('calm', g.minutes));
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);

  return (
    <div class="accent-calm">
      <TopBar title={g.name} />
      <Steps n={3} at={step} />
      {step === 0 && (
        <>
          <h1>Step away first</h1>
          <p class="lead">If you can, move away from whatever set this off: another room, outside, or just turn away from the screen. You don't need to reply, fix or decide anything right now.</p>
          <div class="card">
            <div class="field-head"><span>How angry or stressed are you? <span class="faint">(optional)</span></span></div>
            <Rating label="Before" value={before} onChange={setBefore} low="calm" high="furious" />
            <div class="field-head" style="margin-top:14px"><span>Breathing first for</span></div>
            <Seg value={breathMin} onChange={setBreathMin} label="Breathing length" options={[{ v: 2, label: '2 min' }, { v: 3, label: '3 min' }, { v: 5, label: '5 min' }]} />
          </div>
          <div class="note">Venting (yelling, hitting things) tends to keep anger going. Slowing your breathing works better. <a href="#/evidence/venting">Why?</a></div>
          <button class="btn primary block" onClick={() => { ci.current.before = before; setStep(1); }}>I've stepped away. Start.</button>
        </>
      )}
      {step === 1 && (
        <>
          <GoalBadges id="calm" />
          <Player
            goalId="calm"
            title="Calm down"
            sounds={g.sounds}
            defaultSound={g.defaultSound}
            minutes={10}
            minuteOptions={[5, 10, 15]}
            breathing
            autoStart
            guide={(t) =>
              t < breathMin * 60
                ? CALM_LINES[Math.floor(t / 30) % CALM_LINES.length]
                : t < breathMin * 60 + 40
                  ? 'Breathing part done. Let the music carry you now. Keep breathing slowly if you like.'
                  : null
            }
            onFinish={(secs) => { ci.current.minutes = Math.round(secs / 60); setStep(2); }}
          />
        </>
      )}
      {step === 2 && (
        <>
          <h1>How are you now?</h1>
          <div class="card">
            <Rating label="After" value={after} onChange={setAfter} low="calm" high="furious" />
            {before !== null && after !== null && (
              <p class="small" style="margin-bottom:0">
                {after < before ? `From ${before} down to ${after}. Your body did that.` : after === before ? `Still ${after}. That's okay. Anger can take a while to settle.` : `Up from ${before} to ${after}. Thanks for being honest. Consider stepping away a bit longer, or talking to someone.`}
              </p>
            )}
          </div>
          <div class="btn-row">
            <button class="btn" onClick={() => go('/move')}><Icon name="walk" size={18} /> Movement break</button>
            <button class="btn" onClick={() => (helpOpen.value = true)}><Icon name="heart" size={18} /> Talk to someone</button>
          </div>
          <button
            class="btn primary block"
            onClick={async () => {
              ci.current.after = after;
              await saveCheckIn(ci.current);
              go('/');
            }}
          >
            Done
          </button>
        </>
      )}
    </div>
  );
}

// --- Ride an urge ---------------------------------------------------------

const PLAN_IDEAS = ['Stay right where I am', 'Go for a short walk', 'Drink a glass of water', 'Text or call someone', 'Make tea', 'Take a shower'];

interface Prompt { at: number; text: string; rate?: boolean }
const URGE_PROMPTS: Prompt[] = [
  { at: 0, text: 'Notice where you feel the urge in your body. Chest? Stomach? Hands? Just notice it.' },
  { at: 60, text: "Breathe with the circle. You don't have to do anything about the urge. Just watch it." },
  { at: 180, text: 'Urges rise, peak and fade, like a wave. You are riding it, not fighting it.' },
  { at: 300, text: 'Check in: how strong is it right now?', rate: true },
  { at: 420, text: 'Is it the same, stronger, or weaker than a few minutes ago? Notice without judging.' },
  { at: 540, text: 'Remember your plan for when the timer ends.' },
  { at: 600, text: 'Check in again: how strong is it now?', rate: true },
  { at: 720, text: "You've waited 12 minutes. That's real effort, and it counts." },
  { at: 840, text: 'Almost there. Notice how the urge has changed.' },
];

export function Urge() {
  const g = GOAL_BY_ID.urge;
  const [step, setStep] = useState(0);
  const ci = useRef<CheckIn>(newCheckIn('urge', 15));
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [plan, setPlan] = useState('');
  const [during, setDuring] = useState<{ t: number; v: number }[]>([]);

  return (
    <div class="accent-urge">
      <TopBar title={g.name} />
      <Steps n={3} at={step} />
      {step === 0 && (
        <>
          <h1>Ride it out</h1>
          <div class="note warn" style="font-weight:600">{NOT_TREATMENT}</div>
          <p class="lead">Urges usually peak and fade within minutes if you don't act on them. For the next 15 minutes, your only job is to wait and watch it.</p>
          <div class="card">
            <div class="field-head"><span>How strong is the urge?</span></div>
            <Rating label="Urge before" value={before} onChange={setBefore} low="none" high="overwhelming" />
            <div class="field-head" style="margin-top:14px"><span>For the next 15 minutes, I'll…</span></div>
            <textarea value={plan} placeholder="My delay plan" onInput={(e) => setPlan((e.target as HTMLTextAreaElement).value)} />
            <div class="chips" style="margin-top:8px">
              {PLAN_IDEAS.map((p) => <button class="chip" onClick={() => setPlan(plan ? `${plan}, ${p.toLowerCase()}` : p)}>{p}</button>)}
            </div>
          </div>
          <div class="btn-row">
            <button class="btn" onClick={() => (helpOpen.value = true)}><Icon name="heart" size={18} /> Talk to someone</button>
          </div>
          <button class="btn primary block" onClick={() => { ci.current.before = before; ci.current.plan = plan; setStep(1); }}>Start the 15 minutes</button>
        </>
      )}
      {step === 1 && (
        <>
          <GoalBadges id="urge" />
          {plan && <div class="note"><b>My plan:</b> {plan}</div>}
          <Player
            goalId="urge"
            title="Ride an urge"
            sounds={g.sounds}
            defaultSound={g.defaultSound}
            minutes={15}
            minuteOptions={[10, 15, 20]}
            breathing
            autoStart
            onFinish={() => { ci.current.during = during; setStep(2); }}
          >
            {(t, playing) => {
              const current = [...URGE_PROMPTS].reverse().find((p) => t >= p.at) ?? URGE_PROMPTS[0];
              const rated = during.some((d) => d.t >= current.at && d.t < current.at + 120);
              return (
                <>
                  <div class="prompt-card" key={current.at}>
                    <p style="margin:0">{current.text}</p>
                    {current.rate && playing && !rated && (
                      <div style="margin-top:10px">
                        <Rating label="Urge now" value={null} onChange={(v) => setDuring([...during, { t: Math.round(t), v }])} low="none" high="overwhelming" />
                      </div>
                    )}
                    {current.rate && rated && <p class="tiny muted" style="margin:8px 0 0">Noted. Keep riding it.</p>}
                  </div>
                  <div class="center" style="margin:6px 0 10px"><HelpButton /></div>
                </>
              );
            }}
          </Player>
        </>
      )}
      {step === 2 && (
        <>
          <h1>You waited.</h1>
          <div class="card">
            <div class="field-head"><span>How strong is the urge now?</span></div>
            <Rating label="Urge after" value={after} onChange={setAfter} low="none" high="overwhelming" />
            <UrgeChart points={[...(before !== null ? [{ t: 0, v: before }] : []), ...during, ...(after !== null ? [{ t: 900, v: after }] : [])]} />
            {before !== null && after !== null && (
              <p class="small" style="margin-bottom:0">
                {after < before ? `It went from ${before} to ${after}. You rode it out.` : `It's still strong. That happens. You can do another round, move your body, or reach out to someone.`}
              </p>
            )}
          </div>
          <div class="btn-row">
            <button class="btn" onClick={() => go('/move')}><Icon name="walk" size={18} /> Movement break</button>
            <button class="btn" onClick={() => { setStep(1); }}>Another round</button>
          </div>
          <button class="btn block" onClick={() => (helpOpen.value = true)}><Icon name="heart" size={18} /> Talk to someone</button>
          <button
            class="btn primary block"
            style="margin-top:10px"
            onClick={async () => {
              ci.current.after = after;
              await saveCheckIn(ci.current);
              go('/');
            }}
          >
            Done
          </button>
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

// --- Sleep ------------------------------------------------------------------

export const SLEEP_HABITS = [
  'Same wake-up time every day, even on weekends',
  'Screens dimmed or away for the last 30–60 minutes',
  'No caffeine after early afternoon',
  'Room cool, dark and quiet',
  'Bed only for sleep (not work or scrolling)',
  "If awake for ~20 minutes, get up and do something calm until sleepy",
  'Some daylight soon after waking',
  'Go easy on alcohol near bedtime',
];

export function Sleep() {
  const g = GOAL_BY_ID.sleep;
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  return (
    <div class="accent-sleep">
      <TopBar title={g.name} />
      {step === 0 && (
        <>
          <h1>Wind down</h1>
          <p class="lead">Start this when you're already in bed. The sound plays gently, then fades out slowly and stops on its own.</p>
          <GoalBadges id="sleep" />
          <div class="note warn">This is designed to make you drowsy. Never use it while driving or when you need to stay alert.</div>
          <div class="card">
            <h3 style="margin-top:0">Tonight's habits <span class="faint small">(these matter more than any sound)</span></h3>
            {SLEEP_HABITS.map((h, i) => (
              <label class="check">
                <input type="checkbox" checked={checked.has(i)} onChange={() => { const n = new Set(checked); n.has(i) ? n.delete(i) : n.add(i); setChecked(n); }} />
                <span class="small">{h}</span>
              </label>
            ))}
          </div>
          <button class="btn primary block" onClick={() => setStep(1)}>Start wind-down</button>
          <button class="btn ghost block" style="margin-top:8px" onClick={() => go('/sleep/diary')}>Morning check-in (sleep diary)</button>
          <p class="tiny faint">If poor sleep goes on for weeks, talk to a doctor. Structured sleep programs work well and are the best-supported option.</p>
        </>
      )}
      {step === 1 && (
        <>
          <Player
            goalId="sleep"
            title="Wind down"
            sounds={g.sounds}
            defaultSound={g.defaultSound}
            minutes={g.minutes}
            minuteOptions={[20, 25, 30]}
            breathing
            sleep
            autoStart
            guide={(t) => (t < 60 ? 'Get comfortable. You can close your eyes. Breathe with the swell.' : null)}
            onFinish={(_, early) => (early ? setStep(0) : setStep(2))}
          />
          <p class="tiny faint center">Full sound for 5 minutes, then a slow fade to silence.</p>
        </>
      )}
      {step === 2 && <Done title="Good night">{null}</Done>}
    </div>
  );
}

// --- Focus -----------------------------------------------------------------

export function Focus() {
  const g = GOAL_BY_ID.focus;
  const [step, setStep] = useState(0);
  const [task, setTask] = useState('');
  const [blocks, setBlocks] = useState(0);
  const [key, setKey] = useState(0);
  return (
    <div class="accent-focus">
      <TopBar title={g.name} />
      {step === 0 && (
        <>
          <h1>One block, one thing</h1>
          <p class="lead">Pick a single task. Phone face down, notifications off. Steady sound covers small noises.</p>
          <GoalBadges id="focus" />
          <div class="card">
            <div class="field-head"><span>This block I'll work on</span></div>
            <input type="text" value={task} placeholder="e.g. draft the intro" onInput={(e) => setTask((e.target as HTMLInputElement).value)} />
          </div>
          <button class="btn primary block" onClick={() => setStep(1)}>Start block</button>
        </>
      )}
      {step === 1 && (
        <>
          {task && <div class="note"><b>Working on:</b> {task}</div>}
          <Player
            key={key}
            goalId="focus"
            title="Focus block"
            sounds={g.sounds}
            defaultSound={g.defaultSound}
            minutes={25}
            minuteOptions={[15, 25, 50]}
            breathing={false}
            autoStart
            onFinish={(_, early) => { if (!early) setBlocks(blocks + 1); setStep(2); }}
          />
        </>
      )}
      {step === 2 && (
        <Done title={blocks ? `Block done${blocks > 1 ? ` (${blocks} today)` : ''}` : 'Block stopped'}>
          <p class="muted">Take a 5-minute break. Stand up, look at something far away, move a little.</p>
          <div class="btn-row">
            <button class="btn" onClick={() => go('/move')}><Icon name="walk" size={18} /> Movement break</button>
            <button class="btn" onClick={() => { setKey(key + 1); setStep(1); }}>Next block</button>
          </div>
        </Done>
      )}
    </div>
  );
}

// --- Breathe (practice) ----------------------------------------------------

const MINDFUL = [
  'Notice the air, cool coming in, warm going out.',
  "Let the breath out be the longest part.",
  'If your mind wanders, that is normal. Come back to the next breath.',
  'Notice your shoulders. Let them drop.',
  'Notice three sounds around you, then come back to the breath.',
  'Feel where your body touches the chair or floor.',
];

export function Breathe() {
  const s = settings.value;
  const [done, setDone] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <div class="accent-breathe">
      <TopBar title="Breathe" />
      <div class="badges" style="margin:4px 0 10px">
        <Badge label="Breathing" evidence="breathing" />
        <Badge label="Mindfulness" evidence="mindfulness" />
      </div>
      <Seg
        value={s.breath.mode}
        label="Pattern"
        onChange={(mode) => updateSettings({ breath: { ...s.breath, mode } })}
        options={[{ v: 'paced', label: `Slow · ${s.breath.bpm}/min` }, { v: 'sigh', label: 'Cyclic sigh' }]}
      />
      {done ? (
        <Done title="Practice done" again={() => { setDone(false); setKey(key + 1); }}>
          <p class="muted">Five minutes a day of this was enough to lift mood in one study.</p>
        </Done>
      ) : (
        <Player
          key={key}
          goalId="breathe"
          title="Breathe"
          sounds={['hush', 'rain', 'drift']}
          defaultSound="hush"
          allowNone
          minutes={3}
          minuteOptions={[2, 3, 5]}
          breathing
          guide={(t, total) => (t > 0 && t < total ? MINDFUL[Math.floor(t / 40) % MINDFUL.length] : s.breath.mode === 'sigh' ? 'In through the nose, a short extra sip, then a long slow breath out.' : 'In as the circle grows, out as it shrinks.')}
          onFinish={(_, early) => !early && setDone(true)}
        />
      )}
    </div>
  );
}

// --- Movement break ----------------------------------------------------------

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
    <div class="accent-calm">
      <TopBar title="Movement break" />
      <div class="badges" style="margin:4px 0 10px"><Badge label="Brief movement" evidence="movement" /></div>
      <h1>{finished ? 'Nice work.' : 'Move for a few minutes'}</h1>
      <p class="lead">A short burst of movement can take the edge off an urge and clear your head.</p>
      <div class="card center">
        <div class="timer">{fmtTime(left)}</div>
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
