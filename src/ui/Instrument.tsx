// Calm, note-synced animations: a piano with notes drifting down onto softly
// glowing keys, or four strings that gently vibrate as the parts play.
// Everything fades smoothly. Nothing flashes.

import { useEffect, useRef } from 'preact/hooks';
import * as engine from '../audio/engine';
import type { VisualNote } from '../music/score';
import { breathAt, type BreathPattern, type BreathPhase } from '../audio/dsp/breath';

export interface Timeline {
  notes: VisualNote[];
  length: number;
  parts?: { start: number; title: string; composer: string }[];
}

const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(m % 12);
const PHASE: Record<BreathPhase, string> = { in: 'Breathe in', topup: 'Sip more', hold: 'Hold', out: 'Breathe out' };

function cssVar(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/** Index of the first note that ends after time t (notes sorted by start). */
function firstVisible(notes: VisualNote[], t: number): number {
  let lo = 0, hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].t < t - 12) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function InstrumentView({ kind, timeline, playing, breathing, pattern, onPart, showPill = true }: {
  kind: 'piano' | 'strings';
  timeline: Timeline | null;
  playing: boolean;
  breathing: boolean;
  pattern: BreathPattern;
  showPill?: boolean;
  onPart?: (title: string, composer: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const partRef = useRef('');

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx2 = cv.getContext('2d');
    if (!ctx2) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const accent = cssVar(cv, '--accent', '#e2a75e');
    const glow = new Map<number, number>(); // midi -> 0..1 (smoothed)
    let raf = 0;
    let last = performance.now();
    const t0 = performance.now();

    const notes = timeline?.notes ?? [];
    const len = timeline?.length ?? 1;
    // Keyboard range: where most notes are (3rd-97th percentile), at least
    // four octaves, at most five, so keys stay wide enough on a phone.
    let lo = 48, hi = 95;
    if (notes.length) {
      const ms = notes.map((n) => n.midi).sort((a, b) => a - b);
      const q = (p: number) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))];
      lo = q(0.03); hi = q(0.97);
      const narrow = cv.clientWidth < 500;
      const maxSpan = narrow ? 52 : 64;
      while (hi - lo < 47) { lo -= 1; if (hi - lo < 47) hi += 1; }
      if (hi - lo > maxSpan) { const mid = q(0.5); lo = mid - (maxSpan >> 1); hi = lo + maxSpan; }
      lo = Math.max(21, lo - (lo % 12)); // start on a C
      hi = Math.min(108, hi + (11 - (hi % 12))); // end on a B
    }
    const whites: number[] = [];
    for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.clearRect(0, 0, W, H);

      const mt = playing ? engine.musicTime() % len : 0;
      // Which keys are down now (also across the loop seam).
      const down = new Map<number, number>();
      const i0 = firstVisible(notes, mt);
      const look = 3.2;
      const visible: { n: VisualNote; t: number }[] = [];
      const scan = (offset: number) => {
        for (let i = offset === 0 ? i0 : 0; i < notes.length; i++) {
          const n = notes[i];
          const t = n.t + offset;
          if (t > mt + look) break;
          if (t + n.dur < mt - 0.1) continue;
          visible.push({ n, t });
          if (t <= mt && t + n.dur >= mt) down.set(n.midi, Math.max(down.get(n.midi) ?? 0, n.vel));
        }
      };
      if (playing) {
        scan(0);
        if (mt + look > len) scan(len);
      }
      // Smooth glow: quick (~80 ms) rise, slow (~400 ms) fall.
      for (let m = lo; m <= hi; m++) {
        const target = down.get(m) ?? 0;
        const g = glow.get(m) ?? 0;
        const k = target > g ? 1 - Math.exp(-dt / 0.08) : 1 - Math.exp(-dt / 0.4);
        glow.set(m, g + (target - g) * k);
      }

      const bt = playing ? engine.sessionTime() : (now - t0) / 1000;
      const bs = breathAt(pattern, bt);
      if (breathing) drawTide(ctx2, W, H, kind === 'piano' ? H - Math.min(78, H * 0.3) : H, bs.level, accent);
      if (kind === 'piano') drawPiano(ctx2, W, H, { lo, hi, whites, glow, visible, mt, look, accent, reduce: !!reduce, dim: breathing ? 0.55 : 1 });
      else drawStrings(ctx2, W, H, { glow, accent, time: (now - t0) / 1000, reduce: !!reduce });

      // Breathing pill and now-playing label.
      if (pill.current && dot.current) {
        pill.current.style.opacity = breathing && showPill ? '1' : '0';
        if (label.current) label.current.textContent = PHASE[bs.phase];
        if (num.current) num.current.textContent = String(Math.max(1, Math.ceil(bs.remaining)));
        dot.current.style.transform = `scale(${0.4 + 0.6 * bs.level})`;
      }
      if (onPart && timeline?.parts?.length && playing) {
        let cur = timeline.parts[0];
        for (const p of timeline.parts) if (p.start <= mt + 0.5) cur = p;
        if (cur.title !== partRef.current) { partRef.current = cur.title; onPart(cur.title, cur.composer); }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [timeline, playing, kind, breathing, pattern, showPill]);

  return (
    <div class="instrument">
      <canvas ref={canvas} class={`instrument-canvas ${kind}`} aria-label={kind === 'piano' ? 'Piano animation' : 'Strings animation'} role="img" />
      <div class="breath-pill" ref={pill}>
        <span class="breath-dot" ref={dot} />
        <span ref={label}>Breathe in</span>
        <span class="num" ref={num} />
      </div>
    </div>
  );
}

