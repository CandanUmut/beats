// The cat: a small ginger companion who lives along the bottom of the screen.
// He wanders, sits, grooms, yawns, stretches, eats and naps. During a session
// he curls up and sleeps. Pet him and he purrs. He never talks, only meows,
// and he walks over to whatever matters on each screen to show you around.

import { useEffect, useRef, useState } from 'preact/hooks';
import { route } from './router';
import { settings, updateSettings } from '../data/settings';
import { meow, purr } from '../audio/catSounds';

type Pose = 'sit' | 'walk' | 'sleep' | 'yawn' | 'eat' | 'groom' | 'stretch' | 'petted' | 'look';

const W = 96; // rendered cat width, px
const SPEED = 46; // px per second

const C = {
  fur: '#df9a5b',
  dark: '#b9733c',
  cream: '#f4dcb8',
  eye: '#2a1d14',
  nose: '#d98a7e',
  inner: '#e9a99a',
  bowl: '#8fa7c6',
};

interface State {
  pose: Pose;
  x: number;
  dir: 1 | -1;
  until: number;
  targetX: number | null;
  next: Pose | null;
  since: number;
}

/** Where the cat goes to "show you around" (once per screen, ever). Not on
 *  the Calm and Grounded pages: someone arriving there wants quiet, fast. */
