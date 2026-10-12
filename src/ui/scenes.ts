// Painted, animated scenes for the session screen, drawn with canvas paths
// (no images) in a soft landscape-painting style (see paint.ts). The still
// parts of each painting are drawn once into cached layers; only a few things
// move on top. The sun and moon stay put. The breath moves one thing that
// would really move like that: a wave runs up the sand, a boat rides the
// swell, a balloon lifts, the mist rises, the northern lights grow, a kite
// climbs. Motion is slow and smooth; nothing flashes.

import { mulberry32 } from '../audio/dsp/random';
import {
  type Ctx, rgba, vgrad, soft, layer, sky, cloud, streak, mountain, hills, treeLine, pine, bush, leafyTree,
  grass, flowers, stillWater, cabin, smoke, birds, finish,
} from './paint';

export type SceneId = 'beach' | 'forest' | 'night' | 'lake' | 'ocean' | 'meadow';

export const SCENES: { id: SceneId; name: string; breath: string; hint: string }[] = [
  { id: 'beach', name: 'Palm beach', breath: 'the wave', hint: 'in as the wave runs up the sand, out as it slides back' },
  { id: 'forest', name: 'Misty forest', breath: 'the mist', hint: 'in as the mist rises, out as it settles' },
  { id: 'ocean', name: 'Evening sea', breath: 'the boat', hint: 'in as the boat lifts on the swell, out as it sinks' },
  { id: 'lake', name: 'Mountain lake', breath: 'the balloon', hint: 'in as the balloon rises, out as it drifts down' },
  { id: 'night', name: 'Northern lights', breath: 'the lights', hint: 'in as the lights grow, out as they fade' },
  { id: 'meadow', name: 'Kite meadow', breath: 'the kite', hint: 'in as the kite climbs, out as it dips' },
];

export interface SceneFrame {
  t: number;
  /** Breath level 0 (empty) .. 1 (full). */
  breath: number;
  /** Show the breath element moving (false when the guide is off). */
  breathing: boolean;
  /** Breathing in right now (the balloon's burner glows). */
  inhale?: boolean;
  still: boolean;
}

type Layers = Record<string, HTMLCanvasElement>;
interface Painting {
  build(W: number, H: number, dpr: number): Layers;
  frame(c: Ctx, L: Layers, W: number, H: number, f: SceneFrame, b: number): void;
}

const img = (c: Ctx, cv: HTMLCanvasElement, W: number, H: number) => c.drawImage(cv, 0, 0, W, H);

/** Draw a layer twice, offset, so it drifts sideways forever. */
function drift(c: Ctx, cv: HTMLCanvasElement, W: number, H: number, t: number, speed: number) {
  const o = (t * speed) % W;
  c.drawImage(cv, o, 0, W, H);
  c.drawImage(cv, o - W, 0, W, H);
}

/** Clouds drawn three times across so the drifting layer wraps seamlessly. */
function clouds(W: number, H: number, dpr: number, list: [number, number, number, number][], shade: string, light: string, lightX: number, seed: number) {
  return layer(W, H, dpr, (c) => {
    for (const [x, y, w, h] of list) {
      for (const dx of [-W, 0, W]) cloud(c, x * W + dx, y * H, w * W, h * H, shade, light, lightX * W + dx, mulberry32(seed + Math.round(x * 100)));
    }
  });
}

/** Composite several layers into one canvas (to reflect them in water). */
function composite(W: number, H: number, dpr: number, parts: HTMLCanvasElement[]) {
  return layer(W, H, dpr, (c) => { for (const p of parts) img(c, p, W, H); });
}

// --- Palm trees -------------------------------------------------------------

export function palm(c: Ctx, x: number, base: number, h: number, lean: number, sway: number, seed: number) {
  const r = mulberry32(seed);
  const px = (u: number) => x + lean * h * u + Math.sin(u * Math.PI) * lean * h * 0.22 + sway * h * u * u * 0.4;
  const py = (u: number) => base - h * u;
  const wd = (u: number) => h * (0.05 - 0.024 * u);
  // Trunk: a tapering band, lit on the left.
  const L: [number, number][] = [], R: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16, d = 0.01;
    const dx = px(u + d) - px(u - d), dy = py(u + d) - py(u - d);
    const n = Math.hypot(dx, dy);
    const nx = -dy / n, ny = dx / n;
    L.push([px(u) - nx * wd(u) / 2, py(u) - ny * wd(u) / 2]);
    R.push([px(u) + nx * wd(u) / 2, py(u) + ny * wd(u) / 2]);
  }
  c.fillStyle = '#6b4e36';
  c.beginPath();
  c.moveTo(L[0][0], L[0][1]);
  for (const p of L) c.lineTo(p[0], p[1]);
  for (const p of [...R].reverse()) c.lineTo(p[0], p[1]);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(232,196,150,0.55)';
  c.lineWidth = wd(0.3) * 0.35;
  c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < L.length; i++) (i ? c.lineTo(L[i][0] + 1, L[i][1]) : c.moveTo(L[i][0] + 1, L[i][1]));
  c.stroke();
  // Rings.
  c.strokeStyle = 'rgba(52,34,22,0.55)';
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 1; i < 16; i++) { c.moveTo(L[i][0], L[i][1]); c.lineTo(R[i][0], R[i][1] - 1.5); }
  c.stroke();
  // Fronds: a curved spine with leaflets on both sides.
  const tx = px(1), ty = py(1);
  const fr = [-2.9, -2.45, -2.0, -1.55, -1.15, -0.7, -0.25, 0.25];
  for (let k = 0; k < fr.length; k++) {
    const a = fr[k] + sway * 0.8 + (r() - 0.5) * 0.12;
    const len = h * (0.36 + 0.1 * r());
    const droop = 0.35 + 0.3 * Math.abs(Math.cos(a));
    const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.45 + len * droop;
    const cx = tx + Math.cos(a) * len * 0.55, cy = ty + Math.sin(a) * len * 0.6 - len * 0.12;
    const at = (s: number): [number, number] => [
      (1 - s) * (1 - s) * tx + 2 * (1 - s) * s * cx + s * s * ex,
      (1 - s) * (1 - s) * ty + 2 * (1 - s) * s * cy + s * s * ey,
    ];
    for (const pass of [0, 1]) {
      c.strokeStyle = pass ? '#7fa55e' : '#2f5236';
      c.lineWidth = pass ? Math.max(1.1, h * 0.005) : Math.max(1.8, h * 0.009);
      c.beginPath();
      for (let s = 0.1; s <= 1; s += 0.055) {
        const [x0, y0] = at(s), [x1, y1] = at(Math.min(1, s + 0.02));
        const ang = Math.atan2(y1 - y0, x1 - x0);
        const ll = len * 0.2 * Math.sin(Math.PI * Math.min(1, s * 1.1)) + 1;
        for (const side of pass ? [-1] : [-1, 1]) {
          const la = ang + side * 1.05 + 0.35;
          c.moveTo(x0, y0);
          c.lineTo(x0 + Math.cos(la) * ll, y0 + Math.sin(la) * ll + ll * 0.35);
        }
      }
      c.stroke();
    }
    c.strokeStyle = '#3d5a34';
    c.lineWidth = Math.max(1.4, h * 0.007);
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo(cx, cy, ex, ey);
    c.stroke();
  }
  c.fillStyle = '#5a3f28';
  c.beginPath();
  c.arc(tx - h * 0.018, ty + h * 0.03, h * 0.022, 0, Math.PI * 2);
  c.arc(tx + h * 0.018, ty + h * 0.035, h * 0.02, 0, Math.PI * 2);
  c.arc(tx, ty + h * 0.05, h * 0.019, 0, Math.PI * 2);
  c.fill();
}

