import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as engine from '../audio/engine';
import type { TrackId } from '../audio/dsp/synth';
import { breathAt, patternFor, BPM_MIN, BPM_MAX, type BreathPattern, type BreathPhase } from '../audio/dsp/breath';
import { DEFAULT_PARAMS, type MixParams, type SessionTiming } from '../audio/dsp/mixer';
import { settings, updateSettings, recipeFor, saveRecipe, resetRecipe, isCustom } from '../data/settings';
import { recordSession } from '../data/usage';
import { db } from '../data/db';
import { BEAT_FEELS, MOOD_BY_ID, STRENGTH, feelName, type MoodId, type Recipe } from '../data/moods';
import { CATEGORIES, SOUNDS, SOUND_BY_ID, carrierFor, type Category } from '../music/catalog';
import { InstrumentView, type Timeline } from './Instrument';
import { Icon, Seg, Sheet, Slider, Toggle, fmtTime } from './components';
import { go } from './router';

export interface PlayerProps {
  moodId: MoodId;
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

export const PHASE_TEXT: Record<BreathPhase, string> = { in: 'Breathe in', topup: 'Sip more', hold: 'Hold', out: 'Breathe out' };

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
      if (ph.current) ph.current.textContent = active ? PHASE_TEXT[st.phase] : label ?? '';
      if (ct.current) ct.current.textContent = active ? String(Math.max(1, Math.ceil(st.remaining))) : '';
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
      ? { mode: r.beat.type, rate: r.beat.rate, depth: st.depth, carrier: carrierFor(tonic), levelDb: st.levelDb }
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

type Section = 'music' | 'breathing' | 'beat' | 'length';

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
  const instrument = item && item.visual !== 'orb' ? item.visual : null;
  const showInstrument = !!instrument && s.visual === 'instrument';

  function setRecipe(r: Recipe) {
    setRecipeState(r);
    if (r.sound !== 'upload') saveRecipe(p.moodId, r);
  }

