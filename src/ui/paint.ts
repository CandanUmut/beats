// A small painting kit for the scenes, in the spirit of a wet-on-wet landscape:
// soft brushed skies, puffy clouds lit from one side, knife-edged snowy
// mountains fading into mist, fan-brush evergreens, dabbed bushes, still water
// with mirrored reflections, and a cabin with a warm window. All canvas paths,
// seeded, so every painting is the same each time it's drawn.

export type Ctx = CanvasRenderingContext2D;
export type Rand = () => number;

// --- Colour -----------------------------------------------------------------

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(h: string, a: number): string {
  const [r, g, b] = hex(h);
  return `rgba(${r},${g},${b},${a})`;
}

/** Blend two hex colours; t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const A = hex(a), B = hex(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function vgrad(c: Ctx, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(Math.min(1, Math.max(0, o)), col);
  return g;
}

/** A soft round dab: full colour at the centre, fading to nothing at the edge. */
export function soft(c: Ctx, x: number, y: number, r: number, color: string, alpha: number): void {
  if (r <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.55, rgba(color, alpha * 0.6));
  g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

// --- Layers -----------------------------------------------------------------

export function layer(W: number, H: number, dpr: number, draw: (c: Ctx) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(W * dpr));
  cv.height = Math.max(1, Math.round(H * dpr));
  const c = cv.getContext('2d')!;
  c.scale(dpr, dpr);
  draw(c);
  return cv;
}

// --- Sky and clouds ---------------------------------------------------------

/** A brushed sky: a gradient with long, faint horizontal strokes on top. */
export function sky(c: Ctx, W: number, horizon: number, stops: [number, string][], streak: string, r: Rand): void {
  c.fillStyle = vgrad(c, 0, horizon, stops);
  c.fillRect(0, 0, W, horizon + 2);
  for (let i = 0; i < 40; i++) {
    const y = Math.pow(r(), 0.8) * horizon * 0.95;
    const w = W * (0.25 + r() * 0.6);
    const x = r() * W;
    c.fillStyle = rgba(streak, 0.035 + r() * 0.05);
    c.beginPath();
    c.ellipse(x, y, w / 2, 1.5 + r() * 3.5, 0, 0, Math.PI * 2);
    c.fill();
  }
}

/** A puffy cloud with a flat-ish base, shaded below and lit on one side. */
export function cloud(c: Ctx, x: number, y: number, w: number, h: number, shade: string, light: string, lightX: number, r: Rand): void {
  const n = 10 + Math.round(w / 10);
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    const bump = Math.cos(u * Math.PI);
    const rad = h * (0.28 + 0.5 * bump * (0.6 + 0.4 * r()));
    puffs.push([x + u * w + (r() - 0.5) * w * 0.08, y - rad * 0.45 * bump + (r() - 0.5) * h * 0.12, rad]);
  }
  c.save();
  c.beginPath();
  c.rect(x - w, y - h * 4, w * 2, h * 4 + h * 0.3);
  c.clip();
  for (const [px, py, rad] of puffs) soft(c, px, py, rad, shade, 0.75);
  const dir = Math.sign(lightX - x) || -1;
  for (const [px, py, rad] of puffs) soft(c, px + dir * rad * 0.22, py - rad * 0.28, rad * 0.72, light, 0.6);
  c.restore();
}

/** A long, thin evening cloud: stretched soft dabs, lit from below. */
export function streak(c: Ctx, x: number, y: number, w: number, h: number, shade: string, light: string, r: Rand): void {
  for (let i = 0; i < 7; i++) {
    const px = x + (r() - 0.5) * w * 0.7, py = y + (r() - 0.5) * h * 0.6, ww = w * (0.25 + r() * 0.35);
    c.save();
    c.translate(px, py);
    c.scale(ww / h, 1);
    soft(c, 0, 0, h, shade, 0.55);
    soft(c, 0, h * 0.25, h * 0.7, light, 0.45);
    c.restore();
  }
}

// --- Mountains --------------------------------------------------------------

