import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as engine from '../audio/engine';
import type { TrackId } from '../audio/dsp/synth';
import { breathAt, patternFor, BPM_MIN, BPM_MAX, type BreathPattern, type BreathPhase } from '../audio/dsp/breath';
import { DEFAULT_PARAMS, type MixParams, type SessionTiming } from '../audio/dsp/mixer';
import { settings, updateSettings, recipeFor, saveRecipe, resetRecipe, isCustom, resolveBeatType } from '../data/settings';
import { recordSession } from '../data/usage';
import { db } from '../data/db';
import { BEAT_FEELS, MINUTE_OPTIONS, MOOD_BY_ID, STRENGTH, feelName, type MoodId, type Recipe, type Visual } from '../data/moods';
export type { Visual };
import { CATEGORIES, SOUNDS, SOUND_BY_ID, carrierFor, type Category } from '../music/catalog';
import { InstrumentView, MusicStrip, type Timeline } from './Instrument';
import { setCatBreath } from './Cat';
import { SceneView, SceneThumb } from './Scene';
import { SCENES, type SceneId } from './scenes';
import { Icon, Seg, Sheet, Slider, Toggle, fmtTime } from './components';
import { go } from './router';
import { LeftRight, Mono } from './screens/Onboarding';
import { PIECE_BY_ID, displayName, displayForPart } from '../music/catalog';

export interface PlayerProps {
  moodId: MoodId;
  /** Replaces the research line shown before play. */
  note?: string;
  /** Sleep mode: long fade-out, no screen wake lock. */
  sleep?: boolean;
  allowNone?: boolean;
  /** Text shown under the visual, given elapsed seconds. */
  guide?: (t: number, total: number) => string | null;
  /** Extra content under the controls, given elapsed seconds and playing state. */
  children?: (t: number, playing: boolean) => ComponentChildren;
  onFinish?: (seconds: number, early: boolean) => void;
  autoStart?: boolean;
}

export const PHASE_TEXT: Record<BreathPhase, string> = { in: 'Breathe in', topup: 'Sip in', hold: 'Hold', out: 'Breathe out' };

/** The lamp: a breathing light that grows as you breathe in, with a countdown. */
export function Orb({ pattern, active, playing, label }: { pattern: BreathPattern; active: boolean; playing: boolean; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const ph = useRef<HTMLSpanElement>(null);
  const ct = useRef<HTMLSpanElement>(null);
  const t0 = useRef(performance.now());
  const lastPhase = useRef<BreathPhase | null>(null);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const t = playing ? engine.sessionTime() : (performance.now() - t0.current) / 1000;
      const st = breathAt(pattern, t);
      const lvl = active ? st.level : 0.55;
      ref.current?.style.setProperty('--s', String(0.55 + 0.45 * lvl));
      ref.current?.style.setProperty('--g', String(lvl));
      if (ph.current) ph.current.textContent = active && playing ? PHASE_TEXT[st.phase] : label ?? '';
      if (ct.current) ct.current.textContent = active && playing ? String(Math.max(1, Math.ceil(st.remaining))) : '';
      if (active && playing && st.phase !== lastPhase.current) {
        if (lastPhase.current && settings.value.vibrate && 'vibrate' in navigator) navigator.vibrate(st.phase === 'out' ? [20] : [35]);
        lastPhase.current = st.phase;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pattern, active, playing, label]);
  return (
    <div class="lamp" ref={ref}>
      <div class="lamp-halo" />
      <div class="lamp-ring" />
      <div class="lamp-orb" />
      <div class="lamp-label"><div><span class="ph" ref={ph} /><span class="ct" ref={ct} /></div></div>
    </div>
  );
}

/** Large, plain breathing cue shown under the instrument animation. */
export function BreathCue({ pattern, playing }: { pattern: BreathPattern; playing: boolean }) {
  const ph = useRef<HTMLSpanElement>(null);
  const ct = useRef<HTMLSpanElement>(null);
  const t0 = useRef(performance.now());
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const t = playing ? engine.sessionTime() : (performance.now() - t0.current) / 1000;
      const st = breathAt(pattern, t);
      const text = PHASE_TEXT[st.phase];
      if (ph.current && ph.current.dataset.t !== text) {
        // Quick crossfade so the word doesn't jump.
        ph.current.dataset.t = text;
        ph.current.style.opacity = '0';
        const el = ph.current;
        setTimeout(() => { el.textContent = text; el.style.opacity = '1'; }, 150);
      }
      if (ct.current) ct.current.textContent = String(Math.max(1, Math.ceil(st.remaining)));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pattern, playing]);
  return (
    <div class="breath-cue" aria-live="off">
      <span class="ph" ref={ph} />
      <span class="ct" ref={ct} />
    </div>
  );
}

