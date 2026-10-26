// The cat: a small ginger companion who lives along the bottom of the screen.
// Mostly he loafs, blinks and watches your finger. Every couple of minutes he
// does one thing: wanders, grooms, yawns and stretches, eats, naps, or (now and
// then, on Home) chases a butterfly. During a session he kneads, curls up and
// sleeps, breathing at your pace. Pet him and he purrs; pet him a lot and he
// rolls over. He never talks, only meows, and the first time you open a
// screen he hops over to the thing to tap. He never sits on text or buttons:
// he sits along the bottom of the screen or on top of a card or picture,
// wherever nothing is behind him, squeezes a bit into a tight spot, now and
// then hops somewhere else, and when there is no room at all he peeks over
// the bottom of the screen or the top of a card instead.

import { useEffect, useRef, useState } from 'preact/hooks';
import { route } from './router';
import { settings, updateSettings } from '../data/settings';
import { meow, purr } from '../audio/catSounds';
import * as engine from '../audio/engine';
import { breathAt, type BreathPattern } from '../audio/dsp/breath';
import { allPerches, bestSpot, perchNow, spanAt, type Geometry, type Peek, type Perch, type Span } from './catRoom';

type Pose =
  | 'loaf' | 'sit' | 'look' | 'walk' | 'curl' | 'yawn' | 'stretch' | 'groom'
  | 'eat' | 'petted' | 'knead' | 'crouch' | 'pounce' | 'roll' | 'peek';

interface Step { pose: Pose; dur?: number; to?: number; dir?: 1 | -1 }

const W = 100; // rendered cat width, px
const H = W * 0.75;
const LIFT = 4; // his box sits this far above the bottom of the floor
const FLOOR_H = 80; // his layer's height
const FEET = 3; // on a card, his paws overlap its top edge this much
/** Seconds in the air hopping from one place to another, longer for a long hop. */
const hopTime = (dist: number) => clamp(0.45 + dist / 1200, 0.5, 0.85);
const SPEED = 44; // px per second
/** The sizes he may take on the floor, biggest first. */
const SIZES = [1, 0.86, 0.72];
/** Peeking over the bottom of the screen or the top of a card: the edge cuts
 *  him at this height in the drawing (just under his paws), and what shows is
 *  about this wide and tall. */
const PEEK_LEDGE = 52;
const PEEK: Peek = { w: 36, h: PEEK_LEDGE * (W / 120) - 4 };
/** How far down he sinks to peek over the floor's edge, or a card's. */
const peekDy = (card: boolean) => H - PEEK_LEDGE * (W / 120) + (card ? -FEET : LIFT);
const AWAY_DY = LIFT + H + 4;

/** Where he is: on the floor (`el` null) or on top of `el`; sitting, peeking
 *  over its edge, or out of sight. `lo`/`hi` is his free stretch along
 *  it. On a card his layer sits on the page at left/top/width, so he scrolls
 *  with the card. */
interface Place {
  el: Element | null;
  mode: 'on' | 'peek' | 'away';
  s: number;
  lo: number;
  hi: number;
  left: number;
  top: number;
  width: number;
}

const F = {
  fur: '#eba667',
  dark: '#c9793d',
  line: '#9a5527',
  cream: '#fae8cc',
  ear: '#f2b2a4',
  nose: '#e3837c',
  eye: '#2b1d14',
  blush: '#f39a8c',
  bowl: '#8fa7c6',
};

interface State {
  pose: Pose;
  x: number;
  dir: 1 | -1;
  until: number;
  targetX: number | null;
  since: number;
  queue: Step[];
  nextEvent: number;
  pets: number[];
  slowBlink: number;
}

// --- Breathing along with the session --------------------------------------