/** Jagged line from a to b by midpoint displacement. Returns the points a..b. */
function jag(x0: number, y0: number, x1: number, y1: number, rough: number, r: Rand, depth = 5): [number, number][] {
  let pts: [number, number][] = [[x0, y0], [x1, y1]];
  let amp = Math.hypot(x1 - x0, y1 - y0) * rough;
  for (let d = 0; d < depth; d++) {
    const next: [number, number][] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      next.push([(ax + bx) / 2 + (r() - 0.5) * amp * 0.3, (ay + by) / 2 + (r() - 0.5) * amp]);
      next.push([bx, by]);
    }
    pts = next;
    amp *= 0.5;
  }
  return pts;
}

export interface MountainColors {
  base: string;
  /** Sunlit face (the snow, near the top). */
  snow: string;
  /** Sunlit rock lower down. */
  lit: string;
  /** Colour the base melts into. */
  haze: string;
}

/**
 * A snowy mountain. The light side is a bright plane broken by dark knife
 * strokes; the base melts into mist.
 */
export function mountain(c: Ctx, cx: number, peakY: number, baseY: number, w: number, col: MountainColors, lightLeft: boolean, r: Rand, snowLine = 0.55): void {
  const left = jag(cx - w / 2, baseY, cx, peakY, 0.16, r);
  const right = jag(cx, peakY, cx + w / 2, baseY, 0.16, r);
  const outline = [...left, ...right.slice(1)];
  const path = () => {
    c.beginPath();
    c.moveTo(outline[0][0], outline[0][1]);
    for (const [x, y] of outline) c.lineTo(x, y);
    c.closePath();
  };
  path();
  c.fillStyle = col.base;
  c.fill();
  c.save();
  path();
  c.clip();
  const h = baseY - peakY;
  // The spine down from the peak separates the lit face from the shaded one.
  const dir = lightLeft ? 1 : -1;
  const spine = jag(cx, peakY, cx + dir * w * 0.1, baseY, 0.12, r, 4);
  const face = lightLeft ? left : [...right].reverse();
  c.beginPath();
  c.moveTo(face[0][0], face[0][1]);
  for (const [x, y] of face) c.lineTo(x, y);
  for (const [x, y] of spine) c.lineTo(x, y);
  c.closePath();
  c.fillStyle = vgrad(c, peakY, baseY, [[0, col.snow], [snowLine * 0.8, col.snow], [snowLine, col.lit], [1, col.lit]]);
  c.fill();
  // Knife strokes: dark breaks running down and out across the lit face.
  c.strokeStyle = rgba(col.base, 0.6);
  c.lineCap = 'round';
  for (let k = 0; k < 12; k++) {
    const p = spine[Math.floor(r() * spine.length * 0.9)];
    const len = h * (0.06 + r() * 0.16);
    c.lineWidth = 0.8 + r() * 2.2;
    c.beginPath();
    c.moveTo(p[0] - dir * r() * w * 0.04, p[1]);
    c.lineTo(p[0] - dir * len * (0.6 + r() * 0.6), p[1] + len);
    c.stroke();
  }
  // A little snow in the shadow too.
  c.strokeStyle = rgba(mix(col.snow, col.base, 0.55), 0.7);
  for (let k = 0; k < 10; k++) {
    const p = spine[Math.floor(r() * spine.length * 0.6)];
    const len = h * (0.04 + r() * 0.1);
    c.lineWidth = 0.8 + r() * 1.6;
    c.beginPath();
    c.moveTo(p[0] + dir * 2, p[1]);
    c.lineTo(p[0] + dir * len * (0.8 + r()), p[1] + len * 0.9);
    c.stroke();
  }
  // Mist at the foot.
  c.fillStyle = vgrad(c, baseY - h * 0.55, baseY, [[0, rgba(col.haze, 0)], [1, rgba(col.haze, 0.95)]]);
  c.fillRect(cx - w, baseY - h * 0.55, w * 2, h * 0.55 + 1);
  c.restore();
}