/** Turn a recipe into mixer parameters. */
export function recipeParams(r: Recipe, opts: { volume: number; music?: boolean }): MixParams {
  const tonic = SOUND_BY_ID[r.sound]?.tonic ?? 9;
  const st = STRENGTH[r.beat.strength];
  return {
    ...DEFAULT_PARAMS,
    musicGainDb: opts.music === false || r.sound === 'none' ? -80 : 0,
    noiseGainDb: -80,
    breath: { enabled: r.breathing, pattern: patternFor(r.breath), depthDb: r.breathing ? r.swellDb : 0 },
    rhythm: r.beat.on
      ? { mode: resolveBeatType(r.beat.type), rate: r.beat.rate, depth: st.depth, carrier: carrierFor(tonic), levelDb: st.levelDb }
      : { ...DEFAULT_PARAMS.rhythm, mode: 'off' },
    volume: opts.volume,
  };
}

export function timingFor(minutes: number, sleep?: boolean): SessionTiming {
  const duration = minutes * 60;
  return { duration, fadeIn: 4, fadeOut: sleep ? Math.max(60, duration - 5 * 60) : 8 };
}

/** Load a sound for playing; returns the engine key and the animation timeline. */
export async function loadForPlay(id: string, onBusy?: (s: string | null) => void): Promise<{ key: string | null; visual: Timeline | null }> {
  if (id === 'none') return { key: null, visual: null };
  const it = SOUND_BY_ID[id];
  if (!it) return { key: null, visual: null };
  if (it.kind === 'score') onBusy?.('Loading the piano…');
  else if (!(await hasCached(it.track!))) onBusy?.('Preparing sound… (first time only)');
  try {
    const loaded = await engine.loadSound(id);
    return { key: loaded.key, visual: loaded.visual };
  } finally {
    onBusy?.(null);
  }
}

type Section = 'music' | 'look' | 'breathing' | 'beat' | 'length';

/** Set before opening a mood page to start its session right away (Resume on Home). */
export const autoplay: { mood: MoodId | null } = { mood: null };