let sessionPattern: BreathPattern | null = null;
/** The player tells the cat the breathing pattern while a session runs. */
export function setCatBreath(p: BreathPattern | null): void {
  sessionPattern = p;
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
const hour = () => new Date().getHours();

function chasedToday(): boolean {
  try { return localStorage.getItem('steady-cat-chase') === new Date().toDateString(); } catch { return true; }
}
function markChased(): void {
  try { localStorage.setItem('steady-cat-chase', new Date().toDateString()); } catch { /* fine */ }
}

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

function bowlX(fw: number): number {
  return Math.max(6, fw * 0.05);
}

export function Cat() {
  const s = settings.value;
  const on = s.cat;
  const still = useReducedMotion();
  const [, force] = useState(0);
  const place = useRef<Place>({ el: null, mode: 'away', s: 1, lo: 0, hi: 0, left: 0, top: 0, width: 0 });
  const anim = useRef({ dy: AWAY_DY, s: 1, op: 0 });
  const hop = useRef<{ ox: number; oy: number; at: number; dur: number } | null>(null);
  const bowlOk = useRef(false);
  const ruler = useRef<HTMLDivElement>(null);
  const st = useRef<State>({ pose: 'loaf', x: 70, dir: -1, until: Infinity, targetX: null, since: 0, queue: [], nextEvent: performance.now() / 1000 + 8, pets: [], slowBlink: -10 });
  const t = useRef(0);
  const floor = useRef<HTMLDivElement>(null);
  const hearts = useRef<{ id: number; x: number; born: number }[]>([]);
  const fly = useRef<{ x: number; y: number; vx: number; vy: number; on: boolean } | null>(null);
  const pointer = useRef<{ x: number; y: number; at: number } | null>(null);
  const breath = useRef(0.5);
  const lastPurr = useRef(0);
  const lastMeow = useRef(0);
  const blink = useRef(0);
  const stroke = useRef({ x: 0, acc: 0, at: 0 });
  const sounds = useRef(s.catSounds);
  const vol = useRef(s.volume);
  const stillRef = useRef(still);
  sounds.current = s.catSounds;
  vol.current = s.volume;
  stillRef.current = still;

  useEffect(() => {
    if (still) Object.assign(st.current, { pose: 'loaf', targetX: null, queue: [], until: Infinity });
  }, [still]);

  // --- Where he sits ---------------------------------------------------------

  const geometry = (): Geometry | null => {
    const r = ruler.current;
    // (scroll-margin-top carries the safe area's top inset, see .cat-ruler)
    return r && { floor: r.getBoundingClientRect(), top: parseFloat(getComputedStyle(r).scrollMarginTop) || 4, h: H, w: W, lift: LIFT, feet: FEET, sizes: SIZES };
  };
  /** His feet, middle, on screen right now. */
  const whereNow = (): [number, number] => {
    const r = floor.current!.getBoundingClientRect();
    return [r.left + st.current.x + W / 2, r.bottom - LIFT + anim.current.dy];
  };
  /** Stay on `p` (it may have moved), in stretch `sp` at size `s`. */
  const seat = (p: Perch, s: number, sp: Span, mode: Place['mode'] = 'on') => {
    Object.assign(place.current, { el: p.el, mode, s, lo: sp[0], hi: sp[1], left: p.left + window.scrollX, top: p.foot + window.scrollY - FLOOR_H + LIFT, width: p.width });
    const bx = bowlX(p.width);
    bowlOk.current = !p.el && mode === 'on' && sp[0] <= bx && sp[1] >= bx + 34;
  };
  /** Go somewhere else: hop there if he's showing, else pop up there. */
  const moveTo = (p: Perch, s: number, sp: Span, cx: number, mode: Place['mode'] = 'on') => {
    const c = st.current, a = anim.current;
    const shown = place.current.mode !== 'away' && a.op > 0.5;
    const from = whereNow();
    seat(p, s, sp, mode);
    c.x = cx - W / 2;
    if (c.pose === 'walk') { c.queue = []; Object.assign(c, { pose: 'sit', targetX: null, until: performance.now() / 1000 + 3 }); }
    const to: [number, number] = [p.left + cx, p.foot];
    if (shown && mode === 'on' && !stillRef.current && Math.hypot(from[0] - to[0], from[1] - to[1]) > 6) {
      hop.current = { ox: from[0] - to[0], oy: from[1] - to[1], at: performance.now() / 1000, dur: hopTime(Math.hypot(from[0] - to[0], from[1] - to[1])) };
      c.dir = from[0] > to[0] ? -1 : 1;
      Object.assign(a, { dy: 0, s });
    } else if (!stillRef.current) {
      hop.current = null;
      Object.assign(a, { dy: p.el ? 16 : AWAY_DY, op: 0 });
    }
  };
  /** Check his place against what's on screen now. Mid-scroll he only ducks
   *  (or rides along on his card); once things are `settled` he moves on. */
  const measure = (settled: boolean) => {
    const fl = floor.current, g = geometry();
    if (!fl || !g || document.documentElement.classList.contains('sheet-open')) return;
    const pl = place.current;
    const cx = st.current.x + W / 2;
    const fits = (p: Perch | null, mode: Place['mode']) => {
      for (const z of p?.sizes ?? []) {
        const sp = spanAt(z.spans, cx, mode === 'peek' ? PEEK.w / 2 : (W * z.s) / 2);
        if (sp) { seat(p!, z.s, sp, mode); return true; }
      }
      return false;
    };
    // Still fine where he is (a sitting cat may also sit back up from a peek)?
    const here = perchNow(pl.el, fl, g);
    if (fits(here, 'on') || (pl.mode === 'peek' && fits(perchNow(pl.el, fl, g, PEEK), 'peek'))) return;
    if (!settled) {
      // Mid-scroll: on a card he rides along with it (even off screen), and
      // only steps away if something slides over him; on the floor he ducks.
      if (pl.el) { if (here) pl.mode = 'away'; return; }
      if (!fits(perchNow(null, fl, g, PEEK), 'peek')) pl.mode = 'away';
      return;
    }
    const [x, y] = whereNow();
    const spot = bestSpot(allPerches(fl, g), x, y, W);
    if (spot) { moveTo(spot.p, spot.s, spot.sp, spot.cx); return; }
    // No room to sit anywhere: peek over an edge, or stay out of sight.
    const peek = bestSpot(allPerches(fl, g, PEEK), x, y, PEEK.w);
    if (peek) moveTo(peek.p, 1, peek.sp, peek.cx, 'peek');
    else pl.mode = 'away';
  };
  /** Now and then he hops up onto something else on screen, usually nearby. */
  const explore = (): boolean => {
    const fl = floor.current, g = geometry();
    if (!fl || !g || place.current.mode !== 'on') return false;
    const [x, y] = whereNow();
    const away = (p: Perch) => Math.abs(p.foot - y) + Math.max(0, p.left - x, x - p.left - p.width);
    const all = allPerches(fl, g)
      .filter((p) => p.el !== place.current.el && p.sizes[0]?.s === 1 && p.sizes[0].spans.length)
      .sort((a, b) => away(a) - away(b));
    const near = all.filter((p) => away(p) < 360);
    const pick = near.length ? near : all.slice(0, 1);
    const p = pick[Math.floor(Math.random() * pick.length)];
    if (!p) return false;
    const sp = p.sizes[0].spans[Math.floor(Math.random() * p.sizes[0].spans.length)];
    moveTo(p, 1, sp, sp[0] + W / 2 + Math.random() * (sp[1] - sp[0] - W));
    return true;
  };

  // Eyes follow your finger or cursor.
  useEffect(() => {
    if (!on) return;
    const mv = (e: PointerEvent) => { pointer.current = { x: e.clientX, y: e.clientY, at: performance.now() }; };
    window.addEventListener('pointermove', mv, { passive: true });
    window.addEventListener('pointerdown', mv, { passive: true });
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerdown', mv); };
  }, [on]);

  // Behaviour loop.
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let prev = performance.now();
    let drawn = 0;
    let wasSession = false;

    const begin = (c: State, step: Step, sec: number) => {
      if (step.to !== undefined) {
        Object.assign(c, { pose: 'walk', targetX: step.to, since: sec, until: Infinity });
      } else {
        Object.assign(c, { pose: step.pose, since: sec, until: step.dur === undefined ? Infinity : sec + step.dur, targetX: null });
        if (step.dir) c.dir = step.dir;
      }
    };
    const advance = (c: State, sec: number) => {
      const next = c.queue.shift();
      if (next) begin(c, next, sec);
      else {
        Object.assign(c, { pose: 'loaf', until: Infinity, targetX: null, since: sec });
        // One small event every minute or two; otherwise he loafs.
        c.nextEvent = sec + 70 + Math.random() * 60;
      }
    };
    const pickEvent = (c: State, sec: number) => {
      const fw = floor.current?.clientWidth ?? 360;
      const r = Math.random();
      const night = hour() >= 22 || hour() < 6;
      const home = route.value === '/';
      const pl = place.current;
      const half = (W * pl.s) / 2;
      const spot = pl.lo + half + Math.random() * Math.max(0, pl.hi - pl.lo - 2 * half) - W / 2;
      const bx = bowlX(fw);
      const canEat = bowlOk.current && pl.lo <= bx && pl.hi >= bx + 26 + W;
      let q: Step[];
      if (night && r < 0.7) q = [{ pose: 'knead', dur: 2.5 }, { pose: 'curl', dur: 60 + Math.random() * 60 }, { pose: 'stretch', dur: 2.5 }];
      else if (home && !chasedToday() && r < 0.18) {
        markChased();
        const dir: 1 | -1 = c.x < fw / 2 ? 1 : -1;
        fly.current = { x: c.x + W / 2 + dir * 160, y: 30, vx: 0, vy: 0, on: true };
        q = [{ pose: 'look', dur: 1.6, dir }, { pose: 'crouch', dur: 1.8, dir }, { pose: 'pounce', dur: 0.7, dir }, { pose: 'look', dur: 2.2, dir }];
      }
      else if (r < 0.3 && explore()) q = [{ pose: 'sit', dur: 5 }];
      else if (r < 0.4) q = [{ pose: 'walk', to: spot }, { pose: 'sit', dur: 5 }];
      else if (r < 0.5) q = [{ pose: 'groom', dur: 4.5 }];
      else if (r < 0.65) q = [{ pose: 'yawn', dur: 2.4 }, { pose: 'stretch', dur: 2.6 }];
      else if (r < 0.82) q = canEat ? [{ pose: 'walk', to: bx + 26 }, { pose: 'eat', dur: 6, dir: -1 }] : [{ pose: 'groom', dur: 4.5 }];
      else q = [{ pose: 'knead', dur: 2.5 }, { pose: 'curl', dur: 30 + Math.random() * 40 }, { pose: 'stretch', dur: 2.5 }];
      c.queue = q;
      advance(c, sec);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      t.current = now / 1000;
      const c = st.current;
      const sec = now / 1000;
      const fw = floor.current?.clientWidth ?? 360;
      const session = inSession();
      // Into a session: knead, then curl up and breathe along. Out: stretch, slow blink.
      // (He walks to the left end of whatever free stretch he is in.)
      if (session && !wasSession) { c.queue = [{ pose: 'knead', dur: 2.6 }, { pose: 'curl' }]; begin(c, { pose: 'walk', to: -W }, sec); fly.current = null; }
      if (!session && wasSession) { c.queue = [{ pose: 'sit', dur: 4 }]; begin(c, { pose: 'stretch', dur: 2.6 }, sec); c.slowBlink = sec + 2.8; }
      wasSession = session;
      breath.current = session && sessionPattern ? breathAt(sessionPattern, engine.sessionTime()).level : 0.5;

      // Keep to his free stretch.
      const p = place.current;
      const a = anim.current;
      const seated = p.mode === 'on';
      if (hop.current && sec - hop.current.at > hop.current.dur) hop.current = null;
      if (seated) {
        const half = (W * p.s) / 2;
        const lo = p.lo + half - W / 2, hi = p.hi - half - W / 2;
        c.x = clamp(c.x, lo, Math.max(lo, hi));
        if (c.targetX !== null) c.targetX = clamp(c.targetX, lo, Math.max(lo, hi));
      }
      const goal = { dy: seated ? 0 : p.mode === 'peek' ? peekDy(!!p.el) : AWAY_DY, s: seated ? p.s : 1, op: p.mode === 'away' ? 0 : 1 };
      const k = stillRef.current ? 1 : Math.min(1, dt * 9);
      a.dy += (goal.dy - a.dy) * k;
      a.s += (goal.s - a.s) * k;
      a.op += (goal.op - a.op) * Math.min(1, k * 1.4);
      const settling = Math.abs(goal.dy - a.dy) > 0.3 || Math.abs(goal.s - a.s) > 0.004 || Math.abs(goal.op - a.op) > 0.01;
      if (!settling) Object.assign(a, goal);

      if (!seated || hop.current) {
        // Peeking, away or mid-hop: he waits where he is, and nothing new starts.
        if (sec > c.until && c.pose !== 'walk') advance(c, sec);
      } else if (c.pose === 'walk' && c.targetX !== null) {
        const d = c.targetX - c.x;
        c.dir = d >= 0 ? 1 : -1;
        const step = SPEED * dt;
        if (Math.abs(d) <= step) {
          c.x = c.targetX;
          c.targetX = null;
          advance(c, sec);
          if ((c.pose as Pose) === 'look' && c.queue.length === 0 && sounds.current && !session && sec - lastMeow.current > 6) { lastMeow.current = sec; void meow(vol.current); }
        } else c.x += Math.sign(d) * step;
      } else if (c.pose === 'pounce') {
        const f = fly.current;
        if (f) c.x += (f.x - W / 2 - c.x) * Math.min(1, dt * 3);
        if (sec > c.until) advance(c, sec);
      } else if (sec > c.until) advance(c, sec);
      else if (c.pose === 'loaf' && !session && !stillRef.current && sec > c.nextEvent && !document.documentElement.classList.contains('sheet-open')) pickEvent(c, sec);

      // The butterfly: hovers, then darts away when he pounces.
      const f = fly.current;
      if (f?.on) {
        if (c.pose === 'pounce' || (c.pose === 'look' && sec - c.since > 0.3 && c.queue.length === 0)) { f.vy += 40 * dt; f.vx += c.dir * 25 * dt; }
        f.x += f.vx * dt + Math.sin(sec * 3) * 0.6;
        f.y += f.vy * dt + Math.cos(sec * 4) * 0.4;
        if (f.y > 260 || f.x < -40 || f.x > fw + 40) fly.current = null;
      }

      if (!seated) fly.current = null;
      if (Math.random() < dt / 4) blink.current = sec;
      hearts.current = hearts.current.filter((h) => sec - h.born < (stillRef.current ? 1 : 1.6));
      const busy = hop.current || (seated && (c.pose === 'walk' || c.pose === 'pounce' || c.pose === 'crouch')) || hearts.current.length || fly.current || settling;
      const fps = stillRef.current ? 2 : busy ? 60 : c.pose === 'curl' ? 12 : 24;
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
      const fl = floor.current, geo = geometry();
      if (!el || !fl || !geo || inSession() || document.documentElement.classList.contains('sheet-open')) return;
      const er = el.getBoundingClientRect();
      const spot = bestSpot(allPerches(fl, geo), er.left + er.width / 2, er.top + er.height / 2, W);
      if (!spot) return;
      updateSettings({ catGuided: [...settings.value.catGuided, g.key] });
      moveTo(spot.p, spot.s, spot.sp, spot.cx);
      const c = st.current;
      const sec = performance.now() / 1000;
      c.queue = [];
      Object.assign(c, { pose: 'look', targetX: null, until: sec + 6, since: sec });
    }, 1400);
    return () => clearTimeout(id);
  }, [route.value, on]);

  // Never over text or buttons: re-check his place whenever the page scrolls,
  // resizes or changes. Mid-scroll he only ducks; he moves once you stop.
  useEffect(() => {
    if (!on) return;
    let raf = 0, tm = 0, mt = 0, scrolled = -1e9;
    const run = () => { raf = 0; measure(performance.now() - scrolled > 280); };
    const soon = () => { if (!raf) raf = requestAnimationFrame(run); };
    const onScroll = () => { scrolled = performance.now(); soon(); clearTimeout(tm); tm = window.setTimeout(soon, 320); };
    // His own redraws don't count.
    const mo = new MutationObserver((recs) => {
      if (!mt && recs.some((r) => !floor.current?.contains(r.target))) mt = window.setTimeout(() => { mt = 0; soon(); }, 120);
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    const ro = new ResizeObserver(soon);
    ro.observe(document.body);
    const iv = setInterval(soon, 1500);
    soon();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', soon);
    return () => {
      window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', soon);
      mo.disconnect(); ro.disconnect(); clearInterval(iv); clearTimeout(tm); clearTimeout(mt); cancelAnimationFrame(raf);
    };
  }, [on, route.value]);

  function pet(tap: boolean) {
    const c = st.current;
    const sec = performance.now() / 1000;
    const session = inSession();
    c.pets = [...c.pets.filter((p) => sec - p < 10), sec];
    if (c.pose === 'curl') c.until = Math.max(c.until, sec + 8);
    else if (!stillRef.current && c.pets.length >= 6 && c.pose !== 'roll') {
      // Lots of love: he rolls over for a belly rub.
      c.pets = [];
      c.queue = [{ pose: 'sit', dur: 2 }];
      Object.assign(c, { pose: 'roll', until: sec + 3.5, targetX: null, since: sec });
    } else if (c.pose !== 'roll') {
      c.queue = [];
      Object.assign(c, { pose: 'petted', until: sec + 2.8, targetX: null, since: sec });
      c.slowBlink = sec + 1.2;
    }
    // No cat sounds over a running session.
    const quiet = !sounds.current || session;
    if (!quiet) { lastPurr.current = sec; void purr(3, vol.current); }
    if (!quiet && tap && c.pose !== 'curl' && Math.random() < 0.3 && sec - lastMeow.current > 4) { lastMeow.current = sec; void meow(vol.current); }
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

  // Where his eyes look: toward a nearby finger or cursor, or up at a butterfly.
  let look: [number, number] = [0, 0];
  const fr = floor.current?.getBoundingClientRect();
  const headX = (fr?.left ?? 0) + c.x + (c.dir === 1 ? 0.66 : 0.34) * W;
  const headY = (fr?.top ?? 0) + 30;
  const pt = pointer.current;
  if (fly.current && fr) look = [clamp((fr.left + fly.current.x - headX) / 60, -1, 1) * c.dir, -1];
  else if (c.pose === 'look') look = [0.3, -1];
  else if (pt && performance.now() - pt.at < 4000 && Math.hypot(pt.x - headX, pt.y - headY) < 220) {
    look = [clamp((pt.x - headX) / 80, -1, 1) * c.dir, clamp((pt.y - headY) / 80, -1, 1)];
  }
  const pl = place.current;
  const a = anim.current;
  // Mid-hop: an arc from where he was to where he's going.
  let ox = 0, oy = 0, pose: Pose = pl.mode === 'peek' ? 'peek' : c.pose, age = real - c.since;
  const hp = hop.current;
  if (hp) {
    const e = clamp((real - hp.at) / hp.dur, 0, 1);
    const ease = e < 0.5 ? 2 * e * e : 1 - 2 * (1 - e) * (1 - e);
    ox = hp.ox * (1 - ease);
    oy = hp.oy * (1 - ease) - (30 + Math.min(60, Math.abs(hp.ox) * 0.2)) * 4 * e * (1 - e);
    pose = 'pounce';
    age = e * 0.7;
  }
  const blinking = !still && real - blink.current < 0.16;
  const sb = real - c.slowBlink;
  const slow = sb > 0 && sb < 1.4 ? Math.sin((sb / 1.4) * Math.PI) : 0;

  return (
    <>
      <div class="cat-ruler" ref={ruler} aria-hidden="true" />
      <div class={`cat-floor${pl.el ? ' perched' : ''}${pl.mode === 'peek' ? ' peeking' : ''}`} ref={floor} style={pl.el ? { left: `${pl.left}px`, top: `${pl.top}px`, width: `${pl.width}px` } : undefined}>
        {bowlOk.current && pl.mode === 'on' && <Bowl x={bowlX(fw)} />}
        <button
          type="button"
          class={`cat${a.op < 0.3 ? ' gone' : ''}${hp ? ' hopping' : ''}`}
          aria-label="Pet the cat"
          tabIndex={-1}
          style={{ transform: `translate(${c.x + ox}px, ${a.dy + oy}px) scale(${a.s})`, opacity: String(a.op) }}
          onPointerDown={(e) => { stroke.current = { x: e.clientX, acc: 0, at: performance.now() }; pet(true); }}
          onPointerEnter={(e) => { stroke.current = { x: e.clientX, acc: 0, at: performance.now() }; }}
          onPointerMove={onMove as unknown as (e: Event) => void}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pet(true); } }}
        >
          <svg viewBox="0 0 120 90" width={W} height={W * 0.75} style={{ transform: `scaleX(${c.dir})` }} aria-hidden="true">
            <CatBody pose={pose} t={sec} age={age} blink={blinking ? 1 : slow} look={look} breath={breath.current} still={still} />
          </svg>
        </button>
        {fly.current && !still && <Butterfly x={fly.current.x} y={fly.current.y} t={real} />}
        {hearts.current.map((h) => {
          const age = real - h.born;
          const rise = still ? 10 : Math.min(40, age * 40);
          const fade = still ? 1 : Math.max(0, 1 - age / 1.6);
          return (
            <svg class="cat-heart" viewBox="0 0 20 18" aria-hidden="true" style={{ left: `${h.x}px`, bottom: `${62 + rise}px`, opacity: String(fade) }} key={h.id}>
              <path d="M10 17s-8-5-8-10a4.2 4.2 0 0 1 8-2 4.2 4.2 0 0 1 8 2c0 5-8 10-8 10z" fill="#ec9c9c" />
            </svg>
          );
        })}
      </div>
    </>
  );
}