function guideFor(r: string): { key: string; sel: string } | null {
  if (r === '/') return { key: 'home', sel: '.mood' };
  if (r === '/m/calm' || r === '/m/grounded') return null;
  if (r.startsWith('/m/')) return { key: r, sel: '.play-btn' };
  if (r.startsWith('/tune/')) return { key: 'tune', sel: '.sticky-next .btn, .btn.primary' };
  return null;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const inSession = () => document.documentElement.classList.contains('in-session');

function useReducedMotion(): boolean {
  const q = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const [v, setV] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const on = () => setV(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  return v;
}

/** Ask the cat for a pet from elsewhere (the Settings button, for keyboards). */
export function petTheCat(): void {
  window.dispatchEvent(new Event('steady:pet-cat'));
}

export function Cat() {
  const s = settings.value;
  const on = s.cat;
  const still = useReducedMotion();
  const [, force] = useState(0);
  const [ducked, setDucked] = useState(false);
  const st = useRef<State>({ pose: 'walk', x: -W, dir: 1, until: 0, targetX: 60, next: 'sit', since: 0 });
  const t = useRef(0);
  const floor = useRef<HTMLDivElement>(null);
  const hearts = useRef<{ id: number; x: number; born: number }[]>([]);
  const lastPurr = useRef(0);
  const lastMeow = useRef(0);
  const blink = useRef(0);
  const stroke = useRef({ x: 0, acc: 0, at: 0 });
  // Read through refs so a volume change doesn't restart the loop.
  const sounds = useRef(s.catSounds);
  const vol = useRef(s.volume);
  const stillRef = useRef(still);
  sounds.current = s.catSounds;
  vol.current = s.volume;
  stillRef.current = still;

  // Reduced motion: no entrance walk, he's simply sitting there.
  useEffect(() => {
    if (still) Object.assign(st.current, { pose: 'sit', x: 60, targetX: null, next: null, until: performance.now() / 1000 + 20 });
  }, [still]);

  // Behaviour loop.
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let prev = performance.now();
    let drawn = 0;
    const pick = (now: number) => {
      const c = st.current;
      const fw = floor.current?.clientWidth ?? 360;
      const r = Math.random();
      const after = (sec: number) => now / 1000 + sec;
      // Reduced motion: no wandering, just sitting and napping.
      if (stillRef.current) Object.assign(c, r < 0.6 ? { pose: 'sit', until: after(20) } : { pose: 'sleep', until: after(40) });
      else if (r < 0.28) Object.assign(c, { pose: 'sit', until: after(5 + Math.random() * 5) });
      else if (r < 0.42) Object.assign(c, { pose: 'groom', until: after(4) });
      else if (r < 0.64) Object.assign(c, { pose: 'walk', targetX: 10 + Math.random() * (fw - W - 20), next: 'sit' });
      else if (r < 0.72) Object.assign(c, { pose: 'yawn', until: after(2.6) });
      else if (r < 0.84) Object.assign(c, { pose: 'walk', targetX: bowlX(fw) + 22, next: 'eat' });
      else Object.assign(c, { pose: 'sleep', until: after(22 + Math.random() * 20) });
      c.since = now / 1000;
    };
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      t.current = now / 1000;
      const c = st.current;
      const sec = now / 1000;
      const fw = floor.current?.clientWidth ?? 360;
      const session = inSession();
      // During a session the cat naps beside you.
      if (session && c.pose !== 'sleep' && c.pose !== 'petted') Object.assign(c, { pose: 'sleep', until: sec + 3600, targetX: null, since: sec });
      if (!session && c.pose === 'sleep' && c.until > sec + 1000) Object.assign(c, { pose: 'stretch', until: sec + 2.5, since: sec });

      if (c.pose === 'walk' && c.targetX !== null) {
        const d = c.targetX - c.x;
        c.dir = d >= 0 ? 1 : -1;
        const step = SPEED * dt;
        if (Math.abs(d) <= step) {
          c.x = c.targetX;
          c.targetX = null;
          const nx = c.next ?? 'sit';
          c.pose = nx;
          c.since = sec;
          c.until = sec + 6;
          if (nx === 'eat') c.dir = -1;
          if (nx === 'look' && sounds.current && !session && sec - lastMeow.current > 6) { lastMeow.current = sec; void meow(vol.current); }
          c.next = null;
        } else c.x += Math.sign(d) * step;
      } else if (c.pose !== 'sleep' || !session) {
        if (sec > c.until) {
          if (c.pose === 'sleep') Object.assign(c, { pose: 'stretch', until: sec + 2.5, since: sec });
          else pick(now);
        }
      }
      // Walking may start off-screen (his entrance); otherwise stay on the floor.
      if (c.pose !== 'walk') c.x = clamp(c.x, 0, fw - W);
      if (Math.random() < dt / 4) blink.current = sec;
      hearts.current = hearts.current.filter((h) => sec - h.born < (stillRef.current ? 1 : 1.6));
      // Redraw at a rate that fits what he's doing: smooth when walking, slow when asleep.
      const fps = stillRef.current ? 2 : c.pose === 'walk' || hearts.current.length ? 60 : c.pose === 'sleep' ? 8 : 24;
      if (now - drawn >= 1000 / fps - 4) { drawn = now; force((n) => (n + 1) % 1e6); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  // Show you around: the first time you open a screen, walk to the main thing on it.
  useEffect(() => {
    if (!on) return;
    const r = route.value;
    const g = guideFor(r);
    if (!g || settings.value.catGuided.includes(g.key)) return;
    const id = setTimeout(() => {
      const el = document.querySelector(g.sel) as HTMLElement | null;
      const fl = floor.current;
      const html = document.documentElement;
      if (!el || !fl || inSession() || html.classList.contains('sheet-open')) return;
      const er = el.getBoundingClientRect();
      const fr = fl.getBoundingClientRect();
      const target = clamp(er.left + er.width / 2 - fr.left - W / 2, 0, fl.clientWidth - W);
      updateSettings({ catGuided: [...settings.value.catGuided, g.key] });
      const sec = performance.now() / 1000;
      if (stillRef.current) Object.assign(st.current, { pose: 'look', x: target, targetX: null, until: sec + 6, since: sec });
      else Object.assign(st.current, { pose: 'walk', targetX: target, next: 'look', since: sec });
    }, 1400);
    return () => clearTimeout(id);
  }, [route.value, on]);

  // Duck out of the way while you scroll; come back when you stop.
  useEffect(() => {
    if (!on) return;
    let tm = 0;
    const onScroll = () => {
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      setDucked(!atEnd);
      clearTimeout(tm);
      if (!atEnd) tm = window.setTimeout(() => setDucked(false), 1200);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(tm); };
  }, [on]);

  function pet(tap: boolean) {
    const c = st.current;
    const sec = performance.now() / 1000;
    if (c.pose !== 'sleep') Object.assign(c, { pose: 'petted', until: sec + 2.6, targetX: null, since: sec });
    else c.until = Math.max(c.until, sec + 8);
    // No cat sounds over a running session.
    const quiet = !sounds.current || inSession();
    if (!quiet && sec - lastPurr.current > 2.4) { lastPurr.current = sec; void purr(2.6, vol.current); }
    if (!quiet && tap && c.pose !== 'sleep' && Math.random() < 0.3 && sec - lastMeow.current > 4) { lastMeow.current = sec; void meow(vol.current); }
    if (hearts.current.length < 6) hearts.current.push({ id: Math.random(), x: c.x + W / 2 + (Math.random() - 0.5) * 30, born: sec });
  }
  const petRef = useRef(pet);
  petRef.current = pet;
  useEffect(() => {
    const h = () => petRef.current(true);
    window.addEventListener('steady:pet-cat', h);
    return () => window.removeEventListener('steady:pet-cat', h);
  }, []);

  // A stroke is ~40 px of movement across him within a moment, not a passing hover.
  function onMove(e: PointerEvent) {
    const k = stroke.current;
    const now = performance.now();
    if (now - k.at > 600) k.acc = 0;
    k.acc += Math.abs(e.clientX - k.x);
    k.x = e.clientX;
    k.at = now;
    if (k.acc >= 40) { k.acc = 0; pet(false); }
  }

  if (!on) return null;
  const c = st.current;
  const real = t.current;
  const sec = still ? 0 : real; // reduced motion: the animation clock stands still
  const fw = floor.current?.clientWidth ?? 360;
  return (
    <div class={`cat-floor${ducked ? ' ducked' : ''}`} ref={floor}>
      <Bowl x={bowlX(fw)} />
      <button
        type="button"
        class="cat"
        aria-label="Pet the cat"
        tabIndex={-1}
        style={{ transform: `translateX(${c.x}px)` }}
        onPointerDown={(e) => { stroke.current = { x: e.clientX, acc: 0, at: performance.now() }; pet(true); }}
        onPointerEnter={(e) => { stroke.current = { x: e.clientX, acc: 0, at: performance.now() }; }}
        onPointerMove={onMove as unknown as (e: Event) => void}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pet(true); } }}
      >
        <svg viewBox="0 0 120 90" width={W} height={W * 0.75} style={{ transform: `scaleX(${c.dir})` }} aria-hidden="true">
          <CatBody pose={c.pose} t={sec} since={c.since} blinking={!still && real - blink.current < 0.16} still={still} />
        </svg>
      </button>
      {hearts.current.map((h) => {
        const age = real - h.born;
        const rise = still ? 10 : Math.min(40, age * 40);
        const fade = still ? 1 : Math.max(0, 1 - age / 1.6);
        return (
          <svg class="cat-heart" viewBox="0 0 20 18" aria-hidden="true" style={{ left: `${h.x}px`, bottom: `${58 + rise}px`, opacity: String(fade) }} key={h.id}>
            <path d="M10 17s-8-5-8-10a4.2 4.2 0 0 1 8-2 4.2 4.2 0 0 1 8 2c0 5-8 10-8 10z" fill="#e9a0a0" />
          </svg>
        );
      })}
    </div>
  );
}

