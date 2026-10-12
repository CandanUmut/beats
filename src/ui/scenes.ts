// Hand-drawn, animated scenes for the session screen. Everything is drawn
// with canvas paths (no images), so each scene is ours and works offline.
// Each scene shows the breath through one natural element: the tide comes in,
// the mist rises, the sun lifts. Motion is slow and smooth; nothing flashes.

import { mulberry32 } from '../audio/dsp/random';

export type SceneId = 'beach' | 'forest' | 'night' | 'lake' | 'ocean' | 'meadow';

export const SCENES: { id: SceneId; name: string; breath: string }[] = [
  { id: 'beach', name: 'Palm beach', breath: 'the tide' },
  { id: 'forest', name: 'Forest', breath: 'the mist' },
  { id: 'ocean', name: 'Ocean', breath: 'the waves' },
  { id: 'lake', name: 'Mountain lake', breath: 'the sun' },
  { id: 'night', name: 'Night sky', breath: 'the aurora' },
  { id: 'meadow', name: 'Sunrise', breath: 'the sun' },
];

type Ctx = CanvasRenderingContext2D;

function grad(c: Ctx, y0: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

function glow(c: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = alpha;
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.globalAlpha = 1;
}

/** A ridge line of hills or mountains, filled down to the bottom. */
function ridge(c: Ctx, W: number, H: number, base: number, amp: number, seed: number, color: string, sharp = false) {
  const r = mulberry32(seed);
  const pts: number[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) pts.push(base - amp * (0.35 + 0.65 * r()));
  c.beginPath();
  c.moveTo(0, H);
  c.lineTo(0, pts[0]);
  for (let i = 1; i <= n; i++) {
    const x0 = ((i - 1) / n) * W, x1 = (i / n) * W;
    if (sharp) c.lineTo(x1 - (x1 - x0) / 2, Math.min(pts[i - 1], pts[i]) - amp * 0.25 * r()), c.lineTo(x1, pts[i]);
    else c.quadraticCurveTo((x0 + x1) / 2, (pts[i - 1] + pts[i]) / 2 - amp * 0.2, x1, pts[i]);
  }
  c.lineTo(W, H);
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

function pine(c: Ctx, x: number, base: number, h: number, color: string) {
  const w = h * 0.36;
  c.fillStyle = color;
  c.beginPath();
  for (let k = 0; k < 4; k++) {
    const top = base - h + (k * h) / 5;
    const bw = w * (0.45 + k * 0.2);
    c.moveTo(x, top);
    c.lineTo(x - bw / 2, top + h * 0.38);
    c.lineTo(x + bw / 2, top + h * 0.38);
    c.closePath();
  }
  c.fill();
  c.fillRect(x - h * 0.02, base - h * 0.1, h * 0.04, h * 0.12);
}

/** A palm tree silhouette with a curved trunk and drooping fronds, gently swaying. */
function palm(c: Ctx, x: number, base: number, h: number, lean: number, sway: number, color: string) {
  const topX = x + lean * h + sway * h * 0.6;
  const topY = base - h;
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineCap = 'round';
  // Trunk: tapered segments along a curve.
  const segs = 14;
  for (let i = 0; i < segs; i++) {
    const u0 = i / segs, u1 = (i + 1) / segs;
    const px = (u: number) => x + (topX - x) * u + Math.sin(u * Math.PI) * lean * h * 0.35;
    const py = (u: number) => base + (topY - base) * u;
    c.lineWidth = h * (0.05 - 0.028 * u0);
    c.beginPath();
    c.moveTo(px(u0), py(u0));
    c.lineTo(px(u1), py(u1));
    c.stroke();
  }
  // Fronds.
  const fronds = [-2.7, -2.2, -1.6, -1.0, -0.45, 0.15, 0.65];
  for (const a0 of fronds) {
    const a = a0 + sway * 1.5;
    const len = h * (0.42 + 0.08 * Math.cos(a0 * 3));
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.55 + len * 0.35;
    const cx = topX + Math.cos(a) * len * 0.5;
    const cy = topY - len * 0.18;
    c.beginPath();
    c.moveTo(topX, topY);
    c.quadraticCurveTo(cx, cy - h * 0.03, ex, ey);
    c.quadraticCurveTo(cx, cy + h * 0.05, topX, topY + h * 0.02);
    c.fill();
  }
  // Coconuts.
  c.beginPath();
  c.arc(topX - h * 0.015, topY + h * 0.03, h * 0.022, 0, Math.PI * 2);
  c.arc(topX + h * 0.02, topY + h * 0.035, h * 0.02, 0, Math.PI * 2);
  c.fill();
}

function stars(c: Ctx, W: number, _H: number, t: number, count: number, maxY: number, seed: number, still: boolean) {
  const r = mulberry32(seed);
  c.fillStyle = '#f3ebdf';
  for (let i = 0; i < count; i++) {
    const x = r() * W, y = r() * maxY, s = 0.5 + r() * 1.2, base = 0.35 + r() * 0.5, f = 0.1 + r() * 0.25, p = r() * 6.28;
    c.globalAlpha = still ? base : base * (0.85 + 0.15 * Math.sin(t * f * 6.28 + p));
    c.beginPath();
    c.arc(x, y, s, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

/** Soft wavy line across the width; used for tides, mist edges and water. */
function waveLine(W: number, y: number, amp: number, k: number, phase: number) {
  return (x: number) => y + amp * Math.sin((x / W) * Math.PI * 2 * k + phase) + amp * 0.4 * Math.sin((x / W) * Math.PI * 2 * k * 2.3 - phase * 1.3);
}

function fillBelow(c: Ctx, W: number, H: number, f: (x: number) => number, style: string | CanvasGradient, alpha = 1) {
  c.beginPath();
  c.moveTo(0, H);
  for (let x = 0; x <= W; x += 6) c.lineTo(x, f(x));
  c.lineTo(W, f(W));
  c.lineTo(W, H);
  c.closePath();
  c.globalAlpha = alpha;
  c.fillStyle = style;
  c.fill();
  c.globalAlpha = 1;
}

function strokeLine(c: Ctx, W: number, f: (x: number) => number, color: string, width: number, alpha: number, blur = 0) {
  c.beginPath();
  for (let x = 0; x <= W; x += 6) (x === 0 ? c.moveTo(x, f(x)) : c.lineTo(x, f(x)));
  c.lineTo(W, f(W));
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = width;
  c.shadowColor = color;
  c.shadowBlur = blur;
  c.stroke();
  c.shadowBlur = 0;
  c.globalAlpha = 1;
}

export interface SceneFrame {
  t: number;
  /** Breath level 0 (empty) .. 1 (full). */
  breath: number;
  /** Show the breath element (false when the guide is off). */
  breathing: boolean;
  still: boolean;
}

export function drawScene(c: Ctx, id: SceneId, W: number, H: number, f: SceneFrame): void {
  const L = f.breathing ? f.breath : 0.5;
  const t = f.still ? 0 : f.t;
  switch (id) {
    case 'beach': {
      const hor = H * 0.56;
      c.fillStyle = grad(c, 0, hor, [[0, '#24172a'], [0.45, '#6b3546'], [0.8, '#d97f55'], [1, '#f2bd76']]);
      c.fillRect(0, 0, W, hor);
      const sx = W * 0.6, sr = Math.min(W, H) * 0.13;
      glow(c, sx, hor, sr * 4, '#f7c77d', 0.55);
      c.save();
      c.beginPath();
      c.rect(0, 0, W, hor);
      c.clip();
      c.fillStyle = '#f9d996';
      c.beginPath();
      c.arc(sx, hor + sr * 0.25, sr, 0, Math.PI * 2);
      c.fill();
      c.restore();
      c.fillStyle = grad(c, hor, H, [[0, '#8a4a4c'], [0.5, '#3e2531'], [1, '#22171f']]);
      c.fillRect(0, hor, W, H - hor);
      // Sun's reflection: short shimmering streaks.
      c.fillStyle = '#f7c77d';
      for (let i = 0; i < 9; i++) {
        const y = hor + 6 + i * (H * 0.035);
        const w = sr * (1.4 - i * 0.12) * (0.75 + 0.25 * Math.sin(t * 0.8 + i));
        c.globalAlpha = 0.5 - i * 0.045;
        c.fillRect(sx - w / 2 + Math.sin(t * 0.5 + i * 1.7) * 4, y, w, 2);
      }
      c.globalAlpha = 1;
      // Sand, then the tide that washes in as you breathe in.
      const sandTop = H * 0.8;
      fillBelow(c, W, H, waveLine(W, sandTop, 4, 0.7, 0.6), grad(c, sandTop, H, [[0, '#6f4a3a'], [1, '#3a2620']]));
      const tide = waveLine(W, H * (0.93 - 0.17 * L), 3.5, 1.3, t * 0.6);
      fillBelow(c, W, H, tide, grad(c, H * 0.75, H, [[0, '#9a5a5a'], [1, '#4a2c34']]), 0.85);
      strokeLine(c, W, tide, '#f6ead8', 2.5, 0.9, 8);
      const sway = Math.sin(t * 0.45) * 0.03;
      palm(c, W * 0.1, H * 0.9, H * 0.72, 0.18, sway, '#140c12');
      palm(c, W * 0.9, H * 0.88, H * 0.5, -0.22, -sway * 0.8, '#1b1018');
      return;
    }
    case 'forest': {
      c.fillStyle = grad(c, 0, H, [[0, '#17201d'], [0.55, '#33463d'], [0.75, '#7e9a80'], [1, '#2a3530']]);
      c.fillRect(0, 0, W, H);
      glow(c, W * 0.5, H * 0.62, Math.max(W, H) * 0.6, '#c9d9b0', 0.35);
      ridge(c, W, H, H * 0.62, H * 0.12, 3, '#3e5248');
      const far = mulberry32(11), mid = mulberry32(12), near = mulberry32(13);
      for (let i = 0; i < 26; i++) pine(c, far() * W, H * (0.7 + far() * 0.04), H * (0.14 + far() * 0.08), '#33463e');
      // Mist rises with your breath.
      const mistY = H * (0.95 - 0.5 * L);
      const mist = waveLine(W, mistY, 6, 0.8, t * 0.2);
      // A soft band of mist: brightest just under its top, fading below. No hard edge.
      fillBelow(c, W, H, mist, grad(c, mistY - 6, H, [[0, 'rgba(236,240,226,0.42)'], [0.12, 'rgba(236,240,226,0.3)'], [0.5, 'rgba(236,240,226,0.14)'], [1, 'rgba(236,240,226,0.08)']]));
      fillBelow(c, W, H, waveLine(W, mistY - 14, 8, 0.6, -t * 0.15), grad(c, mistY - 30, mistY + 40, [[0, 'rgba(236,240,226,0)'], [1, 'rgba(236,240,226,0.16)']]));
      for (let i = 0; i < 14; i++) pine(c, mid() * W, H * (0.86 + mid() * 0.04), H * (0.26 + mid() * 0.1), '#22302a');
      for (let i = 0; i < 5; i++) {
        const side = i % 2 ? W * (0.88 + near() * 0.14) : W * (near() * 0.14);
        pine(c, side, H * 1.02, H * (0.55 + near() * 0.2), '#111814');
      }
      // Fireflies drift on slow loops.
      const ff = mulberry32(21);
      for (let i = 0; i < 12; i++) {
        const cx = ff() * W, cy = H * (0.5 + ff() * 0.4), rx = 10 + ff() * 30, sp = 0.05 + ff() * 0.1, p = ff() * 6.28;
        const x = cx + Math.sin(t * sp * 6.28 + p) * rx, y = cy + Math.cos(t * sp * 4 + p) * rx * 0.5;
        glow(c, x, y, 7, '#f3e3a0', 0.35 + 0.25 * Math.sin(t * 0.4 + p));
      }
      return;
    }
    case 'ocean': {
      c.fillStyle = grad(c, 0, H * 0.5, [[0, '#1d1a2a'], [0.6, '#4b3a4e'], [1, '#c58f74']]);
      c.fillRect(0, 0, W, H * 0.5);
      stars(c, W, H, t, 30, H * 0.3, 7, f.still);
      glow(c, W * 0.3, H * 0.47, W * 0.5, '#e7b08a', 0.4);
      c.fillStyle = grad(c, H * 0.48, H, [[0, '#5a4656'], [1, '#191520']]);
      c.fillRect(0, H * 0.48, W, H * 0.52);
      // Three wave layers; the nearest rises with the breath.
      fillBelow(c, W, H, waveLine(W, H * 0.6, 3, 2, t * 0.25), '#3d3042', 0.9);
      fillBelow(c, W, H, waveLine(W, H * 0.72, 5, 1.5, -t * 0.35 + 1), '#2d2433', 0.95);
      const front = waveLine(W, H * (0.95 - 0.28 * L), 7, 1.1, t * 0.5);
      fillBelow(c, W, H, front, grad(c, H * 0.6, H, [[0, '#4c3a48'], [1, '#1c1620']]));
      strokeLine(c, W, front, '#f3e6d6', 2.5, 0.85, 8);
      // Moon-path reflection under the low glow.
      c.fillStyle = '#f1c9a4';
      for (let i = 0; i < 8; i++) {
        const y = H * 0.5 + i * H * 0.03;
        const w = W * (0.16 - i * 0.012) * (0.8 + 0.2 * Math.sin(t * 0.7 + i));
        c.globalAlpha = 0.35 - i * 0.035;
        c.fillRect(W * 0.3 - w / 2 + Math.sin(t * 0.4 + i) * 3, y, w, 1.6);
      }
      c.globalAlpha = 1;
      // Foam just under the breath line.
      fillBelow(c, W, H, (x) => front(x) + 2, grad(c, H * 0.6, H, [[0, 'rgba(243,230,214,0.18)'], [0.2, 'rgba(243,230,214,0)']]));
      // Two rocks, with a warm rim light from the low sky.
      const rock = (x0: number, w: number, h: number) => {
        c.beginPath();
        c.moveTo(x0, H);
        c.quadraticCurveTo(x0 + w * 0.2, H - h, x0 + w * 0.55, H - h * 0.92);
        c.quadraticCurveTo(x0 + w * 0.9, H - h * 0.85, x0 + w, H);
        c.closePath();
        c.fillStyle = '#1a141c';
        c.fill();
        c.globalAlpha = 0.45;
        c.strokeStyle = '#e7b08a';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x0 + w * 0.08, H - h * 0.55);
        c.quadraticCurveTo(x0 + w * 0.2, H - h, x0 + w * 0.55, H - h * 0.92);
        c.stroke();
        c.globalAlpha = 1;
      };
      rock(W * 0.7, W * 0.32, H * 0.22);
      rock(W * 0.6, W * 0.12, H * 0.09);
      return;
    }
    case 'lake': {
      const hor = H * 0.58;
      c.fillStyle = grad(c, 0, hor, [[0, '#2b4340'], [0.55, '#6f938a'], [1, '#e1e8c8']]);
      c.fillRect(0, 0, W, hor);
      // The sun rises behind the peaks as you breathe in.
      const sunY = hor - H * (0.02 + 0.3 * L);
      glow(c, W * 0.5, sunY, H * 0.5, '#f8e8b4', f.breathing ? 0.6 : 0.45);
      c.fillStyle = '#fbf0cc';
      c.beginPath();
      c.arc(W * 0.5, sunY, H * 0.06, 0, Math.PI * 2);
      c.fill();
      ridge(c, W, hor + 2, hor - H * 0.02, H * 0.26, 41, '#3b5953', true);
      ridge(c, W, hor + 2, hor, H * 0.12, 42, '#2a433b');
      c.fillStyle = grad(c, hor, H, [[0, '#5d8178'], [1, '#1b2a25']]);
      c.fillRect(0, hor, W, H - hor);
      // Mirrored, softened reflection of the mountains.
      c.save();
      c.beginPath();
      c.rect(0, hor, W, H - hor);
      c.clip();
      c.translate(0, hor * 2);
      c.scale(1, -1);
      c.globalAlpha = 0.25;
      ridge(c, W, hor + 2, hor - H * 0.02, H * 0.26, 41, '#3b5953', true);
      c.restore();
      c.globalAlpha = 1;
      glow(c, W * 0.5, hor + (hor - sunY) * 0.6, H * 0.25, '#f8e8b4', 0.3);
      // Ripples of varied length and brightness, drifting slowly.
      const rr = mulberry32(77);
      for (let i = 0; i < 14; i++) {
        const y = hor + 6 + rr() * (H - hor - 10);
        const len = W * (0.05 + rr() * 0.18);
        const x = ((rr() * W + t * (4 + rr() * 6)) % (W + len)) - len;
        c.globalAlpha = 0.08 + rr() * 0.17;
        c.strokeStyle = '#e6eed8';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + len, y);
        c.stroke();
      }
      c.globalAlpha = 1;
      return;
    }
    case 'night': {
      c.fillStyle = grad(c, 0, H, [[0, '#0b0f20'], [0.6, '#1c2541'], [1, '#2a3550']]);
      c.fillRect(0, 0, W, H);
      stars(c, W, H, t, 110, H * 0.7, 5, f.still);
      // Moon.
      glow(c, W * 0.8, H * 0.18, H * 0.3, '#dfe6f5', 0.35);
      c.fillStyle = '#eef0f5';
      c.beginPath();
      c.arc(W * 0.8, H * 0.18, H * 0.055, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#121a33';
      c.beginPath();
      c.arc(W * 0.8 + H * 0.025, H * 0.17, H * 0.05, 0, Math.PI * 2);
      c.fill();
      // Aurora ribbon that rises with your breath.
      const y = H * (0.72 - 0.38 * L);
      const ribbon = waveLine(W, y, 10, 0.9, t * 0.15);
      c.beginPath();
      for (let x = 0; x <= W; x += 6) (x === 0 ? c.moveTo(x, ribbon(x)) : c.lineTo(x, ribbon(x)));
      for (let x = W; x >= 0; x -= 6) c.lineTo(x, ribbon(x) + H * 0.16);
      c.closePath();
      const ag = grad(c, y - 10, y + H * 0.16, [[0, 'rgba(160,214,190,0.55)'], [1, 'rgba(147,171,200,0)']]);
      c.fillStyle = ag;
      c.fill();
      strokeLine(c, W, ribbon, '#cfeee0', 2, 0.7, 12);
      ridge(c, W, H, H * 0.82, H * 0.16, 31, '#141b2c', true);
      ridge(c, W, H, H * 0.9, H * 0.08, 32, '#0c111e');
      // A tiny warm window.
      glow(c, W * 0.22, H * 0.86, 14, '#f2b866', 0.6);
      return;
    }
    case 'meadow': {
      c.fillStyle = grad(c, 0, H, [[0, '#2a2338'], [0.45, '#a3687a'], [0.7, '#f0b77a'], [1, '#f6d79c']]);
      c.fillRect(0, 0, W, H);
      const sunY = H * (0.72 - 0.34 * L);
      glow(c, W * 0.42, sunY, H * 0.55, '#ffe2a0', 0.5);
      c.fillStyle = '#fff0c4';
      c.beginPath();
      c.arc(W * 0.42, sunY, H * 0.07, 0, Math.PI * 2);
      c.fill();
      ridge(c, W, H, H * 0.74, H * 0.08, 51, '#6d5a5a');
      ridge(c, W, H, H * 0.82, H * 0.07, 52, '#4a3d40');
      ridge(c, W, H, H * 0.9, H * 0.05, 53, '#2e2528');
      // Grass blades swaying in the foreground.
      c.fillStyle = '#1d1719';
      const g = mulberry32(61);
      for (let i = 0; i < 80; i++) {
        const x = g() * W, h = 12 + g() * 28, ph = g() * 6.28, base = 2 + g() * 2;
        const sw = Math.sin(t * 0.6 + ph + x * 0.01) * 5;
        // A tapered, curved blade.
        c.beginPath();
        c.moveTo(x - base / 2, H);
        c.quadraticCurveTo(x + sw * 0.4 - base * 0.2, H - h * 0.6, x + sw, H - h);
        c.quadraticCurveTo(x + sw * 0.4 + base * 0.2, H - h * 0.6, x + base / 2, H);
        c.fill();
      }
      // Two birds gliding slowly.
      c.strokeStyle = '#2a2026';
      c.lineWidth = 1.6;
      for (let i = 0; i < 2; i++) {
        const bx = ((t * 6 + i * W * 0.4) % (W + 60)) - 30, by = H * (0.5 + i * 0.06) + Math.sin(t * 0.5 + i) * 6;
        const flap = 4 + 2 * Math.sin(t * 1.2 + i);
        c.beginPath();
        c.moveTo(bx - 8, by - flap * 0.5);
        c.quadraticCurveTo(bx - 3, by - flap, bx, by);
        c.quadraticCurveTo(bx + 3, by - flap, bx + 8, by - flap * 0.5);
        c.stroke();
      }
      return;
    }
  }
}