// --- Drawing ----------------------------------------------------------------

function Bowl({ x }: { x: number }) {
  return (
    <svg class="cat-bowl" viewBox="0 0 40 16" style={{ left: `${x}px` }} aria-hidden="true">
      <ellipse cx="20" cy="5" rx="14" ry="3" fill="#b77a45" />
      <circle cx="15" cy="4" r="2" fill="#9a6232" /><circle cx="21" cy="3.5" r="2" fill="#a86c3a" /><circle cx="26" cy="4.5" r="1.8" fill="#9a6232" />
      <path d="M4 5h32l-4 10H8z" fill={F.bowl} />
      <path d="M8 8h24" stroke="#c9d6e6" stroke-width="1.2" />
      <ellipse cx="20" cy="5" rx="16" ry="2.4" fill="none" stroke="#a9bcd6" stroke-width="1.5" />
    </svg>
  );
}

function Butterfly({ x, y, t }: { x: number; y: number; t: number }) {
  const f = Math.abs(Math.sin(t * 12));
  return (
    <svg class="cat-fly" viewBox="-10 -8 20 16" style={{ left: `${x - 10}px`, bottom: `${y}px` }} aria-hidden="true">
      <ellipse cx={-4 * f - 0.5} cy="-1" rx={4 * f + 0.6} ry="4" fill="#f2cc8f" stroke="#c98a4a" stroke-width="0.6" />
      <ellipse cx={4 * f + 0.5} cy="-1" rx={4 * f + 0.6} ry="4" fill="#f2cc8f" stroke="#c98a4a" stroke-width="0.6" />
      <ellipse cx={-3 * f} cy="3" rx={2.6 * f + 0.4} ry="2.4" fill="#e9a07a" />
      <ellipse cx={3 * f} cy="3" rx={2.6 * f + 0.4} ry="2.4" fill="#e9a07a" />
      <rect x="-0.7" y="-4" width="1.4" height="8" rx="0.7" fill="#5a3d2b" />
    </svg>
  );
}

