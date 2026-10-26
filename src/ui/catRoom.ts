// Where the cat may be. He sits along the bottom of the screen or on the top
// edge of a card or picture, but only where nothing is behind him: no text,
// buttons, pictures or cards. These helpers find those places.

export type Span = [number, number];
/** Something on screen; `card` when it is only a card's or panel's background. */
export interface Box { left: number; right: number; top: number; bottom: number; card?: boolean }

/** Somewhere he can sit: the floor along the bottom of the screen (`el` null)
 *  or the top edge of an element. Screen px. */
export interface Perch {
  el: Element | null;
  left: number;
  width: number;
  /** Where his feet go. */
  foot: number;
  /** The free stretches along it (relative to `left`) for each size he may
   *  take, biggest first; empty when none fits. */
  sizes: { s: number; spans: Span[] }[];
}

/** The stretches of [0, width] that none of `boxes` cross within the band
 *  [top, bottom], keeping `margin` from each, and at least `min` wide. Boxes
 *  are in screen x; `x0` is where the stretch starts. */
export function freeSpans(boxes: Box[], top: number, bottom: number, x0: number, width: number, min: number, margin = 8): Span[] {
  const blocked = boxes
    .filter((b) => b.bottom > top && b.top < bottom && b.right > b.left)
    .map((b): Span => [b.left - x0 - margin, b.right - x0 + margin])
    .sort((a, b) => a[0] - b[0]);
  const free: Span[] = [];
  let at = 0;
  for (const [l, r] of blocked) {
    const end = Math.min(l, width);
    if (end - at >= min) free.push([at, end]);
    at = Math.max(at, r);
    if (at >= width) break;
  }
  if (width - at >= min) free.push([at, width]);
  return free;
}

/** The span holding a cat of half-width `half` centred at `cx`, if any. */
export function spanAt(spans: Span[], cx: number, half: number): Span | undefined {
  return spans.find((sp) => cx - half >= sp[0] - 0.5 && cx + half <= sp[1] + 0.5);
}

/** The closest place to `cx` in `spans` where a cat of half-width `half` fits. */
export function nearestIn(spans: Span[], cx: number, half: number): [Span, number] | null {
  let best: [Span, number] | null = null;
  for (const sp of spans) {
    const to = Math.max(sp[0] + half, Math.min(sp[1] - half, cx));
    if (!best || Math.abs(to - cx) < Math.abs(best[1] - cx)) best = [sp, to];
  }
  return best;
}

const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="slider"], [role="switch"], [tabindex]';
const MEDIA = 'img, svg, canvas, video, picture, iframe';
/** Never in his way: the page itself, and the sticky button band, which keeps
 *  room for him on purpose. */
const PASS = '.sticky-next, .app, #app, body, html';

/** A computed colour's alpha: rgb(), rgba(), or color(srgb … / a). */
function alpha(c: string): number {
  if (c === 'transparent') return 0;
  const slash = c.match(/\/\s*([\d.]+)(%?)/);
  if (slash) return slash[2] ? +slash[1] / 100 : +slash[1];
  const n = c.match(/[\d.]+/g);
  return c.startsWith('rgba') && n && n.length >= 4 ? +n[3] : 1;
}

/** A card or panel: something with a visible background or border. */
function painted(cs: CSSStyleDeclaration): boolean {
  if (cs.backgroundImage !== 'none' || alpha(cs.backgroundColor) > 0.05) return true;
  return cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0 && alpha(cs.borderTopColor) > 0.05;
}

/** Everything on screen within [top, bottom] that he must not cover (text,
 *  controls, pictures and cards; a card's own text and controls come as
 *  boxes of their own), and the cards and pictures at least
 *  `ledgeMin` wide whose top edge he could sit on. Skips `self`, his own layer. */
export function scan(top: number, bottom: number, self: Element, ledgeMin = Infinity): { boxes: Box[]; ledges: Element[] } {
  const boxes: Box[] = [];
  const ledges: Element[] = [];
  const vw = window.innerWidth;
  const range = document.createRange();
  for (const el of document.body.querySelectorAll('*')) {
    if (self.contains(el) || (el instanceof SVGElement && !(el instanceof SVGSVGElement))) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom <= top || r.top >= bottom || r.width < 1 || r.height < 1 || r.right <= 0 || r.left >= vw) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
    const media = el.matches(MEDIA);
    const card = !el.matches(PASS) && painted(cs);
    const control = el.matches(INTERACTIVE);
    if (media || card || control) {
      boxes.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, card: card && !media && !control });
      if ((media || card) && r.width >= ledgeMin && r.height >= 24) ledges.push(el);
      if (!card) continue; // (a card's own text still counts, below)
    }
    for (const n of el.childNodes) {
      if (n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim()) continue;
      range.selectNodeContents(n);
      // A line box carries some line spacing the letters never reach.
      for (const t of range.getClientRects()) boxes.push({ left: t.left, right: t.right, top: t.top + 2, bottom: t.bottom - 2 });
    }
  }
  return { boxes, ledges };
}