export function Player(p: PlayerProps) {
  const mood = MOOD_BY_ID[p.moodId];
  const s = settings.value;
  const [recipe, setRecipeState] = useState<Recipe>(() => recipeFor(p.moodId));
  const [upload, setUpload] = useState<engine.UploadInfo | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tune, setTune] = useState<Section | null>(null);
  const [library, setLibrary] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [hpSheet, setHpSheet] = useState(false);
  const [running, setRunning] = useState(false);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [nowPlaying, setNowPlaying] = useState<{ title: string; composer: string } | null>(null);
  const startedAt = useRef(0);
  const finished = useRef(false);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const sound = recipe.sound;
  const pattern = useMemo(() => patternFor(recipe.breath), [recipe.breath.mode, recipe.breath.bpm, recipe.breath.ratio]);
  const minutes = recipe.minutes;
  const total = minutes * 60;
  const status = engine.status.value;
  const playing = running && (status === 'playing' || status === 'stopping');
  const item = SOUND_BY_ID[sound];
  // What the stage shows: a scene, the piano or strings (needs notes), or the lamp.
  const view = resolveView(recipe);
  const sceneId: SceneId = recipe.scene ?? 'forest';
  const sceneHint = SCENES.find((x) => x.id === sceneId)?.hint ?? 'in as it rises, out as it falls';
  // The slim keys/strings strip under a painting, when the music has notes.
  const stripKind = SOUND_BY_ID[sound]?.visual;
  const strip: 'piano' | 'strings' | null = view === 'scene' && s.musicStrip && hasNotes(sound) && (stripKind === 'piano' || stripKind === 'strings') ? stripKind : null;

  function setRecipe(r: Recipe) {
    setRecipeState(r);
    if (r.sound !== 'upload') saveRecipe(p.moodId, r);
  }

  useEffect(() => {
    updateSettings({ lastMood: p.moodId });
  }, []);

  // Bedtime: a minute in, the screen dims almost to black. A tap brings it back for a while.
  useEffect(() => {
    if (!running || !p.sleep) return;
    const html = document.documentElement;
    let tm = window.setTimeout(() => html.classList.add('night-dim'), 60000);
    const wake = () => {
      html.classList.remove('night-dim');
      clearTimeout(tm);
      tm = window.setTimeout(() => html.classList.add('night-dim'), 10000);
    };
    window.addEventListener('pointerdown', wake);
    return () => { clearTimeout(tm); window.removeEventListener('pointerdown', wake); html.classList.remove('night-dim'); };
  }, [running, p.sleep]);

  // While a session plays, the page quiets down to the light, the breath and Stop.
  useEffect(() => {
    document.documentElement.classList.toggle('in-session', running);
    return () => document.documentElement.classList.remove('in-session');
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(engine.sessionTime()), 250);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    engine.updateParams(recipeParams(recipe, { volume: s.volume }));
  }, [running, recipe, s.volume]);

  useEffect(() => () => {
    if (running) void finish(true);
  }, [running]);

  useEffect(() => {
    if (p.autoStart || autoplay.mood === p.moodId) { autoplay.mood = null; void start(); }
  }, []);

  async function keyFor(choice: string): Promise<string | null> {
    if (choice === 'upload') return upload?.key ?? null;
    const r = await loadForPlay(choice, setBusy);
    setTimeline(r.visual);
    const first = r.visual?.parts?.[0];
    const d = first ? displayForPart(first.title) : null;
    setNowPlaying(d ? { title: d.title, composer: d.sub } : null);
    return r.key;
  }

  async function start() {
    setError(null);
    try {
      await engine.ensureAudio();
      if (engine.status.value !== 'idle') await engine.stopSession(0.3);
      const key = await keyFor(sound);
      finished.current = false;
      startedAt.current = Date.now();
      setElapsed(0);
      await engine.startSession({
        music: key,
        noise: null,
        params: recipeParams(recipe, { volume: s.volume }),
        timing: timingFor(minutes, p.sleep),
        title: nowPlaying?.title ?? mood.name,
        onEnded: () => void finish(false, true),
      });
      setRunning(true);
      setCatBreath(pattern);
      if (!p.sleep && 'wakeLock' in navigator) {
        try { wake.current = await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen'); } catch { /* not allowed */ }
      }
    } catch (e) {
      setError(`Sound could not start: ${String((e as Error).message ?? e)}`);
      setBusy(null);
    }
  }

  async function finish(early: boolean, natural = false) {
    if (finished.current) return;
    finished.current = true;
    const secs = natural ? total : engine.sessionTime();
    if (!natural) await engine.stopSession(2);
    setRunning(false);
    setCatBreath(null);
    wake.current?.release().catch(() => {});
    wake.current = null;
    await recordSession(mood.flow, startedAt.current, Math.min(secs, total));
    p.onFinish?.(secs, early);
  }

  async function pickSound(choice: string) {
    if (choice === 'upload' && !upload) {
      fileInput.current?.click();
      return;
    }
    setRecipe({ ...recipe, sound: choice });
    setTimeline(null);
    setNowPlaying(choice === 'upload' && upload ? { title: upload.name, composer: 'Your music' } : null);
    if (running) {
      try {
        engine.setMusic(await keyFor(choice));
      } catch (e) {
        setError(`Could not load that sound: ${String((e as Error).message ?? e)}`);
      }
    }
  }

  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    setBusy('Reading your file on this device…');
    try {
      const info = await engine.loadUpload(f);
      setUpload(info);
      setRecipeState({ ...recipe, sound: 'upload' });
      setTimeline(null);
      setNowPlaying({ title: info.name, composer: 'Your music' });
      if (running) engine.setMusic(info.key);
    } catch (err) {
      setError(`That file could not be read here: ${String((err as Error).message ?? err)}`);
    } finally {
      setBusy(null);
    }
  }

  const remaining = Math.max(0, total - elapsed);
  const guideText = p.guide?.(elapsed, total) ?? null;
  const custom = isCustom(p.moodId);

  const beatType = resolveBeatType(recipe.beat.type);
  const h = s.headphones;
  const askHeadphones = p.moodId !== 'calm' && p.moodId !== 'grounded' && recipe.beat.on && recipe.beat.type === 'auto' && h.lr === null && !h.at && s.hpPrompts < 2;
  useEffect(() => {
    if (askHeadphones) updateSettings({ hpPrompts: settings.value.hpPrompts + 1 });
  }, []);

  return (
    <div>
      <div class="stage">
        {view === 'piano' || view === 'strings' ? (
          <InstrumentView
            kind={view}
            timeline={timeline}
            playing={playing}
            breathing={recipe.breathing}
            pattern={pattern}
            showPill={false}
            hint={recipe.breathing ? 'Press play, then <b>breathe with the light</b>: in as it rises, out as it falls.' : 'Press play. The keys follow the music.'}
            onSwitch={() => setTune('look')}
            switchLabel={<><Icon name="eye" size={14} /> View</>}
            onPart={(title, composer) => { const d = displayForPart(title); setNowPlaying(d ? { title: d.title, composer: d.sub } : { title, composer }); }}
          />
        ) : view === 'scene' ? (
          <div class={`scene-frame${strip ? ' with-strip' : ''}`}>
            <SceneView scene={sceneId} playing={playing} breathing={recipe.breathing} pattern={pattern} hint={recipe.breathing ? `Press play, then breathe <b>${sceneHint}</b>.` : null}>
              <button class="view-pill" onClick={() => setTune('look')}><Icon name="eye" size={14} /> View</button>
            </SceneView>
            {strip && <MusicStrip kind={strip} timeline={timeline} playing={playing} onOpen={() => setRecipe({ ...recipe, visual: strip })} />}
          </div>
        ) : (
          <div class="lamp-wrap">
            <Orb pattern={pattern} active={recipe.breathing} playing={playing} label={playing ? 'Just listen' : 'Press play'} />
            <button class="view-pill" onClick={() => setTune('look')}><Icon name="eye" size={14} /> View</button>
          </div>
        )}
        {view === 'lamp' && recipe.breathing && !playing && (
          <p class="tiny muted center" style="margin:2px 0 0">then breathe with the light</p>
        )}
        {view !== 'lamp' && recipe.breathing && playing && <BreathCue pattern={pattern} playing={playing} />}
        <div class="now-playing">
          <button class="np-btn" onClick={() => setLibrary(true)} aria-label="Change the music">
            <span class="t">{sound === 'none' ? 'Silence' : nowPlaying?.title ?? (item ? displayName(sound).title : 'Your music')} <Icon name="chevdown" /></span>
            {sound !== 'none' && <span class="c">{nowPlaying?.composer ?? (item ? displayName(sound).sub : '')}</span>}
          </button>
        </div>
        {!playing && (p.note ? <p class="fact-line">{p.note}</p> : <p class="fact-line">{mood.fact} <a href={`#/evidence/${mood.evidence}`}>Why</a></p>)}
        {playing && guideText && <div class="guide">{guideText}</div>}
      </div>

      <div class="control-row">
        <button class="ctl" aria-label="Tune: volume, music, breathing, beat" onClick={() => setTune('music')}><span class="vol-btn"><Icon name="sliders" /></span><span class="ctl-l">Tune</span></button>
        {!running ? (
          <button class="play-btn" onClick={start} disabled={!!busy} aria-label="Start">
            <Icon name="play" />
          </button>
        ) : (
          <button class="play-btn" onClick={() => finish(true)} aria-label="Stop">
            <Icon name="stop" />
          </button>
        )}
        <button class="ctl" style="justify-self:end" onClick={() => setTune('length')} aria-label={`Length: ${minutes} minutes`}><span class="vol-btn"><Icon name="clock" /></span><span class="ctl-l">Length</span></button>
      </div>
      <p class="time-line">{running ? `${fmtTime(remaining)} left` : `${minutes} min`}</p>
      {busy && <p class="center muted small">{busy}</p>}
      {error && <div class="note danger-note">{error}</div>}

      {askHeadphones && !running && (
        <div class="card tight hp-card">
          <span style="color:var(--accent);display:grid"><Icon name="headphones" size={24} /></span>
          <span class="small">Using headphones? There's a headphone-only version of the beat.</span>
          <span class="hp-actions">
            <button class="link-btn" style="color:var(--faint);font-weight:600" onClick={() => updateSettings({ headphones: { ...h, at: Date.now() } })}>Not now</button>
            <button class="btn small" onClick={() => setHpSheet(true)}>Check (20 s)</button>
          </span>
        </div>
      )}
      {hpSheet && (
        <Sheet onClose={() => setHpSheet(false)}>
          <HeadphoneCheck onDone={() => setHpSheet(false)} />
        </Sheet>
      )}

      {p.children?.(elapsed, running)}

      <div class="card tight mix-card">
        <div class="field-head" style="margin:0">
          <span class="eyebrow">Your {mood.name.toLowerCase()} mix</span>
          <span class="tiny" style={{ color: custom ? 'var(--accent)' : 'var(--faint)', fontWeight: 700 }}>{custom ? 'Yours' : 'Suggested'}</span>
        </div>
        <div class="recipe">
          <button onClick={() => setTune('music')}><div class="k"><Icon name="note" />Music</div><div class="val">{shortTitle(sound, upload)}</div></button>
          <button onClick={() => setTune('breathing')}><div class="k"><Icon name="lungs" />Breathing</div><div class="val">{breathSummary(recipe)}</div></button>
          <button onClick={() => setTune('beat')}><div class="k"><Icon name="wave" />Beat</div><div class="val">{recipe.beat.on ? `${feelName(recipe.beat.rate)} · ${beatType === 'binaural' ? 'headphones' : 'speaker'}` : 'Off'}</div></button>
          <button onClick={() => setTune('length')}><div class="k"><Icon name="clock" />Length</div><div class="val">{minutes} min{p.sleep ? ', fades out' : ''}</div></button>
        </div>
        <button class="find-btn" onClick={() => go(`/tune/${p.moodId}`)}>
          <Icon name="headphones" />
          <span><div class="tt">Find my sound</div><div class="st">A two-minute listening test</div></span>
        </button>
      </div>

      <input ref={fileInput} type="file" accept="audio/*" hidden onChange={onFile} />

      {engine.lockMayStopSound() && (
        <p class="tiny faint">On this iPhone or iPad version, sound may stop when the screen locks. Updating to iOS 17.5 or newer fixes it; or use "Save as file" in Tune and play it in a music app.</p>
      )}

      {tune && (
        <TuneSheet
          moodId={p.moodId}
          focus={tune}
          recipe={recipe}
          setRecipe={setRecipe}
          running={running}
          allowNone={p.allowNone}
          uploadName={upload?.name}
          onBrowse={() => { setTune(null); setLibrary(true); }}
          onUpload={() => fileInput.current?.click()}
          onPickSound={(id) => void pickSound(id)}
          onExport={() => { setTune(null); setExportOpen(true); }}
          onReset={() => { resetRecipe(p.moodId); setRecipeState(recipeFor(p.moodId)); }}
          onClose={() => setTune(null)}
        />
      )}
      {library && <MusicLibrary current={sound} allowNone={p.allowNone} onPick={(id) => { setLibrary(false); if (id === 'upload') fileInput.current?.click(); else void pickSound(id); }} onClose={() => setLibrary(false)} />}
      {exportOpen && (
        <ExportSheet
          onClose={() => setExportOpen(false)}
          maxMinutes={minutes}
          make={async (mins) => ({
            music: await keyFor(sound),
            params: recipeParams(recipe, { volume: 1 }),
            timing: timingFor(mins, p.sleep),
          })}
        />
      )}
    </div>
  );
}

