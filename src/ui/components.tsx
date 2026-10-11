import type { ComponentChildren, JSX } from 'preact';
import { signal } from '@preact/signals';
import { EVIDENCE_BY_ID, gradeLevel, type Grade } from '../data/evidence';
import { go, back } from './router';
import { regionById, DIRECTORY } from '../data/helplines';
import { settings } from '../data/settings';
import { CRISIS } from '../data/safety';

// --- Icons (simple strokes, no fills that could flash) ---------------------

const paths: Record<string, JSX.Element> = {
  back: <path d="M15 5l-7 7 7 7" />,
  chev: <path d="M9 5l7 7-7 7" />,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />,
  wave: <path d="M3 12c2.5-5 4.5-5 7 0s4.5 5 7 0 3-3 4-2" />,
  leaf: <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></>,
  drop: <path d="M12 3.5c3.5 4.5 6 7.6 6 10.5a6 6 0 0 1-12 0c0-2.9 2.5-6 6-10.5z" />,
  lungs: <path d="M12 4v8m0 0c-1.5 1-3 1-3-2V8c0-1-1-2-2.5-1S3 11 3 15s1.5 5 4 5 5-2 5-5m0-3c1.5 1 3 1 3-2V8c0-1 1-2 2.5-1S21 11 21 15s-1.5 5-4 5-5-2-5-5" />,
  flask: <path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 15h9" />,
  book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  walk: <><circle cx="13" cy="4.5" r="1.8" /><path d="M10 21l2-6 3 3v3M9 12l2-4.5 3.5 1L17 12M11 8l-2.5 1.5L7 13" /></>,
  download: <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  phone: <path d="M6.6 3.5l2.6.4 1.3 3.6-1.9 1.5a11 11 0 0 0 6.4 6.4l1.5-1.9 3.6 1.3.4 2.6c0 1-1 2.1-2.2 2.1C10.4 19.5 4.5 13.6 4.5 5.7c0-1.2 1-2.2 2.1-2.2z" />,
  sliders: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4" />,
  upload: <path d="M12 20V9m0 0l-4.5 4.5M12 9l4.5 4.5M5 4.5h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
};

export function Icon({ name, size }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width={size} height={size} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export const GOAL_ICON: Record<string, string> = { calm: 'wave', urge: 'drop', relax: 'leaf', sleep: 'moon', focus: 'target', breathe: 'lungs' };

// --- Layout ------------------------------------------------------------------

export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ComponentChildren }) {
  return (
    <header class="topbar">
      <button class="icon-btn" aria-label="Back" onClick={onBack ?? (() => back())}>
        <Icon name="back" />
      </button>
      <div class="title">{title}</div>
      {right ?? <HelpButton />}
    </header>
  );
}

export const helpOpen = signal(false);

export function HelpButton() {
  return (
    <button class="help-pill" onClick={() => (helpOpen.value = true)}>
      <Icon name="heart" size={16} /> Talk to someone
    </button>
  );
}

export function HelpSheet() {
  if (!helpOpen.value) return null;
  const region = regionById(settings.value.region);
  return (
    <Sheet onClose={() => (helpOpen.value = false)}>
      <h2 style="margin-top:4px">Talk to someone</h2>
      <p class="muted small">Reaching out is a strong move, not a weak one. These are free.</p>
      {region.lines.map((l) => (
        <a class="card tight row-link" style="display:flex;border:1px solid var(--line)" href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
          <div>
            <div style="font-weight:600">{l.name}</div>
            <div class="muted small">{l.detail}</div>
          </div>
          <span class="btn small primary accent-calm" style="flex:none">{l.action}</span>
        </a>
      ))}
      {region.id !== 'INTL' && (
        <a class="row-link" href={DIRECTORY.href} target="_blank" rel="noreferrer">
          <span>Outside the US? <span class="muted">Find a line in your country</span></span>
          <Icon name="chev" />
        </a>
      )}
      <div class="note danger-note">{CRISIS} Emergency: {region.emergency}.</div>
      <p class="tiny faint">Change your region in Settings. Lines are listed in <code>src/data/helplines.ts</code>.</p>
      <button class="btn block" onClick={() => (helpOpen.value = false)}>Close</button>
    </Sheet>
  );
}

export function Sheet({ children, onClose }: { children: ComponentChildren; onClose: () => void }) {
  return (
    <>
      <div class="sheet-backdrop" onClick={onClose} />
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-grip" />
        {children}
      </div>
    </>
  );
}

// --- Evidence badges ---------------------------------------------------------

export function Badge({ label, evidence, onDark }: { label: string; evidence: string; onDark?: boolean }) {
  const e = EVIDENCE_BY_ID[evidence];
  if (!e) return null;
  return (
    <button
      class={`badge ${gradeLevel(e.grade)}`}
      onClick={(ev) => {
        ev.stopPropagation();
        go(`/evidence/${e.id}`);
      }}
      aria-label={`${label}: ${e.grade}. Why?`}
      style={onDark ? '' : undefined}
    >
      <span class="dot" />
      {label}: <span class="g">{e.grade}</span>
    </button>
  );
}

export function GradeChip({ grade }: { grade: Grade }) {
  return (
    <span class={`grade-chip ${gradeLevel(grade)}`}>
      <span class="dot" />
      {grade}
    </span>
  );
}

// --- Inputs --------------------------------------------------------------------

export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div class="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button role="radio" aria-checked={o.v === value} class={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step, onInput, format }: { label: string; value: number; min: number; max: number; step: number; onInput: (v: number) => void; format?: (v: number) => string }) {
  return (
    <div class="field">
      <div class="field-head">
        <span>{label}</span>
        <span class="v">{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))} />
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: ComponentChildren; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label class="toggle">
      <span>
        {label}
        {hint && <div class="muted tiny">{hint}</div>}
      </span>
      <span class="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
        <span />
      </span>
    </label>
  );
}

export function Rating({ value, onChange, low, high, label }: { value: number | null; onChange: (v: number) => void; low: string; high: string; label: string }) {
  return (
    <div class="field" role="radiogroup" aria-label={label}>
      <div class="rating">
        {Array.from({ length: 11 }, (_, i) => (
          <button role="radio" aria-checked={value === i} class={value === i ? 'on' : ''} onClick={() => onChange(i)}>
            {i}
          </button>
        ))}
      </div>
      <div class="rating-ends">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export function Steps({ n, at }: { n: number; at: number }) {
  return (
    <div class="steps" aria-label={`Step ${at + 1} of ${n}`}>
      {Array.from({ length: n }, (_, i) => <i class={i <= at ? 'on' : ''} />)}
    </div>
  );
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
