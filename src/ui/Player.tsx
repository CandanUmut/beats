import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as engine from '../audio/engine';
import { TRACKS, type TrackId } from '../audio/dsp/synth';
import { breathAt, patternFor, BPM_MIN, BPM_MAX, type BreathPattern, type BreathPhase } from '../audio/dsp/breath';
import { DEFAULT_PARAMS, type MixParams, type SessionTiming } from '../audio/dsp/mixer';
import { settings, updateSettings } from '../data/settings';
import { recordSession } from '../data/usage';
import { db } from '../data/db';
import { Icon, Seg, Sheet, Slider, Toggle, fmtTime } from './components';

export type SoundChoice = TrackId | 'upload' | 'none';

export interface PlayerProps {
  goalId: string;
  title: string;
  sounds: TrackId[];
  defaultSound: SoundChoice;
  minutes: number;
  minuteOptions: number[];
  breathing: boolean;
  /** Sleep mode: long fade-out, no screen wake lock. */
  sleep?: boolean;
  allowNone?: boolean;
  /** Text shown under the timer, given elapsed seconds. */
  guide?: (t: number, total: number) => string | null;
  /** Extra content under the controls, given elapsed seconds and playing state. */
  children?: (t: number, playing: boolean) => ComponentChildren;
  onFinish?: (seconds: number, early: boolean) => void;
  autoStart?: boolean;
}

const PHASE_TEXT: Record<BreathPhase, string> = {
  in: 'Breathe in',
  topup: 'A little more',
  hold: 'Hold',
  out: 'Breathe out',
};

/** Breathing orb, animated straight from the session clock (no re-renders). */
export function Orb({ pattern, active, playing, label }: { pattern: BreathPattern; active: boolean; playing: boolean; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const t0 = useRef(performance.now());
  const lastPhase = useRef<BreathPhase | null>(null);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const t = playing ? engine.sessionTime() : (performance.now() - t0.current) / 1000;
      const st = breathAt(pattern, t);
      const el = ref.current;
      if (el) {
        const lvl = active ? st.level : 0.5;
        el.style.setProperty('--s', String(0.58 + 0.42 * lvl));
        el.style.setProperty('--g', String(lvl));
      }
      if (textRef.current) {
        textRef.current.textContent = active ? PHASE_TEXT[st.phase] : label ?? '';
      }
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
    <div class="orb-wrap">
      <div class="orb-ring" />
      <div class="orb" ref={ref} />
      <div class="orb-label"><div ref={textRef} /></div>
    </div>
  );
}

export type RhythmSettings = MixParams['rhythm'];

export function buildParams(o: { breathing: boolean; pattern: BreathPattern; music: boolean; rhythm?: RhythmSettings }): MixParams {
  const s = settings.value;
  return {
    ...DEFAULT_PARAMS,
    musicGainDb: o.music ? 0 : -80,
    noiseGainDb: -80,
    breath: { enabled: o.breathing, pattern: o.pattern, depthDb: s.swellDb },
    rhythm: o.rhythm ?? { ...DEFAULT_PARAMS.rhythm, mode: 'off' },
    volume: s.volume,
  };
}

/** Beat rates "used in studies" per goal (docs/RESEARCH.md, table 3.5). */
const STUDY_RATE: Record<string, number> = { relax: 6, sleep: 2, focus: 14, breathe: 6 };
const NO_RHYTHM: Record<string, string> = {
  calm: 'Not offered here: there is no evidence beats help with anger, and one small study found anger went up. You can still test it in the Lab.',
  urge: 'Not offered here: no study shows beats reduce urges. The timer and prompts are what help. You can test it in the Lab.',
};

export function timingFor(minutes: number, sleep?: boolean): SessionTiming {
  const duration = minutes * 60;
  return { duration, fadeIn: 4, fadeOut: sleep ? Math.max(60, duration - 5 * 60) : 8 };
}