export function breathSummary(r: Recipe): string {
  if (!r.breathing) return 'Off';
  if (r.breath.mode === 'sigh') return 'Sigh breathing';
  return `${r.breath.bpm}/min${r.breath.ratio >= 1.3 ? ' · long out' : ''}`;
}

async function hasCached(id: TrackId): Promise<boolean> {
  try {
    return !!(await db.get('cache', `track:${id}:${engine.sampleRate()}:v4`));
  } catch {
    return false;
  }
}

export function shortTitle(id: string, upload?: engine.UploadInfo | null): string {
  if (id === 'upload') return upload?.name ?? 'Your music';
  if (id === 'none') return 'Silence';
  const it = SOUND_BY_ID[id];
  if (!it) return id;
  return displayName(id).title;
}

export function VolumeCard() {
  const s = settings.value;
  return (
    <div class="card tight">
      <Slider label="Volume" value={Math.round(s.volume * 100)} min={5} max={100} step={1} format={(v) => `${v}%`} onInput={(v) => updateSettings({ volume: v / 100 })} />
    </div>
  );
}

const PATTERN_OPTS: { v: 'even' | 'long' | 'sigh'; label: string }[] = [
  { v: 'even', label: 'Even' },
  { v: 'long', label: 'Long out' },
  { v: 'sigh', label: 'Sigh' },
];