type EyeMode = 'open' | 'half' | 'closed' | 'happy' | 'wide';

function Eye({ x, mode, look, blink }: { x: number; mode: EyeMode; look: [number, number]; blink: number }) {
  if (mode === 'closed') return <path d={`M${x - 3.2} -0.5 q 3.2 2.6 6.4 0`} stroke={F.eye} stroke-width="1.5" fill="none" stroke-linecap="round" />;
  if (mode === 'happy') return <path d={`M${x - 3.2} 0.8 q 3.2 -3.6 6.4 0`} stroke={F.eye} stroke-width="1.5" fill="none" stroke-linecap="round" />;
  const big = mode === 'wide' ? 1.15 : 1;
  const open = mode === 'half' ? 0.45 : 1;
  const ry = 3.7 * big * open * (1 - 0.9 * blink);
  if (ry < 0.7) return <path d={`M${x - 3.2} -0.5 q 3.2 1.4 6.4 0`} stroke={F.eye} stroke-width="1.4" fill="none" stroke-linecap="round" />;
  const lx = look[0] * 1.1, ly = look[1] * 0.9 * open;
  return (
    <g>
      <ellipse cx={x + lx * 0.4} cy={-0.5 + (1 - open) * 1.5 + ly * 0.3} rx={3.2 * big} ry={ry} fill={F.eye} />
      <circle cx={x + lx + 1} cy={-1.9 + ly + (1 - open) * 1.6} r={1.25 * big * Math.min(1, ry / 2)} fill="#fff" />
      <circle cx={x + lx - 1} cy={0.9 + ly} r={0.55 * Math.min(1, ry / 2)} fill="#fff" opacity="0.8" />
    </g>
  );
}