// --- Beach: the wave runs up the sand --------------------------------------

const beach: Painting = {
  build(W, H, dpr) {
    const hz = H * 0.48, sh = H * 0.62;
    const back = layer(W, H, dpr, (c) => {
      const r = mulberry32(11);
      sky(c, W, hz, [[0, '#79a6c8'], [0.55, '#b9d2d8'], [0.85, '#f1dcc1'], [1, '#f6e4c6']], '#ffffff', r);
      soft(c, W * 0.76, H * 0.24, W * 0.5, '#fff1cf', 0.55);
      soft(c, W * 0.76, H * 0.24, W * 0.12, '#fffaf0', 0.9);
      c.fillStyle = '#fff8ea';
      c.beginPath();
      c.arc(W * 0.76, H * 0.24, Math.min(W, H) * 0.05, 0, Math.PI * 2);
      c.fill();
      // Sea.
      c.fillStyle = vgrad(c, hz, sh, [[0, '#6e9fb0'], [0.5, '#7fb8b8'], [1, '#a9d4c6']]);
      c.fillRect(0, hz, W, sh - hz);
      // A hazy island with a few palms on the left.
      c.fillStyle = '#89a7ad';
      c.beginPath();
      c.moveTo(-10, hz + 1);
      c.quadraticCurveTo(W * 0.12, hz - H * 0.07, W * 0.3, hz + 1);
      c.closePath();
      c.fill();
      for (const [px, ph] of [[0.08, 0.08], [0.12, 0.1], [0.17, 0.07]]) {
        c.strokeStyle = '#7d9aa1';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(W * px, hz - H * 0.03);
        c.quadraticCurveTo(W * px + 2, hz - H * ph * 0.6, W * px + 4, hz - H * ph);
        c.stroke();
        c.fillStyle = '#7d9aa1';
        for (let k = 0; k < 6; k++) {
          const a = -Math.PI + (k / 5) * Math.PI;
          c.beginPath();
          c.ellipse(W * px + 4 + Math.cos(a) * 5, hz - H * ph + Math.sin(a) * 2 + 2, 5, 1.4, a, 0, Math.PI * 2);
          c.fill();
        }
      }
      // Wipes of light on the sea, and the sun's path.
      for (let i = 0; i < 30; i++) {
        const y = hz + 2 + r() * (sh - hz - 4);
        c.strokeStyle = rgba('#f4fbf6', 0.12 + r() * 0.2);
        c.lineWidth = 1;
        c.beginPath();
        const x = r() * W, len = W * (0.03 + r() * 0.12);
        c.moveTo(x, y);
        c.lineTo(x + len, y);
        c.stroke();
      }
      // Sand.
      c.fillStyle = vgrad(c, sh, H, [[0, '#ead2a8'], [0.4, '#e2c393'], [1, '#cfa874']]);
      c.fillRect(0, sh, W, H - sh);
      for (let i = 0; i < 260; i++) {
        const y = sh + Math.pow(r(), 0.8) * (H - sh);
        c.fillStyle = rgba(r() < 0.5 ? '#b8915f' : '#f7e6c4', 0.35);
        c.fillRect(r() * W, y, 1 + r() * 1.5, 1);
      }
    });
    const cl = clouds(W, H, dpr, [[0.2, 0.17, 0.3, 0.07], [0.55, 0.1, 0.22, 0.05], [0.9, 0.2, 0.26, 0.06]], '#c3d1db', '#fff8ee', 0.76, 20);
    const front = layer(W, H, dpr, (c) => {
      const r = mulberry32(12);
      // Dune grass in the corners, a couple of shells.
      grass(c, W * 0.6, W * 1.02, H * 0.94, H * 0.08, ['#8c8a55', '#b4ae6c', '#d8cf90'], r, 2.2);
      grass(c, -4, W * 0.18, H * 0.95, H * 0.06, ['#8c8a55', '#c8c084'], r, 2.4);
      c.fillStyle = '#f6e9dc';
      for (const [sx, sy] of [[0.46, 0.93], [0.52, 0.96]]) {
        c.beginPath();
        c.ellipse(W * sx, H * sy, 3, 2, 0.3, 0, Math.PI * 2);
        c.fill();
      }
      finish(c, W, H);
    });
    return { back, cl, front };
  },
  frame(c, L, W, H, f, b) {
    const t = f.t, sh = H * 0.62, hz = H * 0.48;
    img(c, L.back, W, H);
    drift(c, L.cl, W, H, t, 1.2);
    birds(c, W, H * 0.16, t, 'rgba(70,80,90,0.55)', 3, 3);
    // Shimmer on the sun's path.
    for (let i = 0; i < 10; i++) {
      const y = hz + 3 + i * (sh - hz) / 11;
      const w = W * (0.02 + i * 0.008) * (0.6 + 0.4 * Math.sin(t * 0.9 + i * 1.7));
      c.fillStyle = rgba('#fff6e2', 0.5 - i * 0.03);
      c.fillRect(W * 0.76 - w / 2 + Math.sin(t * 0.5 + i) * 3, y, w, 1.4);
    }
    // The wash: in as it runs up the sand (toward you), out as it slides back.
    const edgeY = sh + H * (0.02 + 0.26 * b);
    const edge = (x: number) => edgeY + Math.sin((x / W) * 7 + t * 0.4) * H * 0.008 + Math.sin((x / W) * 17 - t * 0.3) * H * 0.004;
    const full = sh + H * 0.29;
    // Wet sand left behind.
    c.beginPath();
    c.moveTo(0, sh);
    for (let x = 0; x <= W; x += 6) c.lineTo(x, Math.max(edge(x), full - 2 + Math.sin(x / W * 9) * 3));
    c.lineTo(W, sh);
    c.closePath();
    c.fillStyle = 'rgba(150,118,80,0.16)';
    c.fill();
    c.beginPath();
    c.moveTo(0, sh - 1);
    for (let x = 0; x <= W; x += 6) c.lineTo(x, edge(x));
    c.lineTo(W, sh - 1);
    c.closePath();
    c.fillStyle = vgrad(c, sh, edgeY + 6, [[0, 'rgba(127,184,184,0.75)'], [0.35, 'rgba(160,212,200,0.4)'], [1, 'rgba(210,236,226,0.22)']]);
    c.fill();
    // Foam: a bright edge with lace behind it.
    c.strokeStyle = 'rgba(255,253,246,0.92)';
    c.lineWidth = 2.4;
    c.beginPath();
    for (let x = 0; x <= W; x += 6) (x ? c.lineTo(x, edge(x)) : c.moveTo(x, edge(x)));
    c.stroke();
    c.fillStyle = 'rgba(255,253,246,0.5)';
    const lr = mulberry32(5);
    for (let i = 0; i < 70; i++) {
      const x = lr() * W, d = lr() * H * 0.05;
      c.beginPath();
      c.ellipse(x, edge(x) - d, 1.5 + lr() * 4, 0.8, 0, 0, Math.PI * 2);
      c.fill();
    }
    // Palms sway gently.
    const sway = Math.sin(t * 0.35) * 0.04 + Math.sin(t * 0.9) * 0.01;
    palm(c, W * 0.05, H * 1.03, H * 0.66, 0.2, sway, 3);
    palm(c, W * 0.97, H * 1.02, H * 0.42, -0.16, sway * 0.8, 4);
    img(c, L.front, W, H);
  },
};