function patternKey(r: Recipe): 'even' | 'long' | 'sigh' {
  if (r.breath.mode === 'sigh') return 'sigh';
  return r.breath.ratio >= 1.3 ? 'long' : 'even';
}

function TuneSheet(o: {
  moodId: MoodId; focus: Section; recipe: Recipe; setRecipe: (r: Recipe) => void; running: boolean; allowNone?: boolean; uploadName?: string;
  onBrowse: () => void; onUpload: () => void; onPickSound: (id: string) => void; onExport: () => void; onReset: () => void; onClose: () => void;
}) {
  const r = o.recipe;
  const set = (patch: Partial<Recipe>) => o.setRecipe({ ...r, ...patch });
  const mood = MOOD_BY_ID[o.moodId];
  const mono = settings.value.headphones.mono === 'mono';
  useEffect(() => {
    if (o.focus !== 'music') document.getElementById(`tune-${o.focus}`)?.scrollIntoView({ block: 'start' });
  }, []);
  const suggestions = [...new Set([r.sound, ...mood.tasteMusic])].filter((id) => SOUND_BY_ID[id]).slice(0, 5);
  return (
    <Sheet onClose={o.onClose}>
      <div class="sheet-head">
        <div class="sheet-head-row">
          <h2>Your {mood.name.toLowerCase()} mix</h2>
          <button class="btn small cream" onClick={o.onClose}>Done</button>
        </div>
        <p class="explain" style="margin:4px 0 0">Changes apply right away and are remembered.</p>
        <Slider label="Volume" value={Math.round(settings.value.volume * 100)} min={5} max={100} step={1} format={(v) => `${v}%`} onInput={(v) => updateSettings({ volume: v / 100 })} />
      </div>

      <div class="sheet-section" id="tune-music">
        <h3><Icon name="note" />Music</h3>
        <div class="chips">
          {suggestions.map((id) => <button class={`chip ${r.sound === id ? 'on' : ''}`} onClick={() => o.onPickSound(id)}>{shortTitle(id)}</button>)}
          {o.allowNone && <button class={`chip ${r.sound === 'none' ? 'on' : ''}`} onClick={() => o.onPickSound('none')}>Silence</button>}
        </div>
        <div class="btn-row" style="margin-top:4px">
          <button class="btn small" onClick={o.onBrowse}><Icon name="book" /> All music</button>
          <button class="btn small ghost" onClick={o.onUpload}><Icon name="upload" /> {o.uploadName ? 'Another file' : 'Your own file'}</button>
        </div>
      </div>

      <div class="sheet-section" id="tune-look">
        <h3><Icon name="eye" />View</h3>
        <div class="scene-grid">
          {SCENES.map((sc) => (
            <button class={`scene-opt ${(r.visual === 'scene' || (r.visual ?? 'auto') === 'auto') && r.scene === sc.id ? 'on' : ''}`} onClick={() => set({ visual: r.visual === 'auto' || !r.visual ? 'auto' : 'scene', scene: sc.id })}>
              <SceneThumb scene={sc.id} />
              <span>{sc.name}</span>
            </button>
          ))}
        </div>
        <div class="chips" style="margin-top:8px">
          <button class={`chip ${(r.visual ?? 'auto') === 'auto' ? 'on' : ''}`} onClick={() => set({ visual: 'auto' })}>Auto</button>
          <button class={`chip ${r.visual === 'piano' ? 'on' : ''}`} disabled={!hasNotes(r.sound)} onClick={() => set({ visual: 'piano' })}>Piano keys</button>
          <button class={`chip ${r.visual === 'strings' ? 'on' : ''}`} disabled={!hasNotes(r.sound)} onClick={() => set({ visual: 'strings' })}>Strings</button>
          <button class={`chip ${r.visual === 'lamp' ? 'on' : ''}`} onClick={() => set({ visual: 'lamp' })}>Lamp</button>
        </div>
        <p class="explain">Auto shows the strings for string music and your scene for everything else. Piano keys and strings follow the notes, so they need music with notes.</p>
      </div>

      <div class="sheet-section" id="tune-breathing">
        <h3><Icon name="lungs" />Breathing</h3>
        <Toggle label="Breathing guide" hint="A visual cue, and the music gently rises and falls with it" checked={r.breathing} onChange={(breathing) => set({ breathing })} />
        {r.breathing && (
          <>
            <div class="field">
              <div class="field-head"><span>Rhythm</span></div>
              <Seg value={patternKey(r)} label="Breathing rhythm" options={PATTERN_OPTS} onChange={(k) => set({ breath: k === 'sigh' ? { ...r.breath, mode: 'sigh' } : { ...r.breath, mode: 'paced', ratio: k === 'long' ? 1.6 : 1 } })} />
              <p class="explain" style="margin-top:6px">{patternKey(r) === 'sigh' ? 'Sigh: breathe in, take a small extra sip of air, then let it all out slowly.' : patternKey(r) === 'long' ? 'The breath out is longer than the breath in. Most people find this the most calming.' : 'In and out take the same time.'}</p>
            </div>
            {r.breath.mode === 'paced' && (
              <div class="field">
                <Slider label="Pace" value={r.breath.bpm} min={BPM_MIN} max={BPM_MAX} step={0.5} format={(v) => `${v} breaths a minute`} onInput={(bpm) => set({ breath: { ...r.breath, bpm } })} />
                <div class="field-ends"><span>slower</span><span>faster</span></div>
              </div>
            )}
            <div class="field">
              <div class="field-head"><span>Music follows your breath</span></div>
              <Seg value={r.swellDb === 0 ? 0 : r.swellDb <= 3 ? 3 : 6} label="Swell" onChange={(swellDb) => set({ swellDb })} options={[{ v: 0, label: 'Not at all' }, { v: 3, label: 'Gently' }, { v: 6, label: 'Clearly' }]} />
            </div>
          </>
        )}
      </div>

      <div class="sheet-section" id="tune-beat">
        <h3 class="group-head" style="justify-content:space-between"><span style="display:flex;gap:8px;align-items:center"><Icon name="wave" />Beat</span><a class="tiny" style="color:var(--faint);font-family:var(--sans);font-weight:600" href="#/evidence/beats-entrainment">The research</a></h3>
        <p class="explain">A soft, steady pulse woven under the music. With headphones, each ear gets a slightly different tone and you hear a slow "wobble" between them (a binaural beat). On a speaker, the music itself gently pulses. It's subtle on purpose: something you feel more than hear.</p>
        <Toggle label="Beat" checked={r.beat.on} onChange={(on) => set({ beat: { ...r.beat, on } })} />
        {r.beat.on && (
          <>
            <div class="field">
              <div class="field-head"><span>Pace</span></div>
              <div class="feel-list">
                {BEAT_FEELS.map((f) => (
                  <button class={`feel-opt ${r.beat.rate === f.rate ? 'on' : ''}`} onClick={() => set({ beat: { ...r.beat, rate: f.rate } })}>
                    <span class="radio" />
                    <span><b>{f.name}</b> <span class="muted">· {f.hint}</span><div class="tiny muted">{f.about}</div></span>
                  </button>
                ))}
              </div>
            </div>
            {!o.running && (
              <button class="btn small block" onClick={() => void demoBeat(r.beat.rate, r.beat.type, r.beat.strength)}><Icon name="headphones" /> Hear this beat on its own (10 s)</button>
            )}
            <div class="field">
              <div class="field-head"><span>Listening on</span></div>
              <Seg value={r.beat.type} label="Beat type" onChange={(type) => set({ beat: { ...r.beat, type } })} options={[{ v: 'auto', label: 'Auto' }, { v: 'binaural', label: 'Headphones' }, { v: 'pulse', label: 'Speaker' }]} />
              <p class="explain" style="margin-top:6px">
                {r.beat.type === 'binaural'
                  ? `Headphones: needs both earbuds in.${mono ? ' Your stereo check said mono, so Speaker will work better.' : ''}`
                  : r.beat.type === 'pulse'
                    ? 'Speaker: the music gently pulses. Works anywhere, even on one earbud.'
                    : `Auto: headphone beat if you've done the headphone check, otherwise the speaker pulse. Right now: ${resolveBeatType('auto') === 'binaural' ? 'headphones' : 'speaker'}.`}
              </p>
            </div>
            <div class="field">
              <div class="field-head"><span>Strength</span></div>
              <Seg value={r.beat.strength} label="Beat strength" onChange={(strength) => set({ beat: { ...r.beat, strength } })} options={(['subtle', 'medium', 'strong'] as const).map((k) => ({ v: k, label: STRENGTH[k].label }))} />
            </div>
          </>
        )}
      </div>

      <div class="sheet-section" id="tune-length">
        <h3><Icon name="clock" />Length</h3>
        <div class="minute-grid">{MINUTE_OPTIONS.map((m) => <button class={`chip ${r.minutes === m ? 'on' : ''}`} onClick={() => set({ minutes: m })}>{m}</button>)}</div>
        <p class="explain" style="margin-top:6px">Minutes. {mood.name} usually works well at {mood.minuteOptions.join(', ')}.</p>
        {o.running && <p class="explain">A new length applies next time you press play.</p>}
      </div>

      <div class="sheet-section">
        <div class="btn-row">
          <button class="btn small" onClick={() => go(`/tune/${o.moodId}`)}><Icon name="headphones" /> Find my sound</button>
          <button class="btn small ghost" onClick={o.onExport}><Icon name="download" /> Save as file</button>
        </div>
        <button class="link-btn" onClick={o.onReset}>Reset {mood.name.toLowerCase()} to the starting point</button>
      </div>
    </Sheet>
  );
}