/** A big, front-facing head: ears, stripes, a little "w" muzzle, blush. */
function Face({ x, y, rot = 0, eyes, look = [0, 0], blink = 0, mouth = 'smile', open = 0, earTwitch = 0 }: {
  x: number; y: number; rot?: number; eyes: EyeMode; look?: [number, number]; blink?: number;
  mouth?: 'smile' | 'open' | 'lick' | 'none'; open?: number; earTwitch?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <g transform={`rotate(${-earTwitch * 12} -11 -10)`}>
        <path d="M-15.5 -3 Q -18 -20 -12.5 -24 Q -6 -18 -3 -12.5 Z" fill={F.fur} stroke={F.line} stroke-width="1.1" stroke-linejoin="round" />
        <path d="M-13 -7.5 Q -14.5 -17 -11.8 -19.6 Q -8 -16 -6.2 -12.5 Z" fill={F.ear} />
      </g>
      <path d="M15.5 -3 Q 18 -20 12.5 -24 Q 6 -18 3 -12.5 Z" fill={F.fur} stroke={F.line} stroke-width="1.1" stroke-linejoin="round" />
      <path d="M13 -7.5 Q 14.5 -17 11.8 -19.6 Q 8 -16 6.2 -12.5 Z" fill={F.ear} />
      <ellipse cx="0" cy="0" rx="17.5" ry="14.8" fill={F.fur} stroke={F.line} stroke-width="1.2" />
      <path d="M-4.5 -14 q 1 3.2 0 5.6 M0 -14.6 q 1.1 3.8 0 6.6 M4.5 -14 q 1 3.2 0 5.6" stroke={F.dark} stroke-width="1.7" fill="none" stroke-linecap="round" />
      <path d="M-17 1 l -3.5 1.5 l 3.2 1.2 M17 1 l 3.5 1.5 l -3.2 1.2" stroke={F.line} stroke-width="1" fill={F.fur} stroke-linejoin="round" />
      <ellipse cx="-3.3" cy="6.6" rx="4.8" ry="3.8" fill={F.cream} />
      <ellipse cx="3.3" cy="6.6" rx="4.8" ry="3.8" fill={F.cream} />
      <ellipse cx="-10.5" cy="5" rx="3.2" ry="1.9" fill={F.blush} opacity="0.45" />
      <ellipse cx="10.5" cy="5" rx="3.2" ry="1.9" fill={F.blush} opacity="0.45" />
      <Eye x={-6.6} mode={eyes} look={look} blink={blink} />
      <Eye x={6.6} mode={eyes} look={look} blink={blink} />
      <path d="M-1.8 3.4 h 3.6 q 0 1.4 -1.8 2.2 q -1.8 -0.8 -1.8 -2.2 z" fill={F.nose} />
      {mouth === 'open' && open > 0.05 ? (
        <g><ellipse cx="0" cy={7.4 + 2 * open} rx={2 + 1.4 * open} ry={1 + 3.2 * open} fill="#7a2f2a" /><ellipse cx="0" cy={8.6 + 3 * open} rx={1.6 * open + 0.4} ry={1.2 * open} fill="#ee8f8f" /></g>
      ) : mouth === 'lick' ? (
        <ellipse cx="0" cy="8.4" rx="1.4" ry="1.8" fill="#ee8f8f" />
      ) : mouth === 'smile' ? (
        <path d="M0 5.4 q -1.4 2 -3 0.8 M0 5.4 q 1.4 2 3 0.8" stroke={F.line} stroke-width="0.9" fill="none" stroke-linecap="round" />
      ) : null}
      <g stroke="#fff8ec" stroke-width="0.7" opacity="0.85" stroke-linecap="round">
        <path d="M8.5 5.2 l 11 -1.8 M8.5 7.2 l 11 1.2" />
        <path d="M-8.5 5.2 l -11 -1.8 M-8.5 7.2 l -11 1.2" />
      </g>
    </g>
  );
}