// --- Evening sea: a little boat rides the swell ----------------------------

function boat(c: Ctx, x: number, y: number, s: number, ang: number) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  // Hull.
  c.fillStyle = '#3d2b2c';
  c.beginPath();
  c.moveTo(-s * 0.55, -s * 0.12);
  c.lineTo(s * 0.6, -s * 0.12);
  c.quadraticCurveTo(s * 0.45, s * 0.14, s * 0.3, s * 0.16);
  c.lineTo(-s * 0.38, s * 0.16);
  c.quadraticCurveTo(-s * 0.5, s * 0.1, -s * 0.55, -s * 0.12);
  c.fill();
  c.fillStyle = '#d99a72';
  c.fillRect(-s * 0.55, -s * 0.14, s * 1.15, s * 0.05);
  // Mast and sails, lit from the low sun on the left.
  c.strokeStyle = '#3b2a26';
  c.lineWidth = Math.max(1, s * 0.03);
  c.beginPath();
  c.moveTo(0, -s * 0.12);
  c.lineTo(0, -s * 1.05);
  c.stroke();
  c.fillStyle = '#fbeedd';
  c.beginPath();
  c.moveTo(-s * 0.03, -s * 1.0);
  c.quadraticCurveTo(-s * 0.4, -s * 0.55, -s * 0.48, -s * 0.2);
  c.lineTo(-s * 0.03, -s * 0.2);
  c.closePath();
  c.fill();
  c.fillStyle = '#e2c6b4';
  c.beginPath();
  c.moveTo(s * 0.03, -s * 0.92);
  c.quadraticCurveTo(s * 0.3, -s * 0.5, s * 0.36, -s * 0.22);
  c.lineTo(s * 0.03, -s * 0.22);
  c.closePath();
  c.fill();
  c.fillStyle = '#e07a5f';
  c.beginPath();
  c.moveTo(0, -s * 1.05);
  c.lineTo(s * 0.16, -s * 1.0);
  c.lineTo(0, -s * 0.96);
  c.fill();
  c.restore();
}

const ocean: Painting = {
  build(W, H, dpr) {
    const hz = H * 0.52;
    const back = layer(W, H, dpr, (c) => {
      const r = mulberry32(31);
      sky(c, W, hz, [[0, '#2f3653'], [0.42, '#665879'], [0.76, '#d68e7b'], [1, '#f3c08c']], '#ffd9b8', r);
      soft(c, W * 0.32, hz, W * 0.6, '#f7c48e', 0.55);
      c.save();
      c.beginPath();
      c.rect(0, 0, W, hz);
      c.clip();
      c.fillStyle = '#ffe2b0';
      c.beginPath();
      c.arc(W * 0.32, hz + 2, Math.min(W, H) * 0.075, 0, Math.PI * 2);
      c.fill();
      c.restore();
      c.fillStyle = vgrad(c, hz, H, [[0, '#c98f80'], [0.25, '#7a6580'], [1, '#2c2c45']]);
      c.fillRect(0, hz, W, H - hz);
      for (let i = 0; i < 40; i++) {
        const d = r();
        const y = hz + 2 + Math.pow(d, 1.5) * (H - hz) * 0.5;
        c.strokeStyle = rgba('#f6c7a0', 0.12 + (1 - d) * 0.2);
        c.lineWidth = 1;
        const x = r() * W, len = W * (0.03 + r() * 0.1);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + len, y);
        c.stroke();
      }
    });
    const cl = layer(W, H, dpr, (c) => {
      const r = mulberry32(41);
      for (const [x, y, w, h] of [[0.18, 0.2, 0.5, 0.035], [0.62, 0.13, 0.6, 0.03], [0.82, 0.33, 0.4, 0.025], [0.4, 0.36, 0.3, 0.02]]) {
        for (const dx of [-W, 0, W]) streak(c, x * W + dx, y * H, w * W, h * H, '#5d4c6c', '#f4ad8c', r);
      }
    });
    const front = layer(W, H, dpr, (c) => {
      const r = mulberry32(32);
      // Cliff with a lighthouse on the right.
      const top = H * 0.4;
      c.fillStyle = '#2a2131';
      c.beginPath();
      c.moveTo(W * 0.66, H);
      c.quadraticCurveTo(W * 0.7, H * 0.7, W * 0.76, H * 0.55);
      c.quadraticCurveTo(W * 0.79, top + H * 0.02, W * 0.84, top);
      c.lineTo(W + 2, top - H * 0.01);
      c.lineTo(W + 2, H);
      c.closePath();
      c.fill();
      // Soft lit planes on the sunward face instead of hatching.
      c.save();
      c.clip();
      for (const [x0, y0, x1, y1, a] of [[0.72, 0.58, 0.8, 0.46, 0.22], [0.69, 0.8, 0.76, 0.62, 0.16], [0.82, 0.44, 0.87, 0.41, 0.25]]) {
        c.fillStyle = `rgba(214,142,112,${a})`;
        c.beginPath();
        c.moveTo(W * x0, H * y0);
        c.lineTo(W * x1, H * y1);
        c.lineTo(W * (x1 + 0.04), H * (y1 + 0.03));
        c.lineTo(W * (x0 + 0.05), H * (y0 + 0.08));
        c.closePath();
        c.fill();
      }
      c.restore();
      grass(c, W * 0.8, W, top + 2, H * 0.03, ['#2f3a30', '#55604a'], r, 1.6);
      // Lighthouse.
      const lx = W * 0.92, lb = top - H * 0.005, lh = H * 0.2, lw = Math.max(8, W * 0.035);
      c.fillStyle = '#efe2d2';
      c.beginPath();
      c.moveTo(lx - lw / 2, lb);
      c.lineTo(lx - lw * 0.35, lb - lh);
      c.lineTo(lx + lw * 0.35, lb - lh);
      c.lineTo(lx + lw / 2, lb);
      c.closePath();
      c.fill();
      c.fillStyle = '#b5544a';
      for (const k of [0.25, 0.6]) c.fillRect(lx - lw * (0.5 - k * 0.15), lb - lh * (k + 0.12), lw * (1 - k * 0.3), lh * 0.12);
      c.fillStyle = 'rgba(40,30,40,0.35)';
      c.fillRect(lx, lb - lh, lw * 0.4, lh);
      soft(c, lx, lb - lh - lw * 0.4, lw * 3, '#ffd892', 0.45);
      c.fillStyle = '#ffe2a6';
      c.fillRect(lx - lw * 0.3, lb - lh - lw * 0.65, lw * 0.6, lw * 0.5);
      c.fillStyle = '#2a2131';
      c.beginPath();
      c.moveTo(lx - lw * 0.45, lb - lh - lw * 0.62);
      c.lineTo(lx, lb - lh - lw * 1.05);
      c.lineTo(lx + lw * 0.45, lb - lh - lw * 0.62);
      c.fill();
      finish(c, W, H);
    });
    return { back, cl, front };
  },
  frame(c, L, W, H, f, b) {
    const t = f.t, hz = H * 0.52;
    img(c, L.back, W, H);
    drift(c, L.cl, W, H, t, 0.8);
    birds(c, W, H * 0.22, t, 'rgba(40,30,50,0.6)', 2, 7);
    for (let i = 0; i < 9; i++) {
      const y = hz + 3 + i * H * 0.022;
      const w = W * (0.04 + i * 0.012) * (0.7 + 0.3 * Math.sin(t * 0.8 + i * 1.3));
      c.fillStyle = rgba('#ffd6a8', 0.45 - i * 0.04);
      c.fillRect(W * 0.32 - w / 2 + Math.sin(t * 0.4 + i) * 3, y, w, 1.5);
    }
    // A distant swell line, then the near swell that carries the boat.
    const far = (x: number) => H * 0.66 + Math.sin(x / W * 9 + t * 0.3) * H * 0.006;
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) c.lineTo(x, far(x));
    c.lineTo(W, H);
    c.closePath();
    c.fillStyle = 'rgba(70,62,92,0.55)';
    c.fill();
    const base = H * (0.8 - 0.25 * b);
    const swell = (x: number) => base + Math.sin(x / W * 5 + t * 0.45) * H * 0.018 + Math.sin(x / W * 11 - t * 0.3) * H * 0.006;
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += 5) c.lineTo(x, swell(x));
    c.lineTo(W, H);
    c.closePath();
    c.fillStyle = vgrad(c, base - H * 0.03, H, [[0, '#7a6488'], [0.12, '#56496e'], [1, '#232239']]);
    c.fill();
    // Light catching the crest, and a little foam under the boat.
    c.beginPath();
    for (let x = 0; x <= W; x += 5) (x ? c.lineTo(x, swell(x) + 1.5) : c.moveTo(x, swell(x) + 1.5));
    c.strokeStyle = 'rgba(246,196,160,0.28)';
    c.lineWidth = 4;
    c.stroke();
    const bx = W * 0.42;
    const slope = (swell(bx + 4) - swell(bx - 4)) / 8;
    soft(c, bx, swell(bx) + 2, Math.min(W, H) * 0.09, '#fbe8d8', 0.35);
    boat(c, bx, swell(bx) - 2, Math.min(W, H) * 0.14, Math.atan(slope) * 0.9);
    img(c, L.front, W, H);
  },
};

