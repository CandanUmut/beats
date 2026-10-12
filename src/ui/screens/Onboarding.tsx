import { useEffect, useState } from 'preact/hooks';
import { ASK_FIRST, DISCLAIMER } from '../../data/safety';
import { settings, updateSettings } from '../../data/settings';
import * as engine from '../../audio/engine';
import { Icon, Steps } from '../components';
import { VolumeCard } from '../Player';

type Step = 'safety' | 'lr' | 'mono' | 'level' | 'done';
export function Onboarding({ onDone, recheck }: { onDone: () => void; recheck?: boolean }) {
  // First run is short: safety, then a comfortable volume. The headphone checks
  // run later, when a headphone beat would actually help.
  const ORDER: Step[] = recheck ? ['lr', 'mono'] : ['safety', 'level'];
  const [step, setStep] = useState<Step>(ORDER[0]);
  const at = ORDER.indexOf(step);
  const next = () => {
    const n = ORDER[at + 1];
    if (n) setStep(n);
    else finish();
  };
  const finish = () => {
    void engine.stopSession(0.5);
    updateSettings({ onboarded: true });
    onDone();
  };
  return (
    <div class="accent-relax">
      <div style="height:20px" />
      <Steps n={ORDER.length} at={at} />
      {step === 'safety' && <Safety onNext={next} />}
      {step === 'lr' && <LeftRight onNext={next} />}
      {step === 'mono' && <Mono onNext={next} />}
      {step === 'level' && <Level onNext={finish} />}
    </div>
  );
}

function Safety({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div class="eyebrow" style="margin-top:12px">Welcome to Steady</div>
      <h1>Sound and breath, tuned to how you want to feel.</h1>
      <div class="card">
        <ul class="small" style="padding-left:20px;margin:0;display:grid;gap:8px">
          <li>Steady is a free sound and breathing tool, not medical care.</li>
          <li>Keep the volume low enough to hear someone talk to you.</li>
          <li>Don't use it while driving or when you need to stay alert.</li>
          <li>If you're struggling, tap <b>Support</b> any time for someone to talk to.</li>
        </ul>
      </div>
      <details class="more"><summary>Full disclaimer and who should check with a doctor first</summary>
        <p class="tiny muted">{ASK_FIRST}</p>
        <p class="tiny muted">{DISCLAIMER}</p>
      </details>
      <p class="tiny faint">Everything stays on this device. No account, no tracking.</p>
      <button class="btn primary block" onClick={onNext}>I understand, continue</button>
    </>
  );
}

export function LeftRight({ onNext }: { onNext: () => void }) {
  const [side, setSide] = useState<'left' | 'right' | null>(null);
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [playing, setPlaying] = useState(false);
  const done = results.length >= 2;

  async function play() {
    const s = Math.random() < 0.5 ? 'left' : 'right';
    setSide(s);
    setPlaying(true);
    await engine.playTestTone(s, 1.6, settings.value.volume);
    setPlaying(false);
  }
  function answer(a: 'left' | 'right' | 'both') {
    if (!side) return;
    setResults([...results, a === side]);
    setSide(null);
    setRound(round + 1);
  }
  const allRight = results.length >= 2 && results.every(Boolean);
  const swapped = results.length >= 2 && results.every((r) => !r);

  function save() {
    updateSettings({ headphones: { ...settings.value.headphones, lr: allRight ? 'ok' : swapped ? 'swapped' : 'unsure', at: Date.now() } });
    onNext();
  }

  return (
    <>
      <h1>Headphone check</h1>
      <p class="lead">Put on headphones (wired are best). Tap play, then tap the side you heard.</p>
      {!done && (
        <div class="card center">
          <p class="muted small" style="margin-top:0">Round {round + 1} of 2</p>
          <button class="play-btn" style="margin:6px auto 14px" disabled={playing} onClick={play} aria-label="Play test tone">
            <Icon name="play" />
          </button>
          <div class="btn-row">
            <button class="btn" disabled={!side || playing} onClick={() => answer('left')}>Left</button>
            <button class="btn" disabled={!side || playing} onClick={() => answer('both')}>Both / middle</button>
            <button class="btn" disabled={!side || playing} onClick={() => answer('right')}>Right</button>
          </div>
        </div>
      )}
      {done && (
        <div class="card">
          {allRight && <p style="margin:0"><b>Left and right are correct.</b> Good to go.</p>}
          {swapped && <p style="margin:0"><b>Left and right seem swapped.</b> Check that the headphones are on the right way round.</p>}
          {!allRight && !swapped && (
            <p style="margin:0"><b>Not sure yet.</b> If you heard the tone in the middle, you may be on speakers, one earbud, or mono audio. That's fine for most of the app. It only matters for the experimental headphone mode.</p>
          )}
          <button class="btn small ghost" style="margin-top:10px" onClick={() => { setResults([]); setRound(0); }}>Try again</button>
        </div>
      )}
      <button class="btn primary block" disabled={!done} onClick={save}>Next</button>
      <button class="btn ghost block" onClick={onNext}>Skip (no headphones right now)</button>
    </>
  );
}