/** A thick, outlined stroke (tail, legs). */
function Limb({ d, w = 7, color = F.fur }: { d: string; w?: number; color?: string }) {
  return (
    <>
      <path d={d} stroke={F.line} stroke-width={w + 2.2} fill="none" stroke-linecap="round" />
      <path d={d} stroke={color} stroke-width={w} fill="none" stroke-linecap="round" />
    </>
  );
}

function Paw({ x, y, up = 0 }: { x: number; y: number; up?: number }) {
  return <ellipse cx={x} cy={y - up} rx="4.6" ry="2.5" fill={F.cream} stroke={F.line} stroke-width="1" />;
}

function LoafBody({ t, tail = 1 }: { t: number; tail?: number }) {
  const tw = Math.sin(t * 1.3) * 2 * tail;
  return (
    <>
      <path d="M32 84 C 24 84 22 66 36 58 C 48 50 72 51 82 60 C 90 67 90 84 81 85 Z" fill={F.fur} stroke={F.line} stroke-width="1.2" />
      <path d="M42 56 q 3.5 4 0 8.5 M50 54 q 3.5 4 0 8.5 M58 54 q 3.5 4 0 8.5" stroke={F.dark} stroke-width="2.3" fill="none" stroke-linecap="round" />
      <ellipse cx="34" cy="74" rx="8" ry="7" fill={F.dark} opacity="0.25" />
      <ellipse cx="79" cy="73" rx="8" ry="9" fill={F.cream} />
      <Limb d={`M34 82 C 26 ${88 + tw * 0.2} 44 ${90} ${66 + tw} 87`} w={6.5} />
    </>
  );
}

function SitBody({ t, tail = 1 }: { t: number; tail?: number }) {
  const sw = Math.sin(t * 1.6) * 4 * tail;
  return (
    <>
      <Limb d={`M42 84 C 20 88 12 ${74 + sw * 0.3} 20 ${64 + sw}`} w={7} />
      <path d="M38 85 C 30 70 40 44 60 42 C 78 42 83 66 79 85 Z" fill={F.fur} stroke={F.line} stroke-width="1.2" />
      <ellipse cx="45" cy="74" rx="12" ry="11" fill={F.fur} stroke={F.line} stroke-width="1.1" />
      <path d="M40 67 q 4.5 3 3 8.5 M48 50 q 4 3 2 8" stroke={F.dark} stroke-width="2.2" fill="none" stroke-linecap="round" />
      <ellipse cx="69" cy="62" rx="8" ry="13" fill={F.cream} />
    </>
  );
}