// --- Mountain lake: a hot-air balloon lifts and settles --------------------

function balloon(c: Ctx, x: number, y: number, s: number, flame: number) {
  const R = s * 0.5;
  const env = () => {
    c.beginPath();
    c.moveTo(x - R * 0.28, y + R * 1.05);
    c.bezierCurveTo(x - R * 1.15, y + R * 0.35, x - R * 1.05, y - R * 1.05, x, y - R * 1.05);
    c.bezierCurveTo(x + R * 1.05, y - R * 1.05, x + R * 1.15, y + R * 0.35, x + R * 0.28, y + R * 1.05);
    c.closePath();
  };
  c.save();
  env();
  c.clip();
  const cols = ['#d9734e', '#f0c27b', '#7fae9c', '#f7ecd8', '#d9734e', '#f0c27b', '#7fae9c'];
  for (let i = 0; i < cols.length; i++) {
    c.fillStyle = cols[i];
    c.beginPath();
    c.ellipse(x, y, R * (1.1 - i * 0.16), R * 1.2, 0, 0, Math.PI * 2);
    c.fill();
  }
  // Light from the upper left, shade on the right.
  soft(c, x - R * 0.45, y - R * 0.45, R * 0.9, '#fff6e6', 0.45);
  const g = c.createLinearGradient(x - R, 0, x + R, 0);
  g.addColorStop(0.45, 'rgba(40,30,40,0)');
  g.addColorStop(1, 'rgba(40,30,40,0.35)');
  c.fillStyle = g;
  c.fillRect(x - R * 1.2, y - R * 1.2, R * 2.4, R * 2.4);
  c.restore();
  // Burner glow on the in-breath.
  if (flame > 0) soft(c, x, y + R * 1.1, R * 0.5, '#ffb35a', 0.7 * flame);
  c.strokeStyle = '#5a4535';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(x - R * 0.26, y + R * 1.05);
  c.lineTo(x - R * 0.16, y + R * 1.4);
  c.moveTo(x + R * 0.26, y + R * 1.05);
  c.lineTo(x + R * 0.16, y + R * 1.4);
  c.stroke();
  c.fillStyle = '#8a5a3a';
  c.fillRect(x - R * 0.18, y + R * 1.38, R * 0.36, R * 0.28);
  c.fillStyle = '#b07a52';
  c.fillRect(x - R * 0.18, y + R * 1.38, R * 0.36, R * 0.06);
}