/** Rolling hills: a soft ridge filled down to the bottom, lit along the top. */
export function hills(c: Ctx, W: number, H: number, base: number, amp: number, waves: number, phase: number, color: string, light: string | null, r: Rand): (x: number) => number {
  const k1 = waves, k2 = waves * 2.3 + r();
  const p2 = r() * 6;
  const f = (x: number) => base - amp * (0.55 + 0.3 * Math.sin((x / W) * Math.PI * k1 + phase) + 0.15 * Math.sin((x / W) * Math.PI * k2 + p2));
  c.beginPath();
  c.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) c.lineTo(x, f(x));
  c.lineTo(W, H);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  if (light) {
    c.save();
    c.clip();
    c.strokeStyle = rgba(light, 0.5);
    c.lineWidth = Math.max(1.5, amp * 0.12);
    c.beginPath();
    for (let x = 0; x <= W; x += 4) (x === 0 ? c.moveTo(x, f(x) + 1) : c.lineTo(x, f(x) + 1));
    c.stroke();
    c.restore();
  }
  return f;
}

// --- Trees ------------------------------------------------------------------

/** A row of tiny distant evergreens standing on a line. */
export function treeLine(c: Ctx, W: number, y: number, h: number, color: string, r: Rand, gap = 3.5, x0 = -6, x1 = W + 6): void {
  c.fillStyle = color;
  c.beginPath();
  for (let x = x0; x < x1; x += gap * (0.5 + r())) {
    const th = h * (0.45 + r() * 0.75);
    const tw = th * (0.18 + r() * 0.08);
    c.moveTo(x, y - th);
    c.lineTo(x - tw, y + 1);
    c.lineTo(x + tw, y + 1);
    c.closePath();
  }
  c.fill();
}

/**
 * A "happy little" evergreen: a jagged dark silhouette that widens toward the
 * bottom with drooping tiers, brushed with a mid tone, and touched with light
 * on the sunny side.
 */
export function pine(c: Ctx, x: number, base: number, h: number, dark: string, lit: string, r: Rand, lightLeft = true, trunk = '#3a2a1e'): void {
  const top = base - h;
  c.fillStyle = trunk;
  c.fillRect(x - h * 0.012, base - h * 0.12, h * 0.024, h * 0.12);
  const tiers = Math.max(5, Math.round(h / 9));
  const rows: [number, number][] = [];
  for (let i = 0; i < tiers; i++) {
    const u = (i + 1) / tiers;
    rows.push([top + u * h * 0.88, h * 0.29 * (0.12 + 0.88 * Math.pow(u, 0.9)) * (0.82 + 0.36 * r())]);
  }
  // Silhouette: down the left side tier by tier, back up the right.
  const tip = (side: number, [y, hw]: [number, number], k: number): [number, number][] => [
    [x + side * hw * 0.45, y - hw * 0.25 - k * 0],
    [x + side * hw, y + hw * 0.18],
    [x + side * hw * 0.62, y + hw * 0.05],
  ];
  c.fillStyle = dark;
  c.beginPath();
  c.moveTo(x, top);
  rows.forEach((row, k) => { for (const [px, py] of tip(-1, row, k)) c.lineTo(px + (r() - 0.5) * 1.5, py); });
  c.lineTo(x, rows[rows.length - 1][0] + 2);
  [...rows].reverse().forEach((row, k) => { for (const [px, py] of tip(1, row, k).reverse()) c.lineTo(px + (r() - 0.5) * 1.5, py); });
  c.closePath();
  c.fill();
  // Brushed texture inside each tier.
  const mid = mix(dark, lit, 0.28);
  const lw = Math.max(0.8, h * 0.012);
  c.lineCap = 'round';
  c.strokeStyle = mid;
  c.lineWidth = lw;
  c.beginPath();
  for (const [y, hw] of rows) {
    for (let k = 0; k < Math.max(3, hw / 3); k++) {
      const side = r() < 0.5 ? -1 : 1;
      const sx = x + side * hw * r() * 0.5, sy = y - hw * 0.15 + r() * hw * 0.2;
      const len = hw * (0.2 + r() * 0.35);
      c.moveTo(sx, sy);
      c.lineTo(sx + side * len, sy + len * 0.35);
    }
  }
  c.stroke();
  // Light on the sunny side of each tier.
  const ls = lightLeft ? -1 : 1;
  c.strokeStyle = lit;
  c.lineWidth = lw * 1.1;
  c.beginPath();
  for (const [y, hw] of rows) {
    const n = Math.max(1, Math.round(hw / 5));
    for (let k = 0; k < n; k++) {
      if (r() < 0.2) continue;
      const sx = x + ls * hw * (0.35 + r() * 0.35), sy = y - hw * 0.05 + r() * hw * 0.12;
      const len = hw * (0.15 + r() * 0.3);
      c.moveTo(sx, sy);
      c.lineTo(sx + ls * len, sy + len * 0.38);
    }
  }
  c.stroke();
}