export function Player(p: PlayerProps) {
  const s = settings.value;
  const [sound, setSound] = useState<SoundChoice>((s.lastSound[p.goalId] as SoundChoice) ?? p.defaultSound);
  const [upload, setUpload] = useState<engine.UploadInfo | null>(null);
  const [breathing, setBreathing] = useState(p.breathing);
  const [minutes, setMinutes] = useState(p.minutes);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjust, setAdjust] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [rhythm, setRhythm] = useState<RhythmSettings>({ ...DEFAULT_PARAMS.rhythm, mode: 'off', rate: STUDY_RATE[p.goalId] ?? 6 });
  const startedAt = useRef(0);
  const finished = useRef(false);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const pattern = useMemo(() => patternFor(s.breath), [s.breath.mode, s.breath.bpm, s.breath.ratio]);
  const total = minutes * 60;
  const status = engine.status.value;
  const playing = running && (status === 'playing' || status === 'stopping');

  // Keep the timer text fresh.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(engine.sessionTime()), 250);
    return () => clearInterval(id);
  }, [running]);

  // Push parameter changes to the live session.
  useEffect(() => {
    if (!running) return;
    engine.updateParams(buildParams({ breathing, pattern, music: sound !== 'none', rhythm }));
  }, [running, breathing, pattern, sound, s.volume, s.swellDb, rhythm]);

  // Stop the sound if the screen is left mid-session.
  useEffect(() => () => {
    if (running) void finish(true);
  }, [running]);

  useEffect(() => {
    if (p.autoStart) void start();
  }, []);

  async function keyFor(choice: SoundChoice): Promise<string | null> {
    if (choice === 'none') return null;
    if (choice === 'upload') return upload?.key ?? null;
    const first = !(await hasCached(choice));
    if (first) setBusy('Preparing sound… (first time only)');
    try {
      return await engine.loadTrack(choice);
    } finally {
      setBusy(null);
    }
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
        params: buildParams({ breathing, pattern, music: sound !== 'none', rhythm }),
        timing: timingFor(minutes, p.sleep),
        title: p.title,
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
    await recordSession(p.goalId, startedAt.current, Math.min(secs, total));
    p.onFinish?.(secs, early);
  }

  async function pickSound(choice: SoundChoice) {
    if (choice === 'upload' && !upload) {
      fileInput.current?.click();
      return;
    }
    setSound(choice);
    updateSettings({ lastSound: { ...settings.value.lastSound, [p.goalId]: choice } });
    if (running) {
      const key = await keyFor(choice);
      engine.setMusic(key);
    }
  }

  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    setBusy('Reading your file on this device…');
    try {
      const info = await engine.loadUpload(f);
      setUpload(info);
      setSound('upload');
      if (running) engine.setMusic(info.key);
    } catch (err) {
      setError(`That file could not be read here: ${String((err as Error).message ?? err)}`);
    } finally {
      setBusy(null);
    }
  }

  const remaining = Math.max(0, total - elapsed);
  const guideText = p.guide?.(elapsed, total) ?? null;

  return (
    <div>
      <div class="stage">
        <Orb pattern={pattern} active={breathing} playing={playing} label={playing ? '' : ''} />
        <div class="timer" aria-live="off">{fmtTime(running ? remaining : total)}</div>
        <div class="timer-sub">{running ? (p.sleep && elapsed > 300 ? 'fading out slowly' : 'remaining') : `${minutes} min session`}</div>
      </div>
      {guideText && <div class="guide">{guideText}</div>}

      <div class="play-row">
        {!running ? (
          <button class="play-btn" onClick={start} disabled={!!busy} aria-label="Start">
            <Icon name="play" />
          </button>
        ) : (
          <button class="play-btn" onClick={() => finish(true)} aria-label="Stop">
            <Icon name="stop" />
          </button>
        )}
      </div>
      {busy && <p class="center muted small">{busy}</p>}
      {error && <div class="note danger-note">{error}</div>}

      {p.children?.(elapsed, running)}

      <div class="card tight">
        <div class="field-head" style="margin-bottom:8px"><span>Sound</span><span class="v">{soundBlurb(sound, upload)}</span></div>
        <div class="chips">
          {p.sounds.map((id) => (
            <button class={`chip ${sound === id ? 'on' : ''}`} onClick={() => pickSound(id)}>{TRACKS.find((t) => t.id === id)!.name}</button>
          ))}
          <button class={`chip ${sound === 'upload' ? 'on' : ''}`} onClick={() => (upload ? pickSound('upload') : fileInput.current?.click())}>
            {upload ? `♪ ${shorten(upload.name)}` : '+ Your music'}
          </button>
          {p.allowNone && <button class={`chip ${sound === 'none' ? 'on' : ''}`} onClick={() => pickSound('none')}>No sound</button>}
        </div>
        <input ref={fileInput} type="file" accept="audio/*" hidden onChange={onFile} />
        {!running && (
          <div style="margin-top:10px">
            <Seg value={minutes} onChange={setMinutes} label="Length" options={p.minuteOptions.map((m) => ({ v: m, label: `${m} min` }))} />
          </div>
        )}
        <div class="hr" style="margin:12px 0 4px" />
        <Toggle label="Breathing guide" hint="Circle + a gentle swell in the sound" checked={breathing} onChange={setBreathing} />
        <div class="btn-row" style="margin-bottom:0">
          <button class="btn small ghost" onClick={() => setAdjust(true)}><Icon name="sliders" size={18} /> Adjust</button>
          <button class="btn small ghost" onClick={() => setExportOpen(true)}><Icon name="download" size={18} /> Save as file</button>
        </div>
      </div>

      <VolumeCard />

      {engine.isIOS() && (
        <p class="tiny faint">On iPhone and iPad, sound can stop when the screen locks. For long or overnight sessions, use "Save as file" and play it in a music app.</p>
      )}

      {rhythm.mode !== 'off' && (
        <div class="note warn small">
          <span class="exp-tag">Experimental</span> Rhythm layer on: {rhythm.mode === 'binaural' ? `binaural ${rhythm.rate} Hz (headphones only)` : `pulse ${rhythm.rate} Hz`}.{' '}
          {p.goalId === 'focus' ? 'Unproven for focus.' : 'Evidence is weak; most of any benefit likely comes from the music.'}
        </div>
      )}

      {adjust && <AdjustSheet onClose={() => setAdjust(false)} goalId={p.goalId} rhythm={rhythm} setRhythm={setRhythm} />}
      {exportOpen && (
        <ExportSheet
          onClose={() => setExportOpen(false)}
          maxMinutes={minutes}
          make={async (mins) => ({
            music: await keyFor(sound),
            params: buildParams({ breathing, pattern, music: sound !== 'none', rhythm }),
            timing: timingFor(mins, p.sleep),
          })}
        />
      )}
    </div>
  );
}

