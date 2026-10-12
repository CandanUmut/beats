import { useEffect, useState } from 'preact/hooks';
import { MOODS, MOOD_BY_ID } from '../../data/moods';
import { settings, isCustom, recipeFor } from '../../data/settings';
import { HelpButton, Icon, MoodGlyph, helpOpen } from '../components';
import { go } from '../router';
import { allSessions, nudges, type Nudge } from '../../data/usage';
import { shortTitle } from '../Player';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  if (h < 22) return 'Good evening.';
  return 'Getting late.';
}

export function Home() {
  const [nudge, setNudge] = useState<Nudge[]>([]);
  useEffect(() => {
    allSessions().then((s) => setNudge(nudges(s)));
  }, []);
  const last = settings.value.lastMood ? MOOD_BY_ID[settings.value.lastMood] : null;
  return (
    <>
      <header class="topbar">
        <div class="brand">
          <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="7" fill="currentColor" /><circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" stroke-opacity=".4" /></svg>
          Steady
        </div>
        <HelpButton />
      </header>

      <h1>{greeting()}<br /><em>How do you want to feel?</em></h1>

      {nudge.map((n) => (
        <div class="note accent-clay">
          {n.text}{' '}
          <button class="link-btn" onClick={() => (helpOpen.value = true)}>See support options</button>
        </div>
      ))}

      <div class="mood-grid">
        {MOODS.map((m) => (
          <button class={`mood accent-${m.accent}`} onClick={() => go(`/m/${m.id}`)}>
            {isCustom(m.id) && <span class="mine">Yours</span>}
            <MoodGlyph id={m.id} />
            <div>
              <div class="name">{m.name}</div>
              <div class="line">{m.line}</div>
            </div>
          </button>
        ))}
      </div>

      {last && (
        <button class={`resume accent-${last.accent}`} onClick={() => go(`/m/${last.id}`)}>
          <span class="dot"><Icon name="play" /></span>
          <span>
            <div class="eyebrow">Pick up where you left off</div>
            <div style="font-weight:650">{last.name} · {shortTitle(recipeFor(last.id).sound)}</div>
          </span>
        </button>
      )}

      <div class="quick-row">
        <button onClick={() => go('/move')}><Icon name="walk" />Move</button>
        <button onClick={() => go('/sleep/diary')}><Icon name="moon" />Sleep log</button>
        <button onClick={() => go('/evidence')}><Icon name="book" />Why it works</button>
        <button onClick={() => go('/settings')}><Icon name="gear" />Settings</button>
      </div>

      <p class="tiny faint center" style="margin-top:22px"><a href="#/about">About Steady</a></p>
    </>
  );
}