/** A bush or the crown of a leafy tree: dabs in dark, mid and light. */
export function bush(c: Ctx, x: number, y: number, w: number, h: number, tones: [string, string, string], r: Rand, lightLeft = true): void {
  const n = Math.max(12, Math.round((w * h) / 14));
  const dot = Math.max(1.2, Math.min(w, h) * 0.07);
  const ls = lightLeft ? -1 : 1;
  tones.forEach((tone, pass) => {
    const count = pass === 0 ? n : pass === 1 ? n * 0.6 : n * 0.3;
    c.fillStyle = tone;
    c.beginPath();
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * (1 - pass * 0.22);
      const px = x + Math.cos(a) * rr * w / 2 + ls * pass * w * 0.08;
      const py = y - h / 2 + Math.sin(a) * rr * h / 2 - pass * h * 0.1;
      const d = dot * (0.6 + r() * 0.8);
      c.moveTo(px + d, py);
      c.arc(px, py, d, 0, Math.PI * 2);
    }
    c.fill();
  });
}

/** A leafy tree: a branching trunk with dabbed clusters of leaves. */
export function leafyTree(c: Ctx, x: number, base: number, h: number, tones: [string, string, string], trunk: string, r: Rand, lightLeft = true): void {
  c.strokeStyle = trunk;
  c.lineCap = 'round';
  const tw = h * 0.07;
  c.lineWidth = tw;
  c.beginPath();
  c.moveTo(x, base);
  c.quadraticCurveTo(x - tw * 0.4, base - h * 0.3, x + tw * 0.2, base - h * 0.55);
  c.stroke();
  const tips: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.45 + (r() - 0.5) * 0.2;
    const len = h * (0.25 + r() * 0.15);
    const sx = x + tw * 0.2, sy = base - h * (0.45 + r() * 0.12);
    const ex = sx + Math.cos(a) * len, ey = sy + Math.sin(a) * len;
    c.lineWidth = tw * 0.45;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(ex, ey);
    c.stroke();
    tips.push([ex, ey]);
  }
  const cw = h * 0.42;
  for (const [tx, ty] of tips) bush(c, tx, ty + cw * 0.3, cw, cw * 0.75, tones, r, lightLeft);
  bush(c, x, base - h * 0.62, h * 0.8, h * 0.55, tones, r, lightLeft);
}

/** Grass and flowers along the bottom: short upward strokes. */
export function grass(c: Ctx, x0: number, x1: number, y: number, h: number, colors: string[], r: Rand, density = 1.4): void {
  c.lineCap = 'round';
  for (const col of colors) {
    c.strokeStyle = col;
    c.lineWidth = 1.1;
    c.beginPath();
    for (let x = x0; x < x1; x += density * (0.4 + r())) {
      const hh = h * (0.4 + r() * 0.6);
      const yy = y + r() * h * 0.6;
      c.moveTo(x, yy);
      c.quadraticCurveTo(x + (r() - 0.5) * hh * 0.4, yy - hh * 0.6, x + (r() - 0.5) * hh * 0.6, yy - hh);
    }
    c.stroke();
  }
}

export function flowers(c: Ctx, x0: number, x1: number, y0: number, y1: number, colors: string[], n: number, r: Rand): void {
  for (let i = 0; i < n; i++) {
    const y = y0 + Math.pow(r(), 0.7) * (y1 - y0);
    const s = 0.8 + ((y - y0) / Math.max(1, y1 - y0)) * 2.2;
    c.fillStyle = colors[Math.floor(r() * colors.length)];
    c.beginPath();
    c.arc(x0 + r() * (x1 - x0), y, s, 0, Math.PI * 2);
    c.fill();
  }
}