export function Mono({ onNext }: { onNext: () => void }) {
  const [heard, setHeard] = useState<'stereo' | 'mono' | 'unsure' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  async function play() {
    setPlaying(true);
    await engine.playTestTone('anti', 2.2, settings.value.volume);
    setPlaying(false);
    setPlayed(true);
  }
  function save() {
    updateSettings({ headphones: { ...settings.value.headphones, mono: heard ?? 'unsure', at: Date.now() } });
    onNext();
  }
  return (
    <>
      <h1>Stereo check</h1>
      <p class="lead">This tone is built so it cancels itself out if your device mixes left and right into one channel (mono).</p>
      <div class="card center">
        <button class="play-btn" style="margin:6px auto 14px" disabled={playing} onClick={play} aria-label="Play stereo test">
          <Icon name="play" />
        </button>
        <p class="small muted">What did you hear?</p>
        <div class="btn-row">
          <button class={`btn ${heard === 'stereo' ? 'primary' : ''}`} disabled={!played} onClick={() => setHeard('stereo')}>A clear tone</button>
          <button class={`btn ${heard === 'mono' ? 'primary' : ''}`} disabled={!played} onClick={() => setHeard('mono')}>Nothing / very faint</button>
        </div>
      </div>
      {heard === 'stereo' && <p class="small muted">Your audio is in stereo. The experimental headphone mode can work.</p>}
      {heard === 'mono' && (
        <div class="note warn">Your audio is in mono (one earbud, a speaker, or the "Mono audio" accessibility setting). Breathing, music and the Lab all still work. Only the experimental binaural mode needs stereo headphones.</div>
      )}
      <button class="btn primary block" disabled={!heard} onClick={save}>Next</button>
      <button class="btn ghost block" onClick={onNext}>Skip</button>
    </>
  );
}

function Level({ onNext }: { onNext: () => void }) {
  const [playing, setPlaying] = useState(false);
  const volume = settings.value.volume;
  const params = {
    musicGainDb: 0,
    noiseGainDb: -80,
    breath: { enabled: false, pattern: { id: 'x', segments: [{ phase: 'in' as const, seconds: 1, to: 1 }] }, depthDb: 0 },
    rhythm: { mode: 'off' as const, rate: 6, depth: 0, carrier: 220, levelDb: -15 },
    volume,
  };
  useEffect(() => {
    if (playing) engine.updateParams(params);
  }, [volume, playing]);
  async function toggle() {
    if (playing) {
      await engine.stopSession(0.8);
      setPlaying(false);
      return;
    }
    await engine.ensureAudio();
    const key = await engine.loadTrack('pink');
    await engine.startSession({
      music: key,
      noise: null,
      params,
      timing: { duration: 120, fadeIn: 1, fadeOut: 1 },
      title: 'Level check',
      onEnded: () => setPlaying(false),
    });
    setPlaying(true);
  }
  return (
    <>
      <h1>A comfortable level</h1>
      <p class="lead">Play the reference sound. It's as loud as the app's music will be. Set your <b>device volume</b> so it's soft but clear.</p>
      <div class="card center">
        <button class="play-btn" style="margin:6px auto 10px" onClick={toggle} aria-label={playing ? 'Stop' : 'Play reference'}>
          <Icon name={playing ? 'stop' : 'play'} />
        </button>
        <p class="small muted" style="margin:0">Soft noise, like distant rain</p>
      </div>
      <VolumeCard />
      <p class="tiny faint">Tip: your phone has a built-in loudness limiter (iPhone: Headphone Safety → Reduce Loud Audio). See Settings.</p>
      <button class="btn primary block" onClick={onNext}>Start</button>
    </>
  );
}
