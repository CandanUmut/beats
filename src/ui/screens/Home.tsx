import { useEffect, useState } from 'preact/hooks';
import { MOODS, MOOD_BY_ID } from '../../data/moods';
import { settings, isCustom, recipeFor } from '../../data/settings';
import { HelpButton, Icon, helpOpen } from '../components';
import { go } from '../router';
import { allSessions, nudges, type Nudge } from '../../data/usage';
import { autoplay, shortTitle } from '../Player';
import { SceneThumb } from '../Scene';

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

      <h1>{greeting()} <em>How do you want to feel?</em></h1>

      {nudge.map((n) => (
        <div class="note accent-clay">
          {n.text}{' '}
          <button class="link-btn" onClick={() => (helpOpen.value = true)}>See support options</button>
        </div>
      ))}

      {last && (
        <button class={`resume accent-${last.accent}`} onClick={() => { autoplay.mood = last.id; go(`/m/${last.id}`); }}>
          <span class="dot"><Icon name="play" /></span>
          <span>
            <div class="eyebrow">Play again</div>
            <div style="font-weight:650">{last.name} · {shortTitle(recipeFor(last.id).sound)} · {recipeFor(last.id).minutes} min</div>
          </span>
        </button>
      )}

      <div class="mood-grid">
        {MOODS.map((m) => (
          <button class={`mood accent-${m.accent}`} onClick={() => go(`/m/${m.id}`)}>
            <SceneThumb scene={recipeFor(m.id).scene ?? 'forest'} />
            {isCustom(m.id) && <span class="mine">Yours</span>}
            <span />
            <div>
              <div class="name">{m.name}</div>
              <div class="line">{m.line}</div>
            </div>
          </button>
        ))}
      </div>

      <div class="quick-row">
        <button onClick={() => go('/move')}><Icon name="walk" />Move</button>
        <button onClick={() => go('/sleep/diary')}><Icon name="moon" />Sleep log</button>
        <button onClick={() => go('/evidence')}><Icon name="book" />Research</button>
        <button onClick={() => go('/settings')}><Icon name="gear" />Settings</button>
      </div>

      <p class="tiny faint center" style="margin-top:22px"><a href="#/about">About Steady</a></p>
    </>
  );
}
