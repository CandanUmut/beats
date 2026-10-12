// "Find my sound": pick music you like from everything in the app (tap to
// preview), learn what the beat is and hear it on its own, then choose a
// length and a view. Saved as your version of the mood.

import { useEffect, useState } from 'preact/hooks';
import * as engine from '../../audio/engine';
import { MOOD_BY_ID, BEAT_FEELS, MINUTE_OPTIONS, feelName, type MoodId, type Recipe } from '../../data/moods';
import { settings, recipeFor, saveRecipe, resolveBeatType } from '../../data/settings';
import { CATEGORIES, SOUNDS, displayName } from '../../music/catalog';
import { Icon, MoodGlyph, Seg, Steps, TopBar } from '../components';
import { demoBeat, hasNotes, loadForPlay, recipeParams } from '../Player';
import { SceneThumb } from '../Scene';
import { SCENES } from '../scenes';
import { go } from '../router';

type Stage = 'music' | 'beat' | 'length' | 'look' | 'done';
const ORDER: Stage[] = ['music', 'beat', 'length', 'look'];

export function Tuner({ moodId }: { moodId: MoodId }) {
  const mood = MOOD_BY_ID[moodId];
  const [stage, setStage] = useState<Stage>('music');
  const [r, setR] = useState<Recipe>(() => recipeFor(moodId));
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => () => { void engine.stopSession(0.8); }, []);

  /** Play `id` with the given recipe as a preview (no breathing swell). */
  async function preview(id: string, rec: Recipe) {
    const loaded = await loadForPlay(id, setBusy);
    const params = recipeParams({ ...rec, sound: id, breathing: false }, { volume: settings.value.volume });
    if (engine.status.value === 'playing') {
      engine.setMusic(loaded.key);
      engine.updateParams(params);
    } else {
      await engine.startSession({ music: loaded.key, noise: null, params, timing: { duration: 20 * 60, fadeIn: 1.5, fadeOut: 3 }, title: 'Preview' });
    }
    setPreviewing(id);
  }

  async function stopPreview() {
    await engine.stopSession(0.8);
    setPreviewing(null);
  }

  function next() {
    void stopPreview();
    setStage(ORDER[ORDER.indexOf(stage) + 1] ?? 'done');
  }
  function prev() {
    void stopPreview();
    const i = ORDER.indexOf(stage);
    if (i <= 0) go(`/m/${moodId}`);
    else setStage(ORDER[i - 1]);
  }

  const row = (id: string) => {
    const d = displayName(id);
    const on = previewing === id;
    const chosen = r.sound === id;
    return (
      <div class={`taste-opt ${on ? 'playing' : ''}`}>
        <button class="letter" aria-label={on ? 'Stop preview' : 'Preview'} onClick={() => (on ? void stopPreview() : void preview(id, { ...r, beat: { ...r.beat, on: false } }))}>
          <Icon name={on ? 'stop' : 'play'} size={16} />
        </button>
        <span style="flex:1;min-width:0"><div class="tt">{d.title}</div><div class="st">{d.sub}</div></span>
        <button class={`btn small pick ${chosen ? 'primary' : ''}`} onClick={() => setR({ ...r, sound: id })}>{chosen ? 'Chosen' : 'Choose'}</button>
      </div>
    );
  };

  const stepAt = ORDER.indexOf(stage);
  return (
    <div class={`accent-${mood.accent}`}>
      <TopBar onBack={prev} />
      {stage !== 'done' && <Steps n={ORDER.length} at={stepAt} />}

      {stage === 'music' && (
        <>
          <div class="session-head"><div class="eyebrow">Find my sound · {mood.name}</div><h1>Pick music you like</h1></div>
          <p class="muted small">Tap ▶ to listen, then choose the one that feels right. Anything goes.</p>
          {busy && <p class="small muted">{busy}</p>}
          <div class="lib-cat"><h3>Suggested for {mood.name.toLowerCase()}</h3></div>
          <div class="taste">{mood.tasteMusic.map(row)}</div>
          {!showAll ? (
            <button class="btn block ghost" onClick={() => setShowAll(true)}>Show all music</button>
          ) : (
            CATEGORIES.map((c) => (
              <div>
                <div class="lib-cat"><h3>{c.name}</h3><div class="tiny faint">{c.blurb}</div></div>
                <div class="taste">{SOUNDS.filter((x) => x.category === c.id).map((x) => row(x.id))}</div>
              </div>
            ))
          )}
          <div class="sticky-next"><button class="btn primary block" onClick={next}>Next: the beat</button></div>
        </>
      )}

      {stage === 'beat' && (
        <>
          <div class="session-head"><div class="eyebrow">Step 2 · The beat</div><h1>Add a beat?</h1></div>
          <p class="small" style="margin-top:0">A soft pulse under your music, more felt than heard. With headphones, each ear gets a slightly different tone and you hear a slow wobble between your ears. On a speaker, the music gently pulses.</p>
          <div class="field">
            <div class="field-head"><span>Listening on</span></div>
            <Seg value={resolveBeatType(r.beat.type)} label="Listening on" onChange={(type) => setR({ ...r, beat: { ...r.beat, type } })} options={[{ v: 'binaural', label: 'Headphones' }, { v: 'pulse', label: 'Speaker' }]} />
          </div>
          <div class="btn-row">
            <button class="btn small" onClick={() => { setPreviewing(null); void demoBeat(r.beat.rate, r.beat.type === 'auto' ? resolveBeatType('auto') : r.beat.type, 'strong'); }}><Icon name="headphones" /> On its own</button>
            <button class="btn small" onClick={() => void preview(r.sound, { ...r, beat: { ...r.beat, on: true } })}><Icon name="note" /> With my music</button>
          </div>
          <p class="tiny muted" style="margin-top:-4px">You'll hear the {resolveBeatType(r.beat.type) === 'binaural' ? 'headphone' : 'speaker'} version.</p>
          <div class="btn-row">
            <button class={`btn ${r.beat.on ? 'primary' : ''}`} onClick={() => { setR({ ...r, beat: { ...r.beat, on: true } }); next(); }}>Keep the beat</button>
            <button class={`btn ${!r.beat.on ? 'primary' : ''}`} onClick={() => { setR({ ...r, beat: { ...r.beat, on: false } }); next(); }}>No beat</button>
          </div>
          <details class="more">
            <summary>Pace: {feelName(r.beat.rate)} · {BEAT_FEELS.find((f) => f.rate === r.beat.rate)?.hint} · Change</summary>
            <div class="feel-list">
              {BEAT_FEELS.map((f) => (
                <button class={`feel-opt ${r.beat.rate === f.rate ? 'on' : ''}`} onClick={() => setR({ ...r, beat: { ...r.beat, rate: f.rate, on: true } })}>
                  <span class="radio" />
                  <span><b>{f.name}</b> <span class="muted">· {f.hint}</span><div class="tiny muted">{f.about}</div></span>
                </button>
              ))}
            </div>
            <p class="tiny faint">The paces sound alike; the suggested one for {mood.name.toLowerCase()} comes from the studies.</p>
          </details>
        </>
      )}

      {stage === 'length' && (
        <>
          <div class="session-head"><div class="eyebrow">Step 3 · Length</div><h1>How long?</h1></div>
          <p class="muted small">Minutes. {mood.name} usually works well at {mood.minuteOptions.join(', ')}.</p>
          <div class="minute-grid">{MINUTE_OPTIONS.map((m) => <button class={`chip ${r.minutes === m ? 'on' : ''}`} onClick={() => setR({ ...r, minutes: m })}>{m}</button>)}</div>
          <button class="btn primary block" style="margin-top:18px" onClick={next}>Next: the view</button>
        </>
      )}

      {stage === 'look' && (
        <>
          <div class="session-head"><div class="eyebrow">Step 4 · View</div><h1>Where do you want to be?</h1></div>
          <p class="muted small">Each scene moves with your breath: the tide comes in, the mist rises, the sun lifts.</p>
          <div class="scene-grid big">
            {SCENES.map((sc) => (
              <button class={`scene-opt ${(r.visual === 'scene' || (r.visual ?? 'auto') === 'auto') && r.scene === sc.id ? 'on' : ''}`} onClick={() => setR({ ...r, visual: r.visual === 'auto' || !r.visual ? 'auto' : 'scene', scene: sc.id })}>
                <SceneThumb scene={sc.id} />
                <span>{sc.name}</span>
              </button>
            ))}
          </div>
          <div class="chips" style="margin-top:10px">
            <button class={`chip ${(r.visual ?? 'auto') === 'auto' ? 'on' : ''}`} onClick={() => setR({ ...r, visual: 'auto' })}>Auto</button>
            <button class={`chip ${r.visual === 'piano' ? 'on' : ''}`} disabled={!hasNotes(r.sound)} onClick={() => setR({ ...r, visual: 'piano' })}>Piano keys</button>
            <button class={`chip ${r.visual === 'strings' ? 'on' : ''}`} disabled={!hasNotes(r.sound)} onClick={() => setR({ ...r, visual: 'strings' })}>Strings</button>
            <button class={`chip ${r.visual === 'lamp' ? 'on' : ''}`} onClick={() => setR({ ...r, visual: 'lamp' })}>Lamp</button>
          </div>
          <button class="btn primary block" style="margin-top:18px" onClick={next}>Finish</button>
        </>
      )}

      {stage === 'done' && (
        <>
          <div class="card center" style="padding:28px 18px">
            <div style="width:64px;height:64px;margin:0 auto;color:var(--accent)"><MoodGlyph id={moodId} /></div>
            <div class="eyebrow" style="margin-top:8px">Your {mood.name.toLowerCase()} sound</div>
            <h2 style="margin:6px 0">{displayName(r.sound).title}</h2>
            <p class="muted" style="margin:0">{r.beat.on ? `${feelName(r.beat.rate)} beat` : 'No beat'} · {r.minutes} min · {r.visual === 'scene' || (r.visual ?? 'auto') === 'auto' ? SCENES.find((x) => x.id === r.scene)?.name : r.visual === 'piano' ? 'Piano keys' : r.visual === 'strings' ? 'Strings' : 'Lamp'}</p>
            <p class="tiny faint" style="margin:10px 0 0">Taste changes from day to day. Run it again any time.</p>
          </div>
          <button class="btn primary block" onClick={() => { saveRecipe(moodId, r); go(`/m/${moodId}`); }}>Save and start</button>
          <button class="btn ghost block" style="margin-top:8px" onClick={() => setStage('music')}>Start over</button>
        </>
      )}
    </div>
  );
}