function bowlX(fw: number): number {
  return Math.max(6, fw * 0.06);
}

function Bowl({ x }: { x: number }) {
  return (
    <svg class="cat-bowl" viewBox="0 0 40 16" style={{ left: `${x}px` }} aria-hidden="true">
      <ellipse cx="20" cy="5" rx="15" ry="3" fill="#c98a52" />
      <path d="M4 5h32l-4 10H8z" fill={C.bowl} />
      <ellipse cx="20" cy="5" rx="16" ry="2.4" fill="none" stroke="#a9bcd6" stroke-width="1.5" />
    </svg>
  );
}

function Eyes({ closed, happy, blinking }: { closed?: boolean; happy?: boolean; blinking?: boolean }) {
  if (happy) return <g stroke={C.eye} stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M-6 -2 q2.5 -3 5 0" /><path d="M4 -2 q2.5 -3 5 0" /></g>;
  if (closed) return <g stroke={C.eye} stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M-6 -2 q2.5 2 5 0" /><path d="M4 -2 q2.5 2 5 0" /></g>;
  const ry = blinking ? 0.4 : 2.8;
  return (
    <g fill={C.eye}>
      <ellipse cx="-3.5" cy="-2" rx="2.1" ry={ry} />
      <ellipse cx="6.5" cy="-2" rx="2.1" ry={ry} />
      {!blinking && <><circle cx="-2.8" cy="-3" r="0.7" fill="#fff" /><circle cx="7.2" cy="-3" r="0.7" fill="#fff" /></>}
    </g>
  );
}