const lake: Painting = {
  build(W, H, dpr) {
    const wl = H * 0.6;
    const skyL = layer(W, H, dpr, (c) => {
      const r = mulberry32(51);
      sky(c, W, wl, [[0, '#86aecb'], [0.55, '#c9dade'], [1, '#f2e8d0']], '#ffffff', r);
      soft(c, W * 0.18, H * 0.16, W * 0.45, '#fff2d4', 0.5);
    });
    const cl = clouds(W, H, dpr, [[0.25, 0.12, 0.3, 0.06], [0.7, 0.08, 0.26, 0.05]], '#c4d2dc', '#fffaf0', 0.18, 52);
    const land = layer(W, H, dpr, (c) => {
      const r = mulberry32(53);
      const haze = '#e6e4d6';
      mountain(c, W * 0.85, H * 0.2, wl, W * 0.6, { base: '#8a9bb2', snow: '#eef2f4', lit: '#b6c3d2', haze }, true, r);
      mountain(c, W * 0.42, H * 0.08, wl, W * 0.95, { base: '#56677f', snow: '#f8f4ea', lit: '#a5b2c3', haze }, true, r, 0.5);
      hills(c, W, H, wl - H * 0.035, H * 0.03, 2, 1, '#93a59a', null, r);
      treeLine(c, W, wl - H * 0.02, H * 0.05, '#6c857c', r, 3);
      treeLine(c, W, wl + 1, H * 0.05, '#3c574c', r, 3.5);
      for (const [x, h] of [[0.04, 0.2], [0.12, 0.15], [0.19, 0.11], [0.84, 0.13], [0.92, 0.18], [0.99, 0.22]]) pine(c, W * x, wl + 2, H * h, '#243a31', '#78a070', r);
      const [chx, chy] = cabin(c, W * 0.64, wl + 1, W * 0.06, { wall: '#7a5236', side: '#5a3b28', roof: '#4a3a34', roofLit: '#9a8676', glow: '#ffd27a' });
      chimney.lake = [chx / W, chy / H];
    });
    const above = composite(W, H, dpr, [skyL, cl, land]);
    const water = layer(W, H, dpr, (c) => stillWater(c, above, W, H, wl, '#46707a', '#f1f4e8', mulberry32(54)));
    const front = layer(W, H, dpr, (c) => {
      const r = mulberry32(55);
      // A grassy bank with bushes at the bottom left, a big pine on each side.
      c.fillStyle = '#3d5a3a';
      c.beginPath();
      c.moveTo(0, H);
      c.lineTo(0, H * 0.86);
      c.quadraticCurveTo(W * 0.2, H * 0.84, W * 0.42, H * 0.95);
      c.lineTo(W * 0.46, H);
      c.closePath();
      c.fill();
      grass(c, 0, W * 0.42, H * 0.87, H * 0.04, ['#4f7348', '#89ad6e'], r, 1.8);
      bush(c, W * 0.12, H * 0.88, W * 0.16, H * 0.07, ['#2c4a30', '#507a4a', '#9cbf7a'], r);
      bush(c, W * 0.3, H * 0.92, W * 0.12, H * 0.05, ['#2c4a30', '#507a4a', '#9cbf7a'], r);
      pine(c, W * 0.03, H * 1.02, H * 0.62, '#1c2f26', '#5f8a5a', r);
      pine(c, W * 0.97, H * 1.02, H * 0.55, '#1c2f26', '#5f8a5a', r);
      finish(c, W, H);
    });
    return { skyL, cl, land, water, front };
  },
  frame(c, L, W, H, f, b) {
    const t = f.t, wl = H * 0.6;
    img(c, L.skyL, W, H);
    drift(c, L.cl, W, H, t, 1);
    birds(c, W, H * 0.3, t, 'rgba(60,70,80,0.5)', 2, 11, 0.8);
    img(c, L.land, W, H);
    img(c, L.water, W, H);
    const [cx, cy] = chimney.lake;
    smoke(c, cx * W, cy * H, W * 0.06, t, '#eef0ea');
    const s = Math.min(W, H) * 0.13;
    const bx = W * (0.5 + 0.07 * Math.sin(t * 0.012));
    const by = H * (0.52 - 0.34 * b);
    const flame = f.inhale && f.breathing ? 0.8 + 0.2 * Math.sin(t * 9) : 0;
    // Reflection in the lake.
    c.save();
    c.beginPath();
    c.rect(0, wl, W, H - wl);
    c.clip();
    c.globalAlpha = 0.2;
    c.translate(0, wl * 2);
    c.scale(1, -1);
    balloon(c, bx, by, s, 0);
    c.restore();
    balloon(c, bx, by, s, flame);
    img(c, L.front, W, H);
  },
};

const chimney: Record<string, [number, number]> = { lake: [0.7, 0.5], forest: [0.6, 0.7] };

// --- Misty forest: the mist rises and settles ------------------------------

const forest: Painting = {
  build(W, H, dpr) {
    const back = layer(W, H, dpr, (c) => {
      const r = mulberry32(61);
      sky(c, W, H * 0.7, [[0, '#b9cdb8'], [0.6, '#e5e0c2'], [1, '#efe4c4']], '#fffbe8', r);
      soft(c, W * 0.62, H * 0.18, W * 0.5, '#fff4d2', 0.65);
      // Soft rays of light falling through the trees.
      c.save();
      c.globalAlpha = 0.07;
      c.fillStyle = '#fff6d8';
      for (let i = 0; i < 5; i++) {
        const x0 = W * (0.5 + i * 0.05);
        c.beginPath();
        c.moveTo(x0, H * 0.15);
        c.lineTo(x0 - W * (0.25 + i * 0.06), H);
        c.lineTo(x0 - W * (0.15 + i * 0.06), H);
        c.closePath();
        c.fill();
      }
      c.restore();
      treeLine(c, W, H * 0.52, H * 0.14, '#b2c0a6', r, 4);
      c.fillStyle = 'rgba(236,234,214,0.6)';
      c.fillRect(0, H * 0.5, W, H * 0.05);
      treeLine(c, W, H * 0.6, H * 0.2, '#8ca08b', r, 5);
      c.fillStyle = '#8ca08b';
      c.fillRect(0, H * 0.6, W, H * 0.4);
      for (let x = -10; x < W + 10; x += W * (0.05 + r() * 0.05)) pine(c, x, H * 0.74, H * (0.22 + r() * 0.12), '#5a7564', '#9cb28c', r);
      c.fillStyle = '#5a7564';
      c.fillRect(0, H * 0.735, W, H * 0.3);
    });
    const front = layer(W, H, dpr, (c) => {
      const r = mulberry32(62);
      // A winding path to the cabin.
      c.fillStyle = vgrad(c, H * 0.8, H, [[0, '#c9b38d'], [1, '#a88d66']]);
      c.beginPath();
      c.moveTo(W * 0.53, H * 0.83);
      c.quadraticCurveTo(W * 0.42, H * 0.9, W * 0.5, H * 1.0);
      c.lineTo(W * 0.68, H * 1.0);
      c.quadraticCurveTo(W * 0.56, H * 0.9, W * 0.6, H * 0.83);
      c.closePath();
      c.fill();
      const [chx, chy] = cabin(c, W * 0.5, H * 0.835, W * 0.1, { wall: '#7d5537', side: '#5b3c29', roof: '#4b3b33', roofLit: '#8b7a68', glow: '#ffcf73' });
      chimney.forest = [chx / W, chy / H];
      c.fillStyle = '#3f5a40';
      c.beginPath();
      c.moveTo(0, H);
      c.lineTo(0, H * 0.84);
      c.quadraticCurveTo(W * 0.25, H * 0.82, W * 0.47, H * 0.86);
      c.lineTo(W * 0.5, H);
      c.closePath();
      c.moveTo(W, H);
      c.lineTo(W, H * 0.83);
      c.quadraticCurveTo(W * 0.8, H * 0.82, W * 0.66, H * 0.87);
      c.lineTo(W * 0.66, H);
      c.closePath();
      c.fill();
      grass(c, 0, W * 0.47, H * 0.86, H * 0.04, ['#4f7348', '#89ad6e'], r, 1.8);
      grass(c, W * 0.66, W, H * 0.86, H * 0.04, ['#4f7348', '#89ad6e'], r, 1.8);
      const tones: [string, string, string] = ['#2c4a30', '#4f7a4a', '#a3c27e'];
      bush(c, W * 0.36, H * 0.9, W * 0.14, H * 0.07, tones, r, false);
      bush(c, W * 0.78, H * 0.92, W * 0.16, H * 0.08, tones, r, false);
      for (const [x, h] of [[0.05, 0.92], [0.17, 0.7], [0.27, 0.5], [0.84, 0.6], [0.95, 0.88]]) pine(c, W * x, H * 1.02, H * h, '#1d3125', '#6a9563', r, false);
      finish(c, W, H);
    });
    return { back, front };
  },
  frame(c, L, W, H, f, b) {
    const t = f.t;
    img(c, L.back, W, H);
    // A bank of mist climbing the middle trees: in as it rises, out as it settles.
    const bottom = H * (0.86 - 0.36 * b), top = bottom - H * 0.25;
    const edge = (x: number) => top + Math.sin(x / W * 5 + t * 0.15) * H * 0.018 + Math.sin(x / W * 13 - t * 0.1) * H * 0.007;
    c.beginPath();
    c.moveTo(0, bottom + H * 0.06);
    for (let x = 0; x <= W; x += 6) c.lineTo(x, edge(x));
    c.lineTo(W, bottom + H * 0.06);
    c.closePath();
    c.fillStyle = vgrad(c, top - H * 0.02, bottom + H * 0.06, [[0, 'rgba(248,247,236,0)'], [0.18, 'rgba(248,247,236,0.7)'], [0.6, 'rgba(244,243,230,0.6)'], [1, 'rgba(244,243,230,0)']]);
    c.fill();
    for (let i = 0; i < 5; i++) soft(c, ((i * 0.27 + t * 0.004) % 1.2) * W - W * 0.1, top + H * 0.08, W * 0.16, '#f8f7ee', 0.3);
    // Low ground mist always lingers.
    c.fillStyle = vgrad(c, H * 0.78, H * 0.9, [[0, 'rgba(244,243,230,0)'], [1, 'rgba(244,243,230,0.45)']]);
    c.fillRect(0, H * 0.78, W, H * 0.12);
    img(c, L.front, W, H);
    const [cx, cy] = chimney.forest;
    smoke(c, cx * W, cy * H, W * 0.08, t, '#eef0ea');
    // Dust motes drifting in the light.
    const r = mulberry32(9);
    for (let i = 0; i < 14; i++) {
      const x0 = W * (0.3 + r() * 0.5), y0 = H * (0.2 + r() * 0.5), sp = 0.02 + r() * 0.04, p = r() * 6;
      soft(c, x0 + Math.sin(t * sp * 6 + p) * 14, y0 + Math.cos(t * sp * 4 + p) * 10, 2.5, '#fff6d8', 0.35 + 0.25 * Math.sin(t * 0.5 + p));
    }
  },
};