async function hasCached(id: TrackId): Promise<boolean> {
  try {
    const keys = await db.get('cache', `track:${id}:${engine.sampleRate()}:v3`);
    return !!keys;
  } catch {
    return false;
  }
}

function shorten(s: string): string {
  return s.length > 18 ? `${s.slice(0, 16)}…` : s;
}

function soundBlurb(sound: SoundChoice, upload: engine.UploadInfo | null): string {
  if (sound === 'none') return 'silence';
  if (sound === 'upload') return upload ? `${fmtTime(upload.seconds)} · stays on this device` : '';
  return TRACKS.find((t) => t.id === sound)?.kind === 'noise' ? 'noise' : 'generative music';
}

export function VolumeCard() {
  const s = settings.value;
  return (
    <div class="card tight">
      <Slider
        label="Volume"
        value={Math.round(s.volume * 100)}
        min={5}
        max={100}
        step={1}
        format={(v) => `${v}%`}
        onInput={(v) => updateSettings({ volume: v / 100 })}
      />
      <p class="tiny faint" style="margin:0">Keep it low: you should still be able to hear someone talk to you. Your device volume matters more than this slider.</p>
    </div>
  );
}

function AdjustSheet({ onClose, goalId, rhythm, setRhythm }: { onClose: () => void; goalId: string; rhythm: RhythmSettings; setRhythm: (r: RhythmSettings) => void }) {
  const s = settings.value;
  const b = s.breath;
  const mono = s.headphones.mono === 'mono';
  return (
    <Sheet onClose={onClose}>
      <h2 style="margin-top:4px">Breathing</h2>
      <Seg
        value={b.mode}
        label="Pattern"
        onChange={(mode) => updateSettings({ breath: { ...b, mode } })}
        options={[
          { v: 'paced', label: 'Slow breathing' },
          { v: 'sigh', label: 'Cyclic sigh' },
        ]}
      />
      {b.mode === 'paced' ? (
        <>
          <Slider label="Pace" value={b.bpm} min={BPM_MIN} max={BPM_MAX} step={0.5} format={(v) => `${v} breaths/min`} onInput={(bpm) => updateSettings({ breath: { ...b, bpm } })} />
          <Slider label="Exhale length" value={b.ratio} min={1} max={2} step={0.1} format={(v) => (v === 1 ? 'same as inhale' : `${v.toFixed(1)}× inhale`)} onInput={(ratio) => updateSettings({ breath: { ...b, ratio } })} />
          <p class="tiny faint">About 6 breaths a minute is the pace studied most. A longer exhale tends to feel calmer.</p>
        </>
      ) : (
        <p class="small muted">Breathe in fully through your nose, then take a short second sip of air on top, then let it all out slowly through your mouth. About 6–7 breaths a minute.</p>
      )}
      <Slider label="Swell depth" value={s.swellDb} min={0} max={8} step={0.5} format={(v) => (v === 0 ? 'off' : `${v} dB`)} onInput={(swellDb) => updateSettings({ swellDb })} />
      <Toggle label="Vibrate on each breath" hint="Android only. iPhones don't allow it." checked={s.vibrate} onChange={(vibrate) => updateSettings({ vibrate })} />

      <h2>Rhythm layer <span class="exp-tag">Experimental</span></h2>
      {NO_RHYTHM[goalId] ? (
        <p class="small muted">{NO_RHYTHM[goalId]}</p>
      ) : (
        <>
          <p class="small muted" style="margin-top:0">
            {goalId === 'focus' ? 'Experimental, unproven for focus. ' : ''}Beats probably don't "tune" your brain; evidence is weak. Off by default. To find out if it does anything for you, test it blinded in the Lab.
          </p>
          <Seg
            value={rhythm.mode}
            label="Rhythm mode"
            onChange={(mode) => setRhythm({ ...rhythm, mode })}
            options={[{ v: 'off', label: 'Off' }, { v: 'pulse', label: 'Pulse (speakers OK)' }, { v: 'binaural', label: 'Binaural' }]}
          />
          {rhythm.mode === 'binaural' && (
            <p class="tiny" style="color:var(--moderate)">Headphones only, in stereo.{mono ? ' Your stereo check said mono, so you will not get a beat.' : ''}</p>
          )}
          {rhythm.mode !== 'off' && (
            <>
              <Slider label={rhythm.mode === 'binaural' ? 'Beat rate (Δf)' : 'Pulse rate'} value={rhythm.rate} min={rhythm.mode === 'binaural' ? 1 : 0.5} max={20} step={0.5} format={(v) => `${v} Hz`} onInput={(rate) => setRhythm({ ...rhythm, rate })} />
              {rhythm.mode === 'pulse' && (
                <Slider label="Pulse depth" value={Math.round(rhythm.depth * 100)} min={0} max={40} step={1} format={(v) => `${v}%`} onInput={(v) => setRhythm({ ...rhythm, depth: v / 100 })} />
              )}
              {rhythm.mode === 'binaural' && (
                <>
                  <Slider label="Carrier tone" value={rhythm.carrier} min={150} max={450} step={5} format={(v) => `${v} Hz`} onInput={(carrier) => setRhythm({ ...rhythm, carrier })} />
                  <Slider label="Tone level vs music" value={rhythm.levelDb} min={-30} max={-12} step={1} format={(v) => `${v} dB`} onInput={(levelDb) => setRhythm({ ...rhythm, levelDb })} />
                </>
              )}
              <p class="tiny faint">Rates used in studies: relax 4–7 Hz (or ~10), sleep 0.25–4 Hz, focus 14–20 Hz. 40 Hz binaural is not offered: it's at the edge of what people can perceive.</p>
            </>
          )}
        </>
      )}
      <button class="btn block" onClick={onClose}>Done</button>
    </Sheet>
  );
}