const CAT_ICON: Record<Category, string> = { classical: 'note', piano: 'note', chill: 'wave', ambient: 'moon', strings: 'wave', musicbox: 'spark', nature: 'drop' };

export function MusicLibrary({ current, allowNone, onPick, onClose }: { current: string; allowNone?: boolean; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div class="sheet-head">
        <div class="sheet-head-row"><h2>Music</h2><button class="btn small cream" onClick={onClose}>Done</button></div>
        <p class="explain" style="margin:4px 0 0">Pick anything. Breathing and the beat follow along.</p>
      </div>
      <button class="lib-item" onClick={() => onPick('upload')}>
        <span class="ic"><Icon name="upload" /></span>
        <span><div class="tt">Your own music</div><div class="st">Any audio file on this device. It never leaves your phone.</div></span>
      </button>
      {allowNone && (
        <button class={`lib-item ${current === 'none' ? 'on' : ''}`} onClick={() => onPick('none')}>
          <span class="ic"><Icon name="x" /></span>
          <span><div class="tt">Silence</div><div class="st">Breathing only</div></span>
        </button>
      )}
      {CATEGORIES.map((c) => {
        const items = SOUNDS.filter((x) => x.category === c.id);
        const composers = c.id === 'classical' ? [...new Set(items.map((x) => x.subtitle))] : [null];
        return (
          <div>
            <div class="lib-cat"><h3>{c.name}</h3><div class="tiny faint">{c.blurb}</div></div>
            {composers.map((comp) => (
              <>
                {comp && <div class="lib-composer">{comp}</div>}
                {items.filter((x) => !comp || x.subtitle === comp).map((it) => {
                  const piece = it.id.startsWith('piece:') ? PIECE_BY_ID[it.id.slice(6)] : null;
                  return (
                    <button class={`lib-item ${current === it.id ? 'on' : ''}`} onClick={() => onPick(it.id)}>
                      <span class="ic"><Icon name={CAT_ICON[c.id]} /></span>
                      <span>
                        <div class="tt">{piece ? piece.short : it.title}</div>
                        <div class="st">{piece ? piece.feel : it.subtitle}{piece?.opus ? <span class="op"> · {piece.opus}</span> : null}</div>
                      </span>
                    </button>
                  );
                })}
              </>
            ))}
          </div>
        );
      })}
      <p class="tiny faint">Classical pieces are played from free scores (Mutopia Project) on a real upright piano (FreePats), with human timing and pedal added. Licenses: ATTRIBUTION.md.</p>
    </Sheet>
  );
}