function Head({ x, y, rot = 0, eyes, mouth = 0 }: { x: number; y: number; rot?: number; eyes: preact.JSX.Element; mouth?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d="M-12 -4 L-11 -21 L-2 -12 Z" fill={C.fur} />
      <path d="M3 -12 L11 -22 L13 -4 Z" fill={C.fur} />
      <path d="M-10 -8 L-10 -17 L-5 -12 Z" fill={C.inner} />
      <path d="M5 -12 L10 -18 L11 -8 Z" fill={C.inner} />
      <ellipse cx="1" cy="0" rx="15" ry="13" fill={C.fur} />
      <path d="M-4 -12 q2 4 0 7 M1 -13 q2 4 0 7 M6 -12 q2 4 0 7" stroke={C.dark} stroke-width="1.4" fill="none" stroke-linecap="round" />
      <ellipse cx="1.5" cy="6" rx="8" ry="5.5" fill={C.cream} />
      {eyes}
      <path d="M0 3.4 h3 l-1.5 1.8z" fill={C.nose} />
      {mouth > 0.05 ? (
        <ellipse cx="1.5" cy="8" rx={2.4 * mouth + 0.5} ry={3.4 * mouth} fill="#5a2a24" />
      ) : (
        <path d="M1.5 5.4 q-1.6 2 -3 1 M1.5 5.4 q1.6 2 3 1" stroke={C.eye} stroke-width="0.9" fill="none" stroke-linecap="round" />
      )}
      <g stroke="#f7ead6" stroke-width="0.7" opacity="0.8">
        <path d="M8 5 l11 -2 M8 7 l11 1" />
        <path d="M-5 5 l-11 -2 M-5 7 l-11 1" />
      </g>
    </g>
  );
}

function SitBody({ t, tail = 1 }: { t: number; tail?: number }) {
  const sw = Math.sin(t * 1.6) * 5 * tail;
  return (
    <>
      <path d={`M36 84 C 18 86, 10 76, 14 ${66 + sw * 0.3} C 16 ${60 + sw}, 24 ${60 + sw}, 22 ${66 + sw * 0.6}`} stroke={C.fur} stroke-width="7" fill="none" stroke-linecap="round" />
      <path d="M34 85 C 28 60, 40 40, 57 40 C 72 40, 76 62, 72 85 Z" fill={C.fur} />
      <path d="M42 46 q4 4 0 9 M48 43 q4 4 0 9" stroke={C.dark} stroke-width="2" fill="none" stroke-linecap="round" />
      <ellipse cx="64" cy="62" rx="7.5" ry="13" fill={C.cream} />
      <ellipse cx="42" cy="75" rx="13" ry="11" fill={C.dark} opacity="0.35" />
    </>
  );
}

function FrontLegs({ raise = 0 }: { raise?: number }) {
  return (
    <>
      <rect x="58" y="66" width="6.5" height="19" rx="3.2" fill={C.fur} />
      <rect x="66" y={66 - raise * 22} width="6.5" height="19" rx="3.2" fill={C.fur} transform={raise ? `rotate(${-raise * 40} 69 ${70 - raise * 10})` : undefined} />
      <ellipse cx="61" cy="85" rx="4" ry="2" fill={C.cream} />
      {!raise && <ellipse cx="69" cy="85" rx="4" ry="2" fill={C.cream} />}
    </>
  );
}