// --- Night: the northern lights grow and fade ------------------------------

function aurora(c: Ctx, W: number, H: number, baseY: number, t: number, b: number, alpha: number) {
  // Three or four ribbons of light (soft bumps along the width) whose foot
  // follows a slow fold. They grow taller and brighter as you breathe in.
  const n = 150;
  const prev = c.globalCompositeOperation;
  c.globalCompositeOperation = 'lighter';
  const cw = (W / n) * 2.4;
  const ribbons = [0.18, 0.42, 0.63, 0.85].map((x0, i) => x0 + 0.04 * Math.sin(t * 0.03 + i * 2));
  for (let i = 0; i < n; i++) {
    const u = i / n;
    let env = 0;
    for (const r of ribbons) env = Math.max(env, Math.exp(-Math.pow((u - r) / 0.07, 2)));
    env = 0.12 + 0.88 * env;
    const fold = Math.sin(u * 9 + t * 0.06) * 0.5 + Math.sin(u * 23 - t * 0.04) * 0.25;
    const x = W * u + fold * W * 0.012;
    const h = H * 0.42 * (0.4 + 0.6 * b) * (0.45 + 0.55 * env);
    const y0 = baseY - H * 0.05 * Math.sin(u * Math.PI * 1.7 + 0.6 + t * 0.03) - fold * H * 0.012;
    const a = alpha * (0.15 + 0.6 * b) * env;
    const g = c.createLinearGradient(0, y0, 0, y0 - h);
    g.addColorStop(0, `rgba(130,245,185,${a})`);
    g.addColorStop(0.15, `rgba(100,230,175,${a * 0.85})`);
    g.addColorStop(0.6, `rgba(80,185,195,${a * 0.4})`);
    g.addColorStop(1, 'rgba(150,110,210,0)');
    c.fillStyle = g;
    c.fillRect(x, y0 - h, cw, h + 2);
  }
  c.globalCompositeOperation = prev;
}