// --- Water ------------------------------------------------------------------

/**
 * Still water: a mirrored, softened copy of what's above the waterline, a
 * tint, and a few horizontal wipes of light.
 */
export function stillWater(c: Ctx, src: HTMLCanvasElement, W: number, H: number, wl: number, tint: string, light: string, r: Rand, alpha = 0.55): void {
  c.save();
  c.beginPath();
  c.rect(0, wl, W, H - wl);
  c.clip();
  c.globalAlpha = alpha;
  c.translate(0, wl * 2);
  c.scale(1, -1);
  // Smear the reflection a little by drawing it a few times, slightly offset.
  for (const dx of [-1.5, 0, 1.5]) c.drawImage(src, dx, 0, W, H);
  c.restore();
  c.fillStyle = vgrad(c, wl, H, [[0, rgba(tint, 0.35)], [1, rgba(tint, 0.85)]]);
  c.fillRect(0, wl, W, H - wl);
  // Horizontal wipes, more and brighter near the far shore.
  c.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const d = Math.pow(r(), 1.6);
    const y = wl + 2 + d * (H - wl - 4);
    const len = W * (0.04 + r() * 0.22) * (0.6 + d);
    const x = r() * W;
    c.strokeStyle = rgba(light, (0.08 + 0.2 * (1 - d)) * (0.5 + r() * 0.5));
    c.lineWidth = 0.8 + d * 1.5;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len, y);
    c.stroke();
  }
  // The bright line where water meets the far shore.
  c.strokeStyle = rgba(light, 0.55);
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(0, wl + 0.5);
  c.lineTo(W, wl + 0.5);
  c.stroke();
}

// --- Buildings and things ---------------------------------------------------

export interface CabinColors { wall: string; side: string; roof: string; roofLit: string; glow: string }

/** A small log cabin with a warm window and a chimney. Returns the chimney top. */
export function cabin(c: Ctx, x: number, base: number, w: number, col: CabinColors): [number, number] {
  const wh = w * 0.5, sd = w * 0.75, rise = sd * 0.18;
  const apexY = base - wh - w * 0.42;
  // Side wall (in shade).
  c.fillStyle = col.side;
  c.beginPath();
  c.moveTo(x + w, base);
  c.lineTo(x + w + sd, base - rise);
  c.lineTo(x + w + sd, base - wh - rise);
  c.lineTo(x + w, base - wh);
  c.closePath();
  c.fill();
  // Chimney.
  const chx = x + w + sd * 0.7, chTop = apexY - rise * 0.6;
  c.fillStyle = mix(col.side, '#000000', 0.2);
  c.fillRect(chx - w * 0.07, chTop, w * 0.14, base - wh - rise - chTop + 4);
  // Roof (lit slope).
  c.fillStyle = col.roofLit;
  c.beginPath();
  c.moveTo(x + w / 2, apexY);
  c.lineTo(x + w / 2 + sd, apexY - rise);
  c.lineTo(x + w + sd + w * 0.08, base - wh - rise + w * 0.06);
  c.lineTo(x + w + w * 0.08, base - wh + w * 0.06);
  c.closePath();
  c.fill();
  // Front gable.
  c.fillStyle = col.wall;
  c.beginPath();
  c.moveTo(x, base);
  c.lineTo(x, base - wh);
  c.lineTo(x + w / 2, apexY);
  c.lineTo(x + w, base - wh);
  c.lineTo(x + w, base);
  c.closePath();
  c.fill();
  // Logs.
  c.strokeStyle = rgba('#000000', 0.18);
  c.lineWidth = Math.max(0.6, w * 0.02);
  c.beginPath();
  for (let i = 1; i < 6; i++) {
    const y = base - (wh * i) / 6;
    c.moveTo(x, y);
    c.lineTo(x + w, y);
    c.moveTo(x + w, y);
    c.lineTo(x + w + sd, y - rise);
  }
  c.stroke();
  // Roof edge on the gable.
  c.strokeStyle = col.roof;
  c.lineWidth = Math.max(1, w * 0.06);
  c.beginPath();
  c.moveTo(x - w * 0.06, base - wh + w * 0.05);
  c.lineTo(x + w / 2, apexY);
  c.lineTo(x + w + w * 0.08, base - wh + w * 0.06);
  c.stroke();
  // Door and the warm window.
  c.fillStyle = mix(col.wall, '#000000', 0.45);
  c.fillRect(x + w * 0.12, base - wh * 0.62, w * 0.2, wh * 0.62);
  soft(c, x + w * 0.66, base - wh * 0.5, w * 0.45, col.glow, 0.35);
  c.fillStyle = col.glow;
  c.fillRect(x + w * 0.52, base - wh * 0.68, w * 0.28, wh * 0.36);
  c.fillStyle = rgba('#3a2412', 0.8);
  c.fillRect(x + w * 0.655, base - wh * 0.68, w * 0.012 + 0.6, wh * 0.36);
  c.fillRect(x + w * 0.52, base - wh * 0.5, w * 0.28, w * 0.012 + 0.6);
  // Side window, glowing too.
  c.fillStyle = col.glow;
  c.beginPath();
  const swx = x + w + sd * 0.35, sww = sd * 0.22;
  c.moveTo(swx, base - wh * 0.32 - rise * 0.35);
  c.lineTo(swx + sww, base - wh * 0.32 - rise * 0.35 - sww * 0.24);
  c.lineTo(swx + sww, base - wh * 0.68 - rise * 0.35 - sww * 0.24);
  c.lineTo(swx, base - wh * 0.68 - rise * 0.35);
  c.closePath();
  c.fill();
  soft(c, swx + sww / 2, base - wh * 0.5 - rise * 0.4, w * 0.35, col.glow, 0.25);
  return [chx, chTop];
}