/**
 * The tide: a soft wash of light that rises as you breathe in and sinks as you
 * breathe out, with a bright line at its edge. Easy to follow without
 * watching the notes.
 */
function drawTide(c: CanvasRenderingContext2D, W: number, _H: number, floor: number, level: number, accent: string) {
  // Band height follows the breath: about 18% of the stage when empty, 82% when full.
  const top = floor - (0.18 + 0.64 * level) * floor;
  const wave = (x: number) => top + 5 * Math.sin((x / W) * Math.PI * 2 + level * 2.5);
  c.beginPath();
  c.moveTo(0, floor);
  for (let x = 0; x <= W; x += 6) c.lineTo(x, wave(x));
  c.lineTo(W, wave(W));
  c.lineTo(W, floor);
  c.closePath();
  const g = c.createLinearGradient(0, top, 0, floor);
  g.addColorStop(0, accent);
  g.addColorStop(1, accent);
  c.globalAlpha = 0.16 + 0.08 * level;
  c.fillStyle = g;
  c.fill();
  // The bright edge of the tide.
  c.globalAlpha = 0.9;
  c.strokeStyle = accent;
  c.lineWidth = 2.5;
  c.beginPath();
  for (let x = 0; x <= W; x += 6) { const y = wave(x); if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.lineTo(W, wave(W));
  c.stroke();
  c.globalAlpha = 1;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function drawPiano(
  c: CanvasRenderingContext2D, W: number, H: number,
  o: { lo: number; hi: number; whites: number[]; glow: Map<number, number>; visible: { n: VisualNote; t: number }[]; mt: number; look: number; accent: string; reduce: boolean; dim: number },
) {
  const keyH = Math.min(78, H * 0.3);
  const top = H - keyH;
  const ww = W / o.whites.length;
  const xOf = (m: number): [number, number] => {
    if (!isBlack(m)) return [o.whites.indexOf(m) * ww, ww];
    const left = o.whites.indexOf(m - 1);
    return [(left + 1) * ww - ww * 0.32, ww * 0.64];
  };

  // Soft vertical guide lines at each C.
  c.strokeStyle = 'rgba(255,255,255,0.04)';
  c.lineWidth = 1;
  for (const m of o.whites) if (m % 12 === 0) { const [x] = xOf(m); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, top); c.stroke(); }

  // Falling notes.
  if (!o.reduce) {
    for (const { n, t } of o.visible) {
      if (n.midi < o.lo || n.midi > o.hi) continue;
      const yEnd = top - ((t - o.mt) / o.look) * top; // bottom of the bar = onset
      const h = Math.max(6, (n.dur / o.look) * top);
      const [x, w] = xOf(n.midi);
      const y = yEnd - h;
      if (y > top) continue;
      c.globalAlpha = (0.28 + 0.5 * n.vel) * o.dim;
      const grad = c.createLinearGradient(0, y, 0, yEnd);
      grad.addColorStop(0, 'rgba(255,255,255,0.0)');
      grad.addColorStop(0.35, o.accent);
      grad.addColorStop(1, o.accent);
      c.fillStyle = grad;
      roundRect(c, x + 1.5, Math.max(0, y), w - 3, Math.min(top, yEnd) - Math.max(0, y), Math.min(6, w / 2));
      c.fill();
    }
    c.globalAlpha = 1;
  }

  // Soft glow above pressed keys.
  for (const [m, g] of o.glow) {
    if (g < 0.02 || m < o.lo || m > o.hi) continue;
    const [x, w] = xOf(m);
    const cx = x + w / 2;
    const rad = c.createRadialGradient(cx, top, 0, cx, top, 46);
    rad.addColorStop(0, o.accent);
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.35 * g;
    c.fillStyle = rad;
    c.fillRect(cx - 46, top - 46, 92, 60);
  }
  c.globalAlpha = 1;

  // Keys: white first, then black on top.
  for (const m of o.whites) {
    const [x, w] = xOf(m);
    const g = o.glow.get(m) ?? 0;
    c.fillStyle = '#efe6d8';
    roundRect(c, x + 0.75, top + 1, w - 1.5, keyH - 2, 4);
    c.fill();
    if (g > 0.01) {
      c.globalAlpha = 0.75 * g;
      c.fillStyle = o.accent;
      roundRect(c, x + 0.75, top + 1, w - 1.5, keyH - 2, 4);
      c.fill();
      c.globalAlpha = 1;
    }
  }
  for (let m = o.lo; m <= o.hi; m++) {
    if (!isBlack(m)) continue;
    const [x, w] = xOf(m);
    const g = o.glow.get(m) ?? 0;
    c.fillStyle = '#2a241f';
    roundRect(c, x, top, w, keyH * 0.62, 3);
    c.fill();
    if (g > 0.01) {
      c.globalAlpha = 0.85 * g;
      c.fillStyle = o.accent;
      roundRect(c, x, top, w, keyH * 0.62, 3);
      c.fill();
      c.globalAlpha = 1;
    }
  }
  // A soft shade at the top of the keys, like a key slip.
  const shade = c.createLinearGradient(0, top, 0, top + 10);
  shade.addColorStop(0, 'rgba(20,18,16,0.55)');
  shade.addColorStop(1, 'rgba(20,18,16,0)');
  c.fillStyle = shade;
  c.fillRect(0, top, W, 10);
}

const STRING_NAMES = ['Violin I', 'Violin II', 'Viola', 'Cello'];

function drawStrings(c: CanvasRenderingContext2D, W: number, H: number, o: { glow: Map<number, number>; accent: string; time: number; reduce: boolean }) {
  // Map pitch ranges to four instruments.
  const ranges: [number, number][] = [[64, 108], [57, 63], [48, 56], [21, 47]];
  const act = ranges.map(([a, b]) => {
    let s = 0;
    for (const [m, g] of o.glow) if (m >= a && m <= b) s = Math.max(s, g);
    return s;
  });
  const pad = 22;
  const gap = (H - pad * 2) / 4;
  c.font = '12px ui-sans-serif, system-ui, sans-serif';
  c.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) {
    const y = pad + gap * (i + 0.5);
    const a = act[i];
    // The string: a gentle standing wave whose height follows the music.
    const amp = o.reduce ? 0 : (3 + 9 * (3 - i) / 3) * a;
    c.strokeStyle = o.accent;
    c.globalAlpha = 0.35 + 0.55 * a;
    c.lineWidth = 1.2 + i * 0.5;
    c.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const u = x / W;
      const env = Math.sin(Math.PI * u);
      const yy = y + amp * env * Math.sin(2 * Math.PI * (1.5 + i * 0.3) * o.time + u * 3);
      if (x === 0) c.moveTo(x, yy); else c.lineTo(x, yy);
    }
    c.stroke();
    c.globalAlpha = 0.55;
    c.fillStyle = '#b9ad9c';
    c.fillText(STRING_NAMES[i], 8, y - gap * 0.32);
  }
  c.globalAlpha = 1;
}