function ExportSheet({ onClose, maxMinutes, make }: { onClose: () => void; maxMinutes: number; make: (mins: number) => Promise<{ music: string | null; params: MixParams; timing: SessionTiming }> }) {
  const [mins, setMins] = useState(Math.min(maxMinutes, 10));
  const [bits, setBits] = useState<16 | 24>(16);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rate = engine.sampleRate();
  const size = (mins * 60 * rate * 2 * bits) / 8;
  const opts = [5, 10, 15, 20, 25, 30, 45, 60].filter((m) => m <= Math.max(maxMinutes, 5));
  async function run() {
    setErr(null);
    setProgress(0);
    try {
      await engine.ensureAudio();
      const cfg = await make(mins);
      const blob = await engine.exportWav({ ...cfg, noise: null, bits, onProgress: setProgress });
      setResult({ url: URL.createObjectURL(blob), name: engine.neutralName() });
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setProgress(null);
    }
  }
  return (
    <Sheet onClose={onClose}>
      <h2>Save as a sound file</h2>
      <p class="explain">Makes a WAV file of this mix (music, breathing swell, beat and fades) on your device, for playing anywhere. Nothing is uploaded.</p>
      <div class="field">
        <div class="field-head"><span>Length</span></div>
        <div class="chips">{opts.map((m) => <button class={`chip ${m === mins ? 'on' : ''}`} onClick={() => setMins(m)}>{m} min</button>)}</div>
      </div>
      <Seg value={bits} onChange={setBits} label="Quality" options={[{ v: 16, label: 'Standard' }, { v: 24, label: 'Studio (bigger)' }]} />
      <p class="tiny faint">About {(size / 1e6).toFixed(0)} MB.</p>
      {progress !== null && (
        <div class="field">
          <div class="meter"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p class="tiny muted">Rendering… {Math.round(progress * 100)}%</p>
        </div>
      )}
      {err && <div class="note danger-note">{err}</div>}
      {result ? (
        <a class="btn primary block" href={result.url} download={result.name}><Icon name="download" /> Download {result.name}</a>
      ) : (
        <button class="btn primary block" disabled={progress !== null} onClick={run}>Make the file</button>
      )}
      <button class="btn block ghost" style="margin-top:8px" onClick={onClose}>Close</button>
    </Sheet>
  );
}

