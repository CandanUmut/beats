// The app icon: a calm sunset beach with palms, painted with the scene kit.
import { mulberry32 } from '../src/audio/dsp/random';
import { soft, sky, vgrad, rgba, streak } from '../src/ui/paint';
import { palm } from '../src/ui/scenes';

export function drawIcon(c: CanvasRenderingContext2D, S: number): void {
  const r = mulberry32(7);
  const hz = S * 0.6;
  sky(c, S, hz, [[0, '#46507a'], [0.35, '#9a7b98'], [0.7, '#f0a983'], [1, '#fbd59c']], '#ffe6c8', r);
  for (const [x, y, w, h] of [[0.3, 0.2, 0.5, 0.035], [0.75, 0.3, 0.4, 0.028], [0.55, 0.42, 0.3, 0.02]]) streak(c, x * S, y * S, w * S, h * S, '#8a6a88', '#ffc49a', r);
  // The low sun, half in the sea.
  soft(c, S * 0.62, hz, S * 0.55, '#ffd9a0', 0.6);
  c.save();
  c.beginPath();
  c.rect(0, 0, S, hz);
  c.clip();
  c.fillStyle = '#fff1d2';
  c.beginPath();
  c.arc(S * 0.62, hz + S * 0.01, S * 0.11, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // Calm sea with the sun's path.
  c.fillStyle = vgrad(c, hz, S * 0.8, [[0, '#d99a86'], [0.5, '#8a7894'], [1, '#5a5a80']]);
  c.fillRect(0, hz, S, S * 0.2);
  for (let i = 0; i < 9; i++) {
    const y = hz + S * 0.012 + i * S * 0.02;
    const w = S * (0.2 - i * 0.012);
    c.fillStyle = rgba('#ffe2b8', 0.75 - i * 0.07);
    c.fillRect(S * 0.62 - w / 2 + (i % 2 ? 4 : -4) * S / 512, y, w, S * 0.006);
  }
  // A soft line of foam, then warm sand.
  c.fillStyle = vgrad(c, S * 0.78, S, [[0, '#e9c7a0'], [1, '#c99a70']]);
  c.beginPath();
  c.moveTo(0, S);
  c.lineTo(0, S * 0.8);
  c.quadraticCurveTo(S * 0.5, S * 0.76, S, S * 0.81);
  c.lineTo(S, S);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(255,248,236,0.85)';
  c.lineWidth = S * 0.008;
  c.beginPath();
  c.moveTo(0, S * 0.8);
  c.quadraticCurveTo(S * 0.5, S * 0.76, S, S * 0.81);
  c.stroke();
  // Two palms leaning in from the left.
  palm(c, S * 0.1, S * 1.04, S * 0.8, 0.22, 0.02, 3);
  palm(c, S * 0.95, S * 1.03, S * 0.44, -0.16, -0.01, 4);
}