function FrontLegs({ raise = 0 }: { raise?: number }) {
  return (
    <>
      <rect x="61" y="64" width="7" height="21" rx="3.4" fill={F.fur} stroke={F.line} stroke-width="1.1" />
      <Paw x={64.5} y={85} />
      <g transform={raise ? `rotate(${-raise * 55} 74 66)` : undefined}>
        <rect x="70" y="64" width="7" height="21" rx="3.4" fill={F.fur} stroke={F.line} stroke-width="1.1" />
        <Paw x={73.5} y={85} />
      </g>
    </>
  );
}

export function CatBody({ pose, t, age, blink, look, breath, still }: {
  pose: Pose; t: number; age: number; blink: number; look: [number, number]; breath: number; still: boolean;
}) {
  const twitch = Math.max(0, Math.sin(t * 0.7) - 0.97) * 30;
  switch (pose) {
    case 'walk': {
      const ph = t * 8;
      const leg = (x: number, p: number, far: boolean) => {
        const a = Math.sin(ph + p) * 20;
        const lift = Math.max(0, Math.cos(ph + p)) * 2;
        return (
          <g transform={`rotate(${a} ${x + 3.2} 60)`} opacity={far ? 0.85 : 1}>
            <rect x={x} y="58" width="6.6" height={24 - lift} rx="3.3" fill={far ? F.dark : F.fur} stroke={F.line} stroke-width="1" />
            <ellipse cx={x + 3.3} cy={82 - lift} rx="4" ry="2.2" fill={F.cream} stroke={F.line} stroke-width="0.9" />
          </g>
        );
      };
      const bob = Math.abs(Math.sin(ph)) * 1.6;
      const sw = Math.sin(t * 2.5) * 2;
      return (
        <g transform={`translate(0 ${-bob})`}>
          {leg(31, 0, true)}
          {leg(66, Math.PI, true)}
          <Limb d={`M30 52 C 18 46 16 ${30 + sw} 24 ${24 + sw} C 28 ${20 + sw} 33 ${23 + sw} 31 ${28 + sw}`} w={7} />
          <ellipse cx="52" cy="57" rx="28" ry="14" fill={F.fur} stroke={F.line} stroke-width="1.2" />
          <path d="M40 45 q 4 4 0 9 M48 43.5 q 4 4 0 9 M56 43.5 q 4 4 0 9" stroke={F.dark} stroke-width="2.2" fill="none" stroke-linecap="round" />
          <ellipse cx="60" cy="64" rx="15" ry="5" fill={F.cream} opacity="0.8" />
          {leg(36, Math.PI, false)}
          {leg(71, 0, false)}
          <Face x={86} y={38 + Math.sin(ph) * 1.2} eyes="open" look={[1, 0]} blink={blink} />
        </g>
      );
    }
    case 'curl': {
      // Breathes with you: rises a little as you breathe in.
      const br = 1 + (breath - 0.5) * 0.09 + (still ? 0 : Math.sin(t * 2 * Math.PI * 0.08) * 0.01);
      return (
        <>
          <g transform={`translate(58 86) scale(1 ${br}) translate(-58 -86)`}>
            <ellipse cx="58" cy="73" rx="32" ry="14.5" fill={F.fur} stroke={F.line} stroke-width="1.2" />
            <path d="M38 63 q 4 4 0 8 M46 60.5 q 4 4 0 8 M54 59.5 q 4 4 0 8" stroke={F.dark} stroke-width="2.2" fill="none" stroke-linecap="round" />
          </g>
          <Face x={82} y={70} rot={14} eyes="closed" mouth="none" />
          <Limb d="M28 80 C 28 93 76 93 96 82" w={7} />
          {!still && <text x={100 + Math.sin(t) * 2} y={52 - ((t * 5) % 16)} fill="#c9bba6" font-size="9" font-family="Fraunces, serif" opacity={0.7 - ((t * 5) % 16) / 24}>z</text>}
        </>
      );
    }
    case 'knead': {
      const a = Math.max(0, Math.sin(t * 6)), b = Math.max(0, -Math.sin(t * 6));
      return (<><LoafBody t={t} /><Paw x={74} y={85} up={a * 3} /><Paw x={84} y={85} up={b * 3} /><Face x={80} y={46} eyes="half" look={[0, 0]} blink={blink} /></>);
    }
    case 'yawn': {
      const m = Math.sin(Math.min(1, age / 2.2) * Math.PI);
      return (<><SitBody t={t} /><FrontLegs /><Face x={66} y={32} rot={-18 * m} eyes="closed" mouth="open" open={m} /></>);
    }
    case 'eat': {
      const nod = still ? 0 : Math.sin(t * 6) * 2.5;
      return (<><LoafBody t={t} tail={0.4} /><Paw x={74} y={85} /><Paw x={84} y={85} /><Face x={90} y={64 + nod * 0.3} rot={30 + nod} eyes="closed" mouth="lick" /></>);
    }
    case 'groom': {
      const lick = still ? 0 : Math.sin(t * 7);
      return (
        <>
          <SitBody t={t} tail={0.5} />
          <rect x="61" y="64" width="7" height="21" rx="3.4" fill={F.fur} stroke={F.line} stroke-width="1.1" />
          <Paw x={64.5} y={85} />
          <Face x={63} y={35} rot={16 + lick * 3} eyes="closed" mouth="lick" />
          <Limb d={`M72 66 C 76 58 ${74 + lick} 50 ${70 + lick} 46`} w={6.6} />
          <ellipse cx={69.5 + lick} cy={44.5} rx="4.2" ry="3.4" fill={F.cream} stroke={F.line} stroke-width="1" />
        </>
      );
    }
    case 'stretch': {
      const k = Math.sin(Math.min(1, age / 2.5) * Math.PI);
      return (
        <g>
          <Limb d={`M30 ${46 - k * 4} C 20 36 22 22 30 18`} w={7} />
          <path d={`M26 ${58 - k * 6} C 30 ${42 - k * 6} 56 ${48 - k * 2} 78 ${66 + k * 4} L 76 80 C 60 74 36 76 30 74 Z`} fill={F.fur} stroke={F.line} stroke-width="1.2" />
          <path d="M40 50 q 4 4 0 9 M48 50 q 4 4 0 9" stroke={F.dark} stroke-width="2.2" fill="none" stroke-linecap="round" />
          <rect x="30" y="66" width="7" height="20" rx="3.4" fill={F.fur} stroke={F.line} stroke-width="1.1" />
          <rect x="39" y="66" width="7" height="20" rx="3.4" fill={F.fur} stroke={F.line} stroke-width="1.1" />
          <Limb d={`M74 80 L ${96 + k * 6} 84`} w={6.5} />
          <Paw x={98 + k * 6} y={86} />
          <Paw x={88} y={86} />
          <Face x={88} y={62 + k * 6} rot={8} eyes={k > 0.4 ? 'closed' : 'half'} mouth="smile" blink={blink} />
        </g>
      );
    }
    case 'petted': {
      const lean = still ? 0 : Math.sin(t * 2.4) * 5;
      const quiver = still ? 0 : Math.sin(t * 30) * 0.6;
      return (<><SitBody t={t} tail={0.3 + quiver} /><FrontLegs /><Face x={65} y={33} rot={-10 + lean} eyes="happy" /></>);
    }
    case 'peek': {
      // Just ears, eyes and paws over the bottom of the screen or a card's top.
      const sleepy = breath !== 0.5; // he only breathes along during a session
      return (
        <>
          <Face x={60} y={33 + Math.sin(t * 0.8) * 0.8} rot={Math.sin(t * 0.4) * 5} eyes={sleepy ? 'half' : blink > 0.5 ? 'closed' : 'open'} look={look} blink={blink} earTwitch={twitch} />
          <Paw x={48} y={50} /><Paw x={72} y={50} />
        </>
      );
    }
    case 'look':
      return (<><SitBody t={t} tail={1.2} /><FrontLegs /><Face x={65} y={32} rot={-14} eyes="wide" look={look} blink={blink} /></>);
    case 'crouch': {
      // Rear up and wiggling, eyes locked on the butterfly.
      const wig = still ? 0 : Math.sin(t * 14) * 1.6;
      return (
        <g>
          <Limb d={`M32 ${60 + wig} C 18 ${56 + wig} 12 ${46 - wig} ${16 + wig * 2} 38`} w={6.5} />
          <path d={`M28 84 C 22 ${70 + wig} 26 ${56 + wig} 40 ${55 + wig} C 56 56 70 64 82 71 C 89 76 87 84 80 84 Z`} fill={F.fur} stroke={F.line} stroke-width="1.2" />
          <ellipse cx="35" cy={72 + wig * 0.5} rx="11" ry="12" fill={F.fur} stroke={F.line} stroke-width="1.1" />
          <path d="M40 59 q 4 4 0 8 M48 60 q 4 4 0 8" stroke={F.dark} stroke-width="2.2" fill="none" stroke-linecap="round" />
          <Paw x={78} y={85} /><Paw x={88} y={85} />
          <Face x={88} y={62} eyes="wide" look={look} mouth="none" />
        </g>
      );
    }
    case 'pounce': {
      const k = Math.sin(Math.min(1, age / 0.7) * Math.PI);
      return (
        <g transform={`translate(0 ${-k * 26}) rotate(${-14 * k} 56 60)`}>
          <Limb d="M30 54 C 18 44 16 30 24 22" w={7} />
          <Limb d="M36 64 L 22 76" w={6.5} />
          <Limb d="M44 66 L 32 80" w={6.5} />
          <ellipse cx="54" cy="58" rx="27" ry="13" fill={F.fur} stroke={F.line} stroke-width="1.2" />
          <ellipse cx="36" cy="60" rx="11" ry="11" fill={F.fur} stroke={F.line} stroke-width="1.1" />
          <path d="M44 47 q 4 4 0 8 M52 46 q 4 4 0 8" stroke={F.dark} stroke-width="2.2" fill="none" stroke-linecap="round" />
          <Limb d="M70 62 C 80 60 88 56 96 52" w={6.2} />
          <Limb d="M72 66 C 82 64 90 60 98 57" w={6.2} />
          <Paw x={97} y={53} /><Paw x={99} y={58} />
          <Face x={82} y={44} eyes="wide" look={[1, -1]} mouth="none" />
        </g>
      );
    }
    case 'roll': {
      const kick = still ? 0 : Math.sin(t * 5);
      const wig = still ? 0 : Math.sin(t * 3) * 2;
      const pawUp = (x0: number, x1: number, p: number) => (
        <>
          <Limb d={`M${x0} 68 Q ${x0 + p} 56 ${x1} 56`} w={6} />
          <ellipse cx={x1} cy={57} rx="3.6" ry="3" fill={F.cream} stroke={F.line} stroke-width="0.9" />
        </>
      );
      return (
        <g transform={`rotate(${wig} 58 80)`}>
          <Limb d="M30 80 C 16 84 10 72 18 66 C 22 63 26 66 24 70" w={6.5} />
          <ellipse cx="56" cy="76" rx="29" ry="11.5" fill={F.fur} stroke={F.line} stroke-width="1.2" />
          <ellipse cx="56" cy="72" rx="19" ry="6.5" fill={F.cream} />
          {pawUp(42, 44 + kick, -6)}
          {pawUp(50, 52 - kick, -4)}
          {pawUp(62, 64 + kick, 4)}
          {pawUp(70, 73 - kick, 6)}
          <Face x={88} y={66} rot={-28} eyes="happy" />
        </g>
      );
    }
    case 'sit':
      return (<><SitBody t={t} /><FrontLegs /><Face x={65} y={33} rot={Math.sin(t * 0.4) * 4} eyes="open" look={look} blink={blink} earTwitch={twitch} /></>);
    case 'loaf':
    default:
      return (<><LoafBody t={t} /><Paw x={74} y={85} /><Paw x={84} y={85} /><Face x={80} y={46} rot={Math.sin(t * 0.3) * 3} eyes={blink > 0.5 ? 'closed' : 'open'} look={look} blink={blink} earTwitch={twitch} /></>);
  }
}