/** Headphone + stereo check, shown as a sheet over the player. */
function HeadphoneCheck({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'lr' | 'mono'>('lr');
  return step === 'lr' ? <LeftRight onNext={() => setStep('mono')} /> : <Mono onNext={onDone} />;
}

/** Which view to show: an explicit choice, or 'auto' (strings for string music, else the scene). */
export function resolveView(r: Recipe): Exclude<Visual, 'auto'> {
  const v = r.visual ?? 'auto';
  if (v === 'auto') return r.sound === 'strings' ? 'strings' : 'scene';
  if ((v === 'piano' || v === 'strings') && !hasNotes(r.sound)) return 'scene';
  return v;
}

/** Piano/strings animations need note data; noise and drones have none. */
export function hasNotes(id: string): boolean {
  if (id === 'upload' || id === 'none') return false;
  return !!SOUND_BY_ID[id] && !['rain', 'pink', 'brown', 'hush'].includes(id);
}

/** Play the beat on its own for a few seconds so people can hear what it is. */
export async function demoBeat(rate: number, type: 'auto' | 'binaural' | 'pulse', strength: Recipe['beat']['strength']): Promise<void> {
  await engine.ensureAudio();
  if (engine.status.value !== 'idle') await engine.stopSession(0.3);
  const mode = resolveBeatType(type);
  // A pulse needs something to pulse, so it plays on a soft drone.
  const music = mode === 'pulse' ? (await engine.loadSound('hush')).key : null;
  await engine.startSession({
    music,
    noise: null,
    params: {
      ...DEFAULT_PARAMS,
      musicGainDb: mode === 'pulse' ? -4 : -80,
      noiseGainDb: -80,
      breath: { enabled: false, pattern: patternFor({ mode: 'paced', bpm: 6, ratio: 1 }), depthDb: 0 },
      rhythm: { mode, rate, depth: Math.max(0.25, STRENGTH[strength].depth), carrier: 200, levelDb: -12 },
      volume: settings.value.volume,
    },
    timing: { duration: 10, fadeIn: 0.8, fadeOut: 1.5 },
    title: 'Beat preview',
  });
}
