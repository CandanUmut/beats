// "Find my sound": a quick taste test. Hear a few versions back to back,
// pick what feels best, and the app saves it as your version of the mood.

import { useEffect, useRef, useState } from 'preact/hooks';
import * as engine from '../../audio/engine';
import { MOOD_BY_ID, BEAT_FEELS, feelName, type MoodId, type Recipe } from '../../data/moods';
import { settings, recipeFor, saveRecipe } from '../../data/settings';
import { SOUND_BY_ID } from '../../music/catalog';
import { Icon, MoodGlyph, Steps, TopBar } from '../components';
import { loadForPlay, recipeParams, shortTitle } from '../Player';
import { go } from '../router';

const SLOT = 25; // seconds per option before moving on

type Stage = 'intro' | 'music' | 'beat' | 'done';

export function Tuner({ moodId }: { moodId: MoodId }) {
  const mood = MOOD_BY_ID[moodId];
  const base = recipeFor(moodId);
  const [stage, setStage] = useState<Stage>('intro');
  const [busy, setBusy] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [slotStart, setSlotStart] = useState(0);
  const [now, setNow] = useState(0);
  const [choice, setChoice] = useState<Recipe>(base);
  const keys = useRef<Record<string, string | null>>({});
  const musicOpts = [...new Set(mood.tasteMusic)].filter((id) => SOUND_BY_ID[id]);
  const beatOpts = mood.tasteBeats;
  const opts = stage === 'beat' ? beatOpts.length : musicOpts.length;

  // Clock for the progress bars and auto-advance.
  useEffect(() => {
    if (stage !== 'music' && stage !== 'beat') return;
    const id = setInterval(() => setNow(performance.now() / 1000), 200);
    return () => clearInterval(id);
  }, [stage]);
  useEffect(() => {
    if ((stage === 'music' || stage === 'beat') && now - slotStart > SLOT) select((idx + 1) % opts);
  }, [now]);
  useEffect(() => () => { void engine.stopSession(1); }, []);

  function recipeAt(st: Stage, i: number, r: Recipe): Recipe {
    if (st === 'music') return { ...r, sound: musicOpts[i] };
    const rate = beatOpts[i];
    return { ...r, beat: { ...r.beat, on: rate > 0, rate: rate || r.beat.rate } };
  }

  async function begin() {
    await engine.ensureAudio();
    setBusy('Getting the music ready…');
    for (const id of musicOpts) keys.current[id] = (await loadForPlay(id)).key;
    setBusy(null);
    const r = recipeAt('music', 0, base);
    await engine.startSession({
      music: keys.current[musicOpts[0]],
      noise: null,
      params: recipeParams(r, { volume: settings.value.volume }),
      timing: { duration: 15 * 60, fadeIn: 3, fadeOut: 4 },
      title: `Finding your ${mood.name.toLowerCase()} sound`,
    });
    setStage('music');
    setIdx(0);
    setSlotStart(performance.now() / 1000);
  }

  function select(i: number, st: Stage = stage) {
    setIdx(i);
    setSlotStart(performance.now() / 1000);
    const r = recipeAt(st, i, choice);
    if (st === 'music') engine.setMusic(keys.current[r.sound] ?? null);
    engine.updateParams(recipeParams(r, { volume: settings.value.volume }));
  }

  function pick(i: number) {
    const r = recipeAt(stage, i, choice);
    setChoice(r);
    if (stage === 'music') {
      setStage('beat');
      setIdx(0);
      setSlotStart(performance.now() / 1000);
      const first = recipeAt('beat', 0, r);
      engine.updateParams(recipeParams(first, { volume: settings.value.volume }));
    } else {
      setStage('done');
      void engine.stopSession(2.5);
    }
  }

  const elapsed = Math.max(0, now - slotStart);
  const label = (i: number) => {
    if (stage === 'music') {
      const it = SOUND_BY_ID[musicOpts[i]];
      return { t: shortTitle(musicOpts[i]), s: it?.category === 'classical' ? it.subtitle : it?.subtitle ?? '' };
    }
    const rate = beatOpts[i];
    if (!rate) return { t: 'No beat', s: 'Just the music and breathing' };
    const f = BEAT_FEELS.find((x) => x.rate === rate);
    return { t: `${f?.name ?? feelName(rate)} beat`, s: f?.hint ?? `${rate} Hz` };
  };

  return (
    <div class={`accent-${mood.accent}`}>
      <TopBar onBack={() => go(`/m/${moodId}`)} />
      {stage !== 'intro' && stage !== 'done' && <Steps n={2} at={stage === 'music' ? 0 : 1} />}
      {stage === 'intro' && (
        <>
          <div class="session-head"><div class="eyebrow">Find my sound · {mood.name}</div><h1>A quick <em>taste test</em></h1></div>
          <p class="lead">You'll hear a few versions, about {SLOT} seconds each. Tap any one to hear it again, and press <b>This one</b> on the version that feels best. First the music, then the beat. About three minutes.</p>
          <div class="card">
            <p class="small" style="margin:0">Put on headphones if you have them, settle in, and listen for which one makes you feel more <b>{mood.name.toLowerCase()}</b>. There's no wrong answer.</p>
          </div>
          <button class="btn primary block" disabled={!!busy} onClick={begin}>{busy ?? 'Start listening'}</button>
        </>
      )}
      {(stage === 'music' || stage === 'beat') && (
        <>
          <div class="session-head">
            <div class="eyebrow">{stage === 'music' ? 'Step 1 · Music' : 'Step 2 · Beat'}</div>
            <h1>{stage === 'music' ? 'Which music?' : 'Which beat?'}</h1>
          </div>
          <p class="muted small">Now playing <b style="color:var(--text)">{label(idx).t}</b>. It moves on by itself; tap to go back.</p>
          <div class="taste">
            {Array.from({ length: opts }, (_, i) => {
              const l = label(i);
              const on = i === idx;
              return (
                <div class={`taste-opt ${on ? 'playing' : ''}`} role="button" tabIndex={0} onClick={() => select(i)}>
                  <span class="letter">{'ABC'[i]}</span>
                  <span><div class="tt">{l.t}</div><div class="st">{l.s}</div></span>
                  <button class={`btn small pick ${on ? 'primary' : ''}`} onClick={(e) => { e.stopPropagation(); pick(i); }}>This one</button>
                  {on && <i class="bar" style={{ width: `${Math.min(100, (elapsed / SLOT) * 100)}%` }} />}
                </div>
              );
            })}
          </div>
          <p class="tiny faint center">Breathing stays the same so you're only comparing one thing at a time.</p>
        </>
      )}
      {stage === 'done' && (
        <>
          <div class="card center" style="padding:28px 18px">
            <div style="width:64px;height:64px;margin:0 auto;color:var(--accent)"><MoodGlyph id={moodId} /></div>
            <div class="eyebrow" style="margin-top:8px">Your {mood.name.toLowerCase()} sound</div>
            <h2 style="margin:6px 0">{shortTitle(choice.sound)}</h2>
            <p class="muted" style="margin:0">{choice.beat.on ? `${feelName(choice.beat.rate)} beat` : 'No beat'}</p>
          </div>
          <button class="btn primary block" onClick={() => { saveRecipe(moodId, choice); go(`/m/${moodId}`); }}>Save and start</button>
          <button class="btn ghost block" style="margin-top:8px" onClick={() => { setChoice(base); setStage('intro'); }}><Icon name="spark" /> Try again</button>
        </>
      )}
    </div>
  );
}