function CatBody({ pose, t, since, blinking, still }: { pose: Pose; t: number; since: number; blinking: boolean; still: boolean }) {
  const age = t - since;
  switch (pose) {
    case 'walk': {
      const ph = t * 9;
      const leg = (x: number, p: number) => (
        <rect x={x} y="58" width="6" height="22" rx="3" fill={C.fur} transform={`rotate(${Math.sin(ph + p) * 24} ${x + 3} 60)`} />
      );
      const bob = Math.abs(Math.sin(ph)) * 2;
      return (
        <g transform={`translate(0 ${-bob})`}>
          {leg(38, Math.PI)}
          {leg(68, 0)}
          <path d={`M28 54 C 14 48, 14 ${30 + Math.sin(t * 3) * 3}, 22 ${24 + Math.sin(t * 3) * 3}`} stroke={C.fur} stroke-width="7" fill="none" stroke-linecap="round" />
          <ellipse cx="52" cy="56" rx="28" ry="14" fill={C.fur} />
          <path d="M40 46 q4 4 0 9 M48 44 q4 4 0 9 M56 44 q4 4 0 9" stroke={C.dark} stroke-width="2" fill="none" stroke-linecap="round" />
          <ellipse cx="58" cy="63" rx="16" ry="6" fill={C.cream} opacity="0.7" />
          {leg(32, 0)}
          {leg(62, Math.PI)}
          <Head x={86} y={36 + Math.sin(ph) * 1.2} eyes={<Eyes blinking={blinking} />} />
        </g>
      );
    }
    case 'sleep': {
      const br = 1 + Math.sin(t * 2 * Math.PI * 0.1) * 0.035;
      return (
        <>
          <g transform={`translate(56 74) scale(1 ${br}) translate(-56 -74)`}>
            <ellipse cx="56" cy="72" rx="32" ry="15" fill={C.fur} />
            <path d="M38 62 q4 4 0 8 M46 59 q4 4 0 8 M54 58 q4 4 0 8" stroke={C.dark} stroke-width="2" fill="none" stroke-linecap="round" />
          </g>
          <path d="M26 78 C 26 92, 74 92, 92 82" stroke={C.fur} stroke-width="7" fill="none" stroke-linecap="round" />
          <path d="M80 86 C 86 86, 92 84, 92 82" stroke={C.dark} stroke-width="7" fill="none" stroke-linecap="round" opacity="0.5" />
          <Head x={82} y={70} rot={12} eyes={<Eyes closed />} />
          {!still && <text x={96 + Math.sin(t) * 2} y={50 - ((t * 6) % 18)} fill="#b9ad9c" font-size="9" font-family="Fraunces, serif" opacity={0.6 - ((t * 6) % 18) / 30}>z</text>}
        </>
      );
    }
    case 'yawn': {
      const m = Math.sin(Math.min(1, age / 2.4) * Math.PI);
      return (<><SitBody t={t} /><FrontLegs /><Head x={66} y={33} rot={-22 * m} eyes={<Eyes closed />} mouth={m} /></>);
    }
    case 'eat': {
      const nod = Math.sin(t * 6) * 3;
      return (<><SitBody t={t} tail={0.4} /><FrontLegs /><Head x={74} y={50 + nod * 0.3} rot={38 + nod} eyes={<Eyes closed />} /></>);
    }
    case 'groom': {
      const lick = Math.sin(t * 7);
      return (<><SitBody t={t} tail={0.5} /><FrontLegs raise={0.9 + lick * 0.08} /><Head x={65} y={34} rot={12 + lick * 4} eyes={<Eyes closed />} /></>);
    }
    case 'stretch': {
      const k = Math.sin(Math.min(1, age / 2.5) * Math.PI);
      return (
        <g>
          <path d="M26 50 C 16 40, 18 26, 26 22" stroke={C.fur} stroke-width="7" fill="none" stroke-linecap="round" />
          <g transform={`rotate(${-12 * k} 60 70)`}>
            <ellipse cx="52" cy="60" rx="28" ry="13" fill={C.fur} />
            <rect x="74" y="72" width="26" height="6" rx="3" fill={C.fur} />
          </g>
          <rect x="34" y="60" width="6.5" height="25" rx="3.2" fill={C.fur} />
          <rect x="42" y="60" width="6.5" height="25" rx="3.2" fill={C.fur} />
          <Head x={88} y={60 + k * 6} rot={8} eyes={<Eyes closed={k > 0.4} blinking={blinking} />} mouth={k > 0.6 ? 0.4 : 0} />
        </g>
      );
    }
    case 'petted': {
      const lean = Math.sin(t * 2.4) * 4;
      return (<><SitBody t={t} tail={1.6} /><FrontLegs /><Head x={65} y={33} rot={-8 + lean} eyes={<Eyes happy />} /></>);
    }
    case 'look':
      return (<><SitBody t={t} tail={1.2} /><FrontLegs /><Head x={65} y={32} rot={-24} eyes={<Eyes blinking={blinking} />} /></>);
    default:
      return (<><SitBody t={t} /><FrontLegs /><Head x={65} y={33} rot={Math.sin(t * 0.4) * 4} eyes={<Eyes blinking={blinking} />} /></>);
  }
}