const night: Painting = {
  build(W, H, dpr) {
    const wl = H * 0.66;
    const skyL = layer(W, H, dpr, (c) => {
      const r = mulberry32(71);
      sky(c, W, wl, [[0, '#0b1024'], [0.55, '#18243f'], [1, '#2a3b55']], '#26344f', r);
      c.fillStyle = '#f3ebdf';
      for (let i = 0; i < 150; i++) {
        c.globalAlpha = 0.3 + r() * 0.6;
        c.beginPath();
        c.arc(r() * W, Math.pow(r(), 1.3) * wl * 0.9, 0.4 + r() * 1.1, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      const mx = W * 0.8, my = H * 0.15, mr = Math.min(W, H) * 0.045;
      soft(c, mx, my, mr * 6, '#d9e2f2', 0.3);
      c.fillStyle = '#f2ecd8';
      c.beginPath();
      c.arc(mx, my, mr, 0, Math.PI * 2);
      c.fill();
      for (const [dx, dy, s] of [[-0.3, -0.2, 0.25], [0.25, 0.15, 0.18], [-0.1, 0.4, 0.15]]) soft(c, mx + dx * mr, my + dy * mr, s * mr, '#cfc6ae', 0.6);
    });
    const land = layer(W, H, dpr, (c) => {
      const r = mulberry32(72);
      mountain(c, W * 0.22, H * 0.36, wl, W * 0.7, { base: '#1a2233', snow: '#5d6a84', lit: '#2c364b', haze: '#1f2b40' }, false, r, 0.4);
      mountain(c, W * 0.72, H * 0.3, wl, W * 0.8, { base: '#161d2c', snow: '#66738e', lit: '#2a3449', haze: '#1f2b40' }, false, r, 0.45);
      treeLine(c, W, wl + 1, H * 0.05, '#0d1420', r, 3);
    });
    const above = composite(W, H, dpr, [skyL, land]);
    const water = layer(W, H, dpr, (c) => stillWater(c, above, W, H, wl, '#101a2c', '#55657e', mulberry32(73), 0.6));
    const front = layer(W, H, dpr, (c) => {
      const r = mulberry32(74);
      c.fillStyle = '#121a24';
      c.beginPath();
      c.moveTo(0, H);
      c.lineTo(0, H * 0.84);
      c.quadraticCurveTo(W * 0.3, H * 0.8, W * 0.55, H * 0.92);
      c.lineTo(W * 0.6, H);
      c.closePath();
      c.fill();
      // A tent glowing from inside, and a small fire.
      const tx = W * 0.3, tb = H * 0.86, tw = W * 0.12;
      soft(c, tx, tb - tw * 0.2, tw * 0.9, '#ffb565', 0.22);
      c.fillStyle = '#e8a35c';
      c.beginPath();
      c.moveTo(tx - tw / 2, tb);
      c.lineTo(tx, tb - tw * 0.55);
      c.lineTo(tx + tw / 2, tb);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffd89a';
      c.beginPath();
      c.moveTo(tx - tw * 0.1, tb);
      c.lineTo(tx, tb - tw * 0.32);
      c.lineTo(tx + tw * 0.1, tb);
      c.closePath();
      c.fill();
      for (const [x, h] of [[0.04, 0.5], [0.12, 0.36], [0.88, 0.42], [0.97, 0.56]]) pine(c, W * x, H * 1.02, H * h, '#0a1018', '#25344a', r, false, '#0a1018');
      finish(c, W, H);
    });
    return { skyL, land, water, front };
  },
  frame(c, L, W, H, f, b) {
    const t = f.t, wl = H * 0.66;
    img(c, L.skyL, W, H);
    // A few stars twinkle.
    const r = mulberry32(3);
    c.fillStyle = '#fff8ea';
    for (let i = 0; i < 18; i++) {
      const x = r() * W, y = r() * wl * 0.7, p = r() * 6;
      c.globalAlpha = 0.4 + 0.4 * Math.sin(t * 0.6 + p);
      c.fillRect(x, y, 1.4, 1.4);
    }
    c.globalAlpha = 1;
    aurora(c, W, H, H * 0.52, t, b, 0.55);
    img(c, L.land, W, H);
    img(c, L.water, W, H);
    c.save();
    c.beginPath();
    c.rect(0, wl, W, H - wl);
    c.clip();
    c.translate(0, wl * 2);
    c.scale(1, -1);
    aurora(c, W, H, H * 0.52, t, b, 0.18);
    c.restore();
    img(c, L.front, W, H);
    // The campfire, glowing softly.
    const fx = W * 0.45, fy = H * 0.885;
    soft(c, fx, fy, W * 0.045, '#ff9f4a', 0.3 + 0.04 * Math.sin(t * 1.3));
    c.fillStyle = '#ffcf80';
    c.beginPath();
    c.moveTo(fx - 3, fy + 2);
    c.quadraticCurveTo(fx, fy - 6 - Math.sin(t * 2) * 1.5, fx + 3, fy + 2);
    c.fill();
    c.strokeStyle = '#3a2a20';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(fx - 5, fy + 3);
    c.lineTo(fx + 5, fy + 1);
    c.stroke();
  },
};

// --- Meadow: a kite climbs and dips ----------------------------------------

function kite(c: Ctx, x: number, y: number, s: number, t: number, ax: number, ay: number) {
  // The string, sagging a little.
  c.strokeStyle = 'rgba(60,50,40,0.6)';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(x, y + s * 0.6);
  c.quadraticCurveTo((x + ax) / 2 + s * 0.4, (y + ay) / 2 + s * 1.4, ax, ay);
  c.stroke();
  // Tail with little bows.
  c.strokeStyle = '#7a5a4a';
  c.lineWidth = 1;
  c.beginPath();
  const tail: [number, number][] = [];
  for (let k = 0; k <= 12; k++) {
    const u = k / 12;
    const tx = x - u * s * 0.6 + Math.sin(t * 2 + u * 6) * s * 0.18 * u;
    const ty = y + s * 0.6 + u * s * 1.6;
    tail.push([tx, ty]);
    (k ? c.lineTo(tx, ty) : c.moveTo(tx, ty));
  }
  c.stroke();
  for (const k of [4, 8, 12]) {
    const [bx, by] = tail[k];
    c.fillStyle = k === 8 ? '#f2cc8f' : '#e07a5f';
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(bx - 4, by - 2.5);
    c.lineTo(bx - 4, by + 2.5);
    c.closePath();
    c.moveTo(bx, by);
    c.lineTo(bx + 4, by - 2.5);
    c.lineTo(bx + 4, by + 2.5);
    c.closePath();
    c.fill();
  }
  c.save();
  c.translate(x, y);
  c.rotate(Math.sin(t * 0.7) * 0.08 - 0.12);
  const panels: [string, number[]][] = [
    ['#e8846a', [0, -s, -s * 0.55, -s * 0.15, 0, 0]],
    ['#f5d49a', [0, -s, s * 0.55, -s * 0.15, 0, 0]],
    ['#f5d49a', [-s * 0.55, -s * 0.15, 0, s * 0.6, 0, 0]],
    ['#c9644e', [s * 0.55, -s * 0.15, 0, s * 0.6, 0, 0]],
  ];
  for (const [col, p] of panels) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(p[0], p[1]);
    c.lineTo(p[2], p[3]);
    c.lineTo(p[4], p[5]);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = 'rgba(70,45,35,0.7)';
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(0, -s);
  c.lineTo(0, s * 0.6);
  c.moveTo(-s * 0.55, -s * 0.15);
  c.lineTo(s * 0.55, -s * 0.15);
  c.stroke();
  c.restore();
}

const meadow: Painting = {
  build(W, H, dpr) {
    const skyL = layer(W, H, dpr, (c) => {
      const r = mulberry32(81);
      sky(c, W, H * 0.6, [[0, '#93bfd8'], [0.55, '#f0dcc0'], [1, '#f8cd9f']], '#fff6e6', r);
      soft(c, W * 0.16, H * 0.42, W * 0.55, '#ffe6b0', 0.65);
      c.fillStyle = '#fff3d6';
      c.beginPath();
      c.arc(W * 0.16, H * 0.42, Math.min(W, H) * 0.06, 0, Math.PI * 2);
      c.fill();
    });
    const cl = clouds(W, H, dpr, [[0.42, 0.14, 0.3, 0.06], [0.8, 0.22, 0.26, 0.05], [0.1, 0.1, 0.2, 0.04]], '#e3c9c0', '#fff6ea', 0.16, 82);
    const land = layer(W, H, dpr, (c) => {
      const r = mulberry32(83);
      hills(c, W, H, H * 0.55, H * 0.08, 1.6, 0.4, '#a7b8b0', '#f3e2c0', r);
      const mid = hills(c, W, H, H * 0.66, H * 0.1, 1.2, 2.2, '#8db07a', '#e5e3a6', r);
      // A little farmhouse with a red barn on the middle hill.
      const fx = W * 0.62, fy = mid(W * 0.62) + 2, fs = W * 0.035;
      c.fillStyle = '#a8553f';
      c.fillRect(fx, fy - fs * 0.7, fs * 1.2, fs * 0.7);
      c.fillStyle = '#6e3a2e';
      c.beginPath();
      c.moveTo(fx - fs * 0.1, fy - fs * 0.7);
      c.lineTo(fx + fs * 0.6, fy - fs * 1.15);
      c.lineTo(fx + fs * 1.3, fy - fs * 0.7);
      c.closePath();
      c.fill();
      c.fillStyle = '#f2ead8';
      c.fillRect(fx + fs * 1.4, fy - fs * 0.55, fs * 0.8, fs * 0.55);
      c.fillStyle = '#7a5a48';
      c.beginPath();
      c.moveTo(fx + fs * 1.35, fy - fs * 0.55);
      c.lineTo(fx + fs * 1.8, fy - fs * 0.9);
      c.lineTo(fx + fs * 2.25, fy - fs * 0.55);
      c.closePath();
      c.fill();
      leafyTree(c, fx - fs * 0.8, fy, fs * 2.2, ['#4d7444', '#76a05c', '#c5d98d'], '#5a4030', r);
      for (let i = 0; i < 6; i++) bush(c, W * (0.05 + i * 0.09), mid(W * (0.05 + i * 0.09)) + 3, W * 0.05, H * 0.025, ['#5f8a4f', '#7ea862', '#c3d88c'], r);
      const near = hills(c, W, H, H * 0.8, H * 0.1, 0.9, 4, '#6f9a58', '#d1df92', r);
      // Wildflowers in little clumps.
      for (let k = 0; k < 16; k++) {
        const cx = r() * W, cy = H * (0.8 + r() * 0.18);
        flowers(c, cx - W * 0.04, cx + W * 0.04, cy - H * 0.012, cy + H * 0.012, [['#f4efe2', '#f2cc8f', '#e8a0a0', '#c9b6e4'][k % 4], '#f4efe2'], 9, r);
      }
      leafyTree(c, W * 0.86, near(W * 0.86) + 6, H * 0.46, ['#3e6b3f', '#6a9a55', '#b9d27c'], '#5a4030', r);
      // A fence along the near hill.
      c.strokeStyle = '#7a5d44';
      c.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const x = W * (0.12 + i * 0.07), y = near(x) + H * 0.06 + i * 1.5;
        c.lineWidth = 2.6;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y - H * 0.05);
        c.stroke();
        if (i) {
          const px = W * (0.12 + (i - 1) * 0.07), pyv = near(px) + H * 0.06 + (i - 1) * 1.5;
          c.lineWidth = 1.6;
          c.beginPath();
          c.moveTo(px, pyv - H * 0.035);
          c.lineTo(x, y - H * 0.035);
          c.moveTo(px, pyv - H * 0.015);
          c.lineTo(x, y - H * 0.015);
          c.stroke();
        }
      }
      // A little ginger cat sits by the fence, holding the kite string.
      const kx = W * 0.2, ky = near(W * 0.2) + H * 0.08, ks = Math.min(W, H) * 0.1;
      tinyCat(c, kx, ky, ks);
      fence.meadow = [(kx + ks * 0.42) / W, (ky - ks * 0.62) / H];
      finish(c, W, H);
    });
    return { skyL, cl, land };
  },
  frame(c, L, W, H, f, b) {
    const t = f.t;
    img(c, L.skyL, W, H);
    drift(c, L.cl, W, H, t, 1.4);
    birds(c, W, H * 0.12, t, 'rgba(70,70,80,0.5)', 3, 5, 0.9);
    img(c, L.land, W, H);
    const [ax, ay] = fence.meadow;
    const kx = W * (0.5 + 0.06 * Math.sin(t * 0.07));
    const ky = H * (0.56 - 0.38 * b);
    kite(c, kx, ky, Math.min(W, H) * 0.06, t, ax * W, ay * H);
    // Two butterflies dancing over the flowers.
    for (let i = 0; i < 2; i++) {
      const x = W * (0.3 + i * 0.3) + Math.sin(t * 0.3 + i * 3) * W * 0.12;
      const y = H * (0.86 + i * 0.03) + Math.sin(t * 0.9 + i) * H * 0.03;
      const flap = Math.abs(Math.sin(t * 7 + i));
      c.fillStyle = i ? '#f2cc8f' : '#f4efe2';
      c.beginPath();
      c.ellipse(x - 2.5 * flap, y, 2.5 * flap + 0.5, 2, -0.4, 0, Math.PI * 2);
      c.ellipse(x + 2.5 * flap, y, 2.5 * flap + 0.5, 2, 0.4, 0, Math.PI * 2);
      c.fill();
    }
  },
};