export interface Geometry {
  /** The floor's place on screen (a hidden twin of it, so it reads the same
   *  whether or not he is down there). */
  floor: DOMRect;
  /** The top of the usable screen (below a notch or status bar). */
  top: number;
  /** Height of his box at full size, his width, how far above the floor's
   *  bottom his feet are, and how far his paws overlap a ledge. */
  h: number;
  w: number;
  lift: number;
  feet: number;
  sizes: number[];
}

/** Room for just his head and paws over an edge: `w` wide, `h` tall. */
export interface Peek { w: number; h: number }

/** Where `el` (or the floor) puts his feet and what stretch it spans; null if
 *  it is gone or off screen. */
function ledgeOf(el: Element | null, g: Geometry, peek?: Peek): { left: number; width: number; foot: number; base: number } | null {
  if (!el) return { left: g.floor.left, width: g.floor.width, foot: g.floor.bottom - g.lift, base: g.floor.bottom };
  if (!el.isConnected) return null;
  const r = el.getBoundingClientRect();
  const room = peek ? peek.h : g.h * Math.min(...g.sizes) - g.feet;
  if (r.top - room < g.top || r.top > window.innerHeight - 24) return null;
  return { left: r.left, width: r.width, foot: r.top + g.feet, base: r.top };
}

function perchFrom(el: Element | null, at: NonNullable<ReturnType<typeof ledgeOf>>, boxes: Box[], g: Geometry, peek?: Peek): Perch {
  // Peeking, just his ears and eyes may show over a card's empty background.
  const sizes = peek
    ? [{ s: 1, spans: freeSpans(boxes.filter((b) => !b.card), at.base - peek.h, at.base, at.left, at.width, peek.w) }]
    : g.sizes
      .filter((s) => at.foot - g.h * s >= g.top)
      .map((s) => ({ s, spans: freeSpans(boxes, at.foot - g.h * s, at.base, at.left, at.width, g.w * s) }));
  return { el, left: at.left, width: at.width, foot: at.foot, sizes };
}

/** Just one place, checked against what is around it now: for sitting, or
 *  with `peek` for peeking over its edge. */
export function perchNow(el: Element | null, self: Element, g: Geometry, peek?: Peek): Perch | null {
  const at = ledgeOf(el, g, peek);
  if (!at) return null;
  return perchFrom(el, at, scan(at.base - (peek ? peek.h : g.h), at.base, self).boxes, g, peek);
}

/** Every place on screen he could sit right now, or with `peek`, peek over. */
export function allPerches(self: Element, g: Geometry, peek?: Peek): Perch[] {
  const { boxes, ledges } = scan(0, window.innerHeight, self, peek ? peek.w : g.w * Math.min(...g.sizes));
  const out: Perch[] = [];
  for (const el of [null, ...ledges]) {
    const at = ledgeOf(el, g, peek);
    if (!at) continue;
    const p = perchFrom(el, at, boxes, g, peek);
    if (p.sizes.some((z) => z.spans.length)) out.push(p);
  }
  return out;
}

export interface Spot { p: Perch; s: number; sp: Span; cx: number }

/** The place closest to the screen point (x, y) for a cat `w` wide, favouring
 *  his full size. Leaves out the perch on `skip` when given. */
export function bestSpot(perches: Perch[], x: number, y: number, w: number, skip?: Element | null): Spot | null {
  let best: (Spot & { cost: number }) | null = null;
  for (const p of perches) {
    if (skip !== undefined && p.el === skip) continue;
    for (const z of p.sizes) {
      const n = nearestIn(z.spans, x - p.left, (w * z.s) / 2);
      if (!n) continue;
      const cost = Math.hypot(p.left + n[1] - x, p.foot - y) + (1 - z.s) * 300;
      if (!best || cost < best.cost) best = { p, s: z.s, sp: n[0], cx: n[1], cost };
    }
  }
  return best && { p: best.p, s: best.s, sp: best.sp, cx: best.cx };
}