/** Soft smoke rising from a chimney, drifting with the breeze. */
export function smoke(c: Ctx, x: number, y: number, s: number, t: number, color: string): void {
  for (let k = 0; k < 7; k++) {
    const age = (t * 0.07 + k / 7) % 1;
    const px = x + Math.sin(age * 4 + k) * s * 0.12 + age * s * 0.9;
    const py = y - age * s * 2.2;
    soft(c, px, py, s * (0.12 + 0.35 * age), color, 0.22 * Math.sin(Math.PI * Math.min(1, age * 1.4)));
  }
}

/** A few birds, two strokes each, drifting slowly across. */
export function birds(c: Ctx, W: number, y: number, t: number, color: string, n: number, seed: number, scale = 1): void {
  c.strokeStyle = color;
  c.lineWidth = 1.2;
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sp = 5 + ((seed * 7 + i * 13) % 5);
    const x = ((i * W * 0.37 + seed * 50 + t * sp) % (W + 60)) - 30;
    const yy = y + Math.sin(t * 0.3 + i * 2) * 6 + i * 9;
    const f = Math.sin(t * 2.2 + i * 1.7);
    const s = (3.5 + (i % 2)) * scale;
    c.beginPath();
    c.moveTo(x - s, yy - f * s * 0.5);
    c.quadraticCurveTo(x - s * 0.4, yy - s * 0.5, x, yy);
    c.quadraticCurveTo(x + s * 0.4, yy - s * 0.5, x + s, yy - f * s * 0.5);
    c.stroke();
  }
}

// --- Finish -----------------------------------------------------------------

let grainPattern: CanvasPattern | null = null;

/** A faint paper grain and a soft vignette, so it reads as a painting. */
export function finish(c: Ctx, W: number, H: number): void {
  if (!grainPattern) {
    const g = document.createElement('canvas');
    g.width = g.height = 96;
    const gc = g.getContext('2d')!;
    const img = gc.createImageData(96, 96);
    let s = 7;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 16807) % 2147483647;
      const v = 128 + ((s % 255) - 127);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    gc.putImageData(img, 0, 0);
    grainPattern = c.createPattern(g, 'repeat');
  }
  if (grainPattern) {
    c.globalAlpha = 0.045;
    c.fillStyle = grainPattern;
    c.fillRect(0, 0, W, H);
    c.globalAlpha = 1;
  }
  const v = c.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(20,14,10,0)');
  v.addColorStop(1, 'rgba(20,14,10,0.35)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
}