const fence: Record<string, [number, number]> = { meadow: [0.12, 0.85] };

/** A tiny sitting cat, seen from behind and a little to the side, looking up. */
function tinyCat(c: Ctx, x: number, y: number, s: number) {
  c.lineCap = 'round';
  c.strokeStyle = '#c9793d';
  c.lineWidth = s * 0.12;
  c.beginPath();
  c.moveTo(x - s * 0.25, y - s * 0.05);
  c.quadraticCurveTo(x - s * 0.7, y, x - s * 0.62, y - s * 0.4);
  c.stroke();
  c.fillStyle = '#eba667';
  c.beginPath();
  c.ellipse(x, y - s * 0.32, s * 0.32, s * 0.36, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(x + s * 0.08, y - s * 0.78, s * 0.24, 0, Math.PI * 2);
  c.fill();
  for (const dx of [-0.1, 0.24]) {
    c.beginPath();
    c.moveTo(x + s * (dx - 0.1), y - s * 0.9);
    c.lineTo(x + s * (dx - 0.02), y - s * 1.1);
    c.lineTo(x + s * (dx + 0.08), y - s * 0.92);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = '#c9793d';
  c.lineWidth = s * 0.05;
  c.beginPath();
  c.moveTo(x - s * 0.18, y - s * 0.5);
  c.quadraticCurveTo(x - s * 0.1, y - s * 0.42, x - s * 0.16, y - s * 0.32);
  c.moveTo(x - s * 0.08, y - s * 0.56);
  c.quadraticCurveTo(x, y - s * 0.48, x - s * 0.06, y - s * 0.38);
  c.stroke();
  // A raised paw holding the string.
  c.strokeStyle = '#eba667';
  c.lineWidth = s * 0.11;
  c.beginPath();
  c.moveTo(x + s * 0.2, y - s * 0.35);
  c.lineTo(x + s * 0.42, y - s * 0.62);
  c.stroke();
}

// --- Drawing ----------------------------------------------------------------

const PAINTINGS: Record<SceneId, Painting> = { beach, ocean, lake, forest, night, meadow };
const cache = new Map<string, Layers>();

function layersFor(id: SceneId, W: number, H: number, dpr: number): Layers {
  const key = `${id}|${Math.round(W)}x${Math.round(H)}@${dpr}`;
  let L = cache.get(key);
  if (L) {
    cache.delete(key);
    cache.set(key, L);
    return L;
  }
  L = PAINTINGS[id].build(W, H, dpr);
  cache.set(key, L);
  if (cache.size > 16) cache.delete(cache.keys().next().value as string);
  return L;
}

export function drawScene(c: Ctx, id: SceneId, W: number, H: number, f: SceneFrame): void {
  if (W < 2 || H < 2) return;
  const dpr = c.getTransform().a || 1;
  const L = layersFor(id, W, H, dpr);
  const b = f.breathing ? f.breath : 0.5;
  PAINTINGS[id].frame(c, L, W, H, { ...f, t: f.still ? 0 : f.t }, b);
}