  useEffect(() => {
    updateSettings({ lastMood: p.moodId });
  }, []);

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
    if (p.autoStart) void start();
  }, []);

  async function keyFor(choice: string): Promise<string | null> {
    if (choice === 'upload') return upload?.key ?? null;
    const r = await loadForPlay(choice, setBusy);
    setTimeline(r.visual);
    const first = r.visual?.parts?.[0];
    setNowPlaying(first ? { title: first.title, composer: first.composer } : null);
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

  return (
    <div>
      <div class="stage">
        {showInstrument ? (
          <InstrumentView kind={instrument!} timeline={timeline} playing={playing} breathing={recipe.breathing} pattern={pattern} onPart={(title, composer) => setNowPlaying({ title, composer })} />
        ) : (
          <Orb pattern={pattern} active={recipe.breathing} playing={playing} label={playing ? 'Just listen' : 'Ready'} />
        )}
        {instrument && (
          <div class="visual-toggle">
            <Seg value={s.visual} label="Visual" onChange={(visual) => updateSettings({ visual })} options={[{ v: 'instrument', label: instrument === 'piano' ? 'Piano' : 'Strings' }, { v: 'circle', label: 'Lamp' }]} />
          </div>
        )}
        <div class="now-playing">
          {sound !== 'none' && (
            <>
              <div class="t">{nowPlaying?.title ?? item?.title ?? 'Your music'}</div>
              <div class="c">{nowPlaying?.composer ?? item?.subtitle}</div>
            </>
          )}
        </div>
      </div>
      {guideText && <div class="guide">{guideText}</div>}

      <div class="control-row">
        <div>
          <div class="timer" aria-live="off">{fmtTime(running ? remaining : total)}</div>
          <div class="timer-sub">{running ? (p.sleep && elapsed > 300 ? 'fading out' : 'left') : 'minutes'}</div>
        </div>
        {!running ? (
          <button class="play-btn" onClick={start} disabled={!!busy} aria-label="Start">
            <Icon name="play" />
          </button>
        ) : (
          <button class="play-btn" onClick={() => finish(true)} aria-label="Stop">
            <Icon name="stop" />
          </button>
        )}
        <button class="btn small ghost side-btn" onClick={() => setTune('music')}><Icon name="sliders" /> Tune</button>
      </div>
      {busy && <p class="center muted small">{busy}</p>}
      {error && <div class="note danger-note">{error}</div>}

      {p.children?.(elapsed, running)}

      <div class="card tight">
        <div class="field-head" style="margin:0">
          <span class="eyebrow">Your {mood.name.toLowerCase()} mix</span>
          <span class="tiny faint">{custom ? 'tuned by you' : 'starting point'}</span>
        </div>
        <div class="recipe">
          <button onClick={() => setTune('music')}><div class="k"><Icon name="note" />Music</div><div class="val">{shortTitle(sound, upload)}</div></button>
          <button onClick={() => setTune('breathing')}><div class="k"><Icon name="lungs" />Breathing</div><div class="val">{breathSummary(recipe)}</div></button>
          <button onClick={() => setTune('beat')}><div class="k"><Icon name="wave" />Beat</div><div class="val">{recipe.beat.on ? `${feelName(recipe.beat.rate)} · ${recipe.beat.type === 'binaural' ? 'headphones' : 'speakers'}` : 'Off'}</div></button>
          <button onClick={() => setTune('length')}><div class="k"><Icon name="clock" />Length</div><div class="val">{minutes} min{p.sleep ? ', fades out' : ''}</div></button>
        </div>
        <div class="btn-row" style="margin-bottom:0">
          <button class="btn small" onClick={() => go(`/tune/${p.moodId}`)}><Icon name="spark" /> Find my sound</button>
          <button class="btn small ghost" onClick={() => setTune('music')}><Icon name="sliders" /> Fine-tune</button>
        </div>
      </div>

      <VolumeCard />

      <div class="fact">
        <Icon name="book" />
        <span>{mood.fact} <a href={`#/evidence/${mood.evidence}`}>The research</a></span>
      </div>

      <input ref={fileInput} type="file" accept="audio/*" hidden onChange={onFile} />

      {engine.isIOS() && (
        <p class="tiny faint">On iPhone and iPad, sound can stop when the screen locks. For long or overnight sessions, use "Save as file" in Tune and play it in a music app.</p>
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
  if (r.breath.mode === 'sigh') return 'Double inhale, long out';
  return `${r.breath.bpm} per min${r.breath.ratio >= 1.3 ? ', long out' : ''}`;
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
  if (it.category !== 'classical') return it.title;
  const last = it.subtitle.split(' ').pop();
  const t = it.title.replace(/ in [A-G][♭♯]? (major|minor)/, '').replace(/,? Op\. [0-9]+ No\. ([0-9]+)/, ' $1').replace(/\s*\(.*\)/, '').replace(/, BWV 846/, '');
  return `${last}: ${t}`;
}

export function VolumeCard() {
  const s = settings.value;
  return (
    <div class="card tight">
      <Slider label="Volume" value={Math.round(s.volume * 100)} min={5} max={100} step={1} format={(v) => `${v}%`} onInput={(v) => updateSettings({ volume: v / 100 })} />
      <p class="tiny faint" style="margin:0">Soft is best: you should still hear someone talk to you.</p>
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
    document.getElementById(`tune-${o.focus}`)?.scrollIntoView({ block: 'start' });
  }, []);
  const suggestions = [...new Set([r.sound, ...mood.tasteMusic])].filter((id) => SOUND_BY_ID[id]).slice(0, 5);
  return (
    <Sheet onClose={o.onClose}>
      <h2>Tune your {mood.name.toLowerCase()} mix</h2>
      <p class="explain">Changes apply right away{o.running ? ', while it plays' : ''}, and the app remembers them for next time.</p>

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

      <div class="sheet-section" id="tune-breathing">
        <h3><Icon name="lungs" />Breathing</h3>
        <Toggle label="Breathing guide" hint="A visual cue, and the music gently rises and falls with it" checked={r.breathing} onChange={(breathing) => set({ breathing })} />
        {r.breathing && (
          <>
            <div class="field">
              <div class="field-head"><span>Rhythm</span></div>
              <Seg value={patternKey(r)} label="Breathing rhythm" options={PATTERN_OPTS} onChange={(k) => set({ breath: k === 'sigh' ? { ...r.breath, mode: 'sigh' } : { ...r.breath, mode: 'paced', ratio: k === 'long' ? 1.6 : 1 } })} />
              <p class="explain" style="margin-top:6px">{patternKey(r) === 'sigh' ? 'Breathe in, take a small extra sip of air, then let it all out slowly.' : patternKey(r) === 'long' ? 'The breath out is longer than the breath in. Most people find this the most calming.' : 'In and out take the same time.'}</p>
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
        <h3><Icon name="wave" />Beat</h3>
        <p class="explain">A soft, steady rhythm layered under the music. Pick a feel and see what suits you.</p>
        <Toggle label="Beat" checked={r.beat.on} onChange={(on) => set({ beat: { ...r.beat, on } })} />
        {r.beat.on && (
          <>
            <div class="field">
              <div class="field-head"><span>Feel</span><span class="v">{BEAT_FEELS.find((f) => f.rate === r.beat.rate)?.hint ?? `${r.beat.rate} Hz`}</span></div>
              <Seg value={r.beat.rate} label="Beat feel" onChange={(rate) => set({ beat: { ...r.beat, rate } })} options={BEAT_FEELS.map((f) => ({ v: f.rate, label: f.name }))} />
            </div>
            <div class="field">
              <div class="field-head"><span>Strength</span></div>
              <Seg value={r.beat.strength} label="Beat strength" onChange={(strength) => set({ beat: { ...r.beat, strength } })} options={(['subtle', 'medium', 'strong'] as const).map((k) => ({ v: k, label: STRENGTH[k].label }))} />
            </div>
            <div class="field">
              <div class="field-head"><span>Listening on</span></div>
              <Seg value={r.beat.type} label="Beat type" onChange={(type) => set({ beat: { ...r.beat, type } })} options={[{ v: 'binaural', label: 'Headphones' }, { v: 'pulse', label: 'Speakers' }]} />
              <p class="explain" style="margin-top:6px">
                {r.beat.type === 'binaural'
                  ? `Headphones: each ear gets a slightly different tone and your brain hears the beat between them. Needs both earbuds in.${mono ? ' Your stereo check said mono, so choose Speakers.' : ''}`
                  : 'Speakers: the music itself gently pulses. Works anywhere, even on one earbud.'}
              </p>
            </div>
          </>
        )}
      </div>

      <div class="sheet-section" id="tune-length">
        <h3><Icon name="clock" />Length</h3>
        <div class="chips">{[...new Set([...mood.minuteOptions, r.minutes])].sort((a, b) => a - b).map((m) => <button class={`chip ${r.minutes === m ? 'on' : ''}`} onClick={() => set({ minutes: m })}>{m} min</button>)}</div>
        {o.running && <p class="explain">A new length applies next time you press play.</p>}
      </div>

      <div class="sheet-section">
        <div class="btn-row">
          <button class="btn small" onClick={() => go(`/tune/${o.moodId}`)}><Icon name="spark" /> Find my sound</button>
          <button class="btn small ghost" onClick={o.onExport}><Icon name="download" /> Save as file</button>
        </div>
        <button class="link-btn" onClick={o.onReset}>Reset {mood.name.toLowerCase()} to the starting point</button>
      </div>
      <button class="btn block cream" style="margin-top:12px" onClick={o.onClose}>Done</button>
    </Sheet>
  );
}

const CAT_ICON: Record<Category, string> = { classical: 'note', piano: 'note', chill: 'wave', ambient: 'moon', strings: 'wave', musicbox: 'spark', nature: 'drop' };

export function MusicLibrary({ current, allowNone, onPick, onClose }: { current: string; allowNone?: boolean; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <h2>Music</h2>
      <p class="explain">Pick anything. Breathing and the beat follow along, and the beat is tuned to the music's key.</p>
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
      {CATEGORIES.map((c) => (
        <div>
          <div class="lib-cat"><h3>{c.name}</h3><div class="tiny faint">{c.blurb}</div></div>
          {SOUNDS.filter((x) => x.category === c.id).map((it) => (
            <button class={`lib-item ${current === it.id ? 'on' : ''}`} onClick={() => onPick(it.id)}>
              <span class="ic"><Icon name={CAT_ICON[c.id]} /></span>
              <span><div class="tt">{it.title}</div><div class="st">{it.subtitle}</div></span>
            </button>
          ))}
        </div>
      ))}
      <p class="tiny faint">Classical pieces are played from free scores (Mutopia Project) on a real upright piano (FreePats), with human timing and pedal added. Licenses: ATTRIBUTION.md.</p>
      <button class="btn block cream" onClick={onClose}>Close</button>
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
