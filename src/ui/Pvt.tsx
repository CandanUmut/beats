// A 2-minute PVT-style reaction-time test. The target appears with a short
// fade (no flashing) at random 2-10 s intervals; tap anywhere as fast as you
// can. Lapses are reactions slower than 500 ms.

import { useEffect, useRef, useState } from 'preact/hooks';
import { median, mean } from '../lab/stats';
import type { PvtResult } from '../lab/model';

export function summarizePvt(rts: number[], falseStarts: number): PvtResult {
  const valid = rts.filter((r) => r >= 100);
  return {
    medianMs: valid.length ? median(valid) : NaN,
    meanMs: valid.length ? mean(valid) : NaN,
    lapses: valid.filter((r) => r > 500).length,
    falseStarts: falseStarts + rts.filter((r) => r < 100).length,
    n: valid.length,
  };
}

export function Pvt({ seconds = 120, onDone }: { seconds?: number; onDone: (r: PvtResult) => void }) {
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [showing, setShowing] = useState(false);
  const [last, setLast] = useState<number | null>(null);
  const [left, setLeft] = useState(seconds);
  const onsetRef = useRef<number | null>(null);
  const rts = useRef<number[]>([]);
  const falseStarts = useRef(0);
  const timer = useRef<number>(0);
  const endAt = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  function schedule() {
    const isi = 2000 + Math.random() * 8000;
    timer.current = window.setTimeout(() => {
      if (performance.now() > endAt.current) return finish();
      setShowing(true);
      // Onset = the frame on which the target is painted.
      requestAnimationFrame((ts) => { onsetRef.current = ts; });
    }, isi);
  }

  function start() {
    rts.current = [];
    falseStarts.current = 0;
    endAt.current = performance.now() + seconds * 1000;
    setPhase('run');
    schedule();
    const tick = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((endAt.current - performance.now()) / 1000));
      setLeft(l);
      if (l <= 0) clearInterval(tick);
    }, 500);
  }

  function finish() {
    clearTimeout(timer.current);
    setShowing(false);
    setPhase('done');
    onDone(summarizePvt(rts.current, falseStarts.current));
  }

  function tap(e: PointerEvent) {
    if (phase !== 'run') return;
    if (!showing || onsetRef.current === null) {
      falseStarts.current++;
      setLast(-1);
      return;
    }
    const rt = e.timeStamp - onsetRef.current;
    rts.current.push(rt);
    setLast(Math.round(rt));
    setShowing(false);
    onsetRef.current = null;
    if (performance.now() > endAt.current) finish();
    else schedule();
  }

  if (phase === 'intro') {
    return (
      <div class="card center">
        <h3 style="margin-top:0">Reaction-time test (2 min)</h3>
        <p class="small muted">A circle will appear every few seconds. Tap the box as soon as you see it. Don't tap early.</p>
        <button class="btn primary block" onClick={start}>Start test</button>
      </div>
    );
  }
  if (phase === 'done') {
    const r = summarizePvt(rts.current, falseStarts.current);
    return (
      <div class="card center">
        <p style="margin:0">Median reaction time: <b>{Number.isFinite(r.medianMs) ? `${r.medianMs.toFixed(0)} ms` : '–'}</b> · lapses {r.lapses} · early taps {r.falseStarts}</p>
      </div>
    );
  }
  return (
    <div
      class="card center"
      style="height:300px;display:grid;place-items:center;touch-action:manipulation;user-select:none;cursor:pointer"
      onPointerDown={tap as unknown as (e: Event) => void}
    >
      <div
        style={{
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'var(--accent)',
          opacity: showing ? 1 : 0,
          transition: showing ? 'opacity 60ms linear' : 'opacity 200ms ease',
        }}
      />
      <div class="small muted">
        {last === -1 ? 'Too early. Wait for the circle.' : last ? `${last} ms` : 'Wait for the circle…'} · {left}s left
      </div>
    </div>
  );
}