function ExportSheet({ onClose, maxMinutes, make }: { onClose: () => void; maxMinutes: number; make: (mins: number) => Promise<{ music: string | null; params: MixParams; timing: SessionTiming }> }) {
  const [mins, setMins] = useState(Math.min(maxMinutes, 10));
  const [bits, setBits] = useState<16 | 24>(24);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rate = engine.sampleRate();
  const size = (mins * 60 * rate * 2 * bits) / 8;
  const opts = [5, 10, 15, 20, 25, 30, 45, 60].filter((m) => m <= Math.max(maxMinutes, 5));

  async function go() {
    setErr(null);
    setProgress(0);
    try {
      await engine.ensureAudio();
      const cfg = await make(mins);
      const blob = await engine.exportWav({ ...cfg, noise: null, params: { ...cfg.params, volume: 1 }, bits, onProgress: setProgress });
      const name = engine.neutralName();
      setResult({ url: URL.createObjectURL(blob), name, size: blob.size });
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setProgress(null);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h2 style="margin-top:4px">Save as a sound file</h2>
      <p class="small muted">Renders this session (same sound, breathing swell, fades and limiter) to a WAV file on your device. Nothing is uploaded.</p>
      <div class="field">
        <div class="field-head"><span>Length</span></div>
        <div class="chips">{opts.map((m) => <button class={`chip ${m === mins ? 'on' : ''}`} onClick={() => setMins(m)}>{m} min</button>)}</div>
      </div>
      <Seg value={bits} onChange={setBits} label="Quality" options={[{ v: 24, label: '24-bit (best)' }, { v: 16, label: '16-bit (smaller)' }]} />
      <p class="tiny faint">About {(size / 1e6).toFixed(0)} MB at {rate / 1000} kHz. WAV files are big; 16-bit is plenty for listening.</p>
      {progress !== null && (
        <div class="field">
          <div class="meter"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p class="tiny muted">Rendering… {Math.round(progress * 100)}%</p>
        </div>
      )}
      {err && <div class="note danger-note">{err}</div>}
      {result ? (
        <a class="btn primary block" href={result.url} download={result.name}>
          <Icon name="download" size={18} /> Download {result.name}
        </a>
      ) : (
        <button class="btn primary block" disabled={progress !== null} onClick={go}>Render file</button>
      )}
      <button class="btn block ghost" style="margin-top:8px" onClick={onClose}>Close</button>
    </Sheet>
  );
}
