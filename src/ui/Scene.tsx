import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import * as engine from '../audio/engine';
import { breathAt, type BreathPattern } from '../audio/dsp/breath';
import { drawScene, type SceneId } from './scenes';

/** Animated scene; the breath moves one element of it (tide, mist, sun…). */
export function SceneView({ scene, playing, breathing, pattern, hint, children }: {
  scene: SceneId;
  playing: boolean;
  breathing: boolean;
  pattern: BreathPattern;
  hint?: string | null;
  children?: ComponentChildren;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvas.current;
    const c = cv?.getContext('2d');
    if (!cv || !c) return;
    const still = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = (now - t0) / 1000;
      const bt = playing ? engine.sessionTime() : t;
      const st = breathAt(pattern, bt);
      drawScene(c, scene, W, H, { t, breath: st.level, inhale: st.phase === 'in' || st.phase === 'topup', breathing, still });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [scene, playing, breathing, pattern]);
  return (
    <div class="instrument">
      <canvas ref={canvas} class="instrument-canvas scene" role="img" aria-label="Animated scene" />
      {hint && <div class="canvas-hint on-scene" style={{ opacity: playing ? 0 : 1 }} dangerouslySetInnerHTML={{ __html: hint }} />}
      {children}
    </div>
  );
}

/** A still frame of a scene, for tiles and pickers. */
export function SceneThumb({ scene, class: cls }: { scene: SceneId; class?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvas.current;
    const c = cv?.getContext('2d');
    if (!cv || !c) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth || 160, H = cv.clientHeight || 120;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(c, scene, W, H, { t: 2, breath: 0.55, breathing: true, still: true });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [scene]);
  return <canvas ref={canvas} class={cls ?? 'scene-thumb'} aria-hidden="true" />;
}
