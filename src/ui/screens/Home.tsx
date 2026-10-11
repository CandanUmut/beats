import { useEffect, useState } from 'preact/hooks';
import { GOALS } from '../../data/goals';
import { Badge, GOAL_ICON, HelpButton, Icon } from '../components';
import { go } from '../router';
import { allSessions, nudges, type Nudge } from '../../data/usage';
import { helpOpen } from '../components';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Home() {
  const [nudge, setNudge] = useState<Nudge[]>([]);
  useEffect(() => {
    allSessions().then((s) => setNudge(nudges(s)));
  }, []);
  return (
    <>
      <header class="topbar">
        <div class="brand"><span class="brand-dot" /> Steady</div>
        <HelpButton />
      </header>
      <h1>{greeting()}</h1>
      <p class="lead">What do you need right now?</p>

      {nudge.map((n) => (
        <div class="note accent-calm" style="border-left-color:var(--calm)">
          {n.text}{' '}
          <button class="btn small" style="margin-top:8px" onClick={() => (helpOpen.value = true)}>See support options</button>
        </div>
      ))}

      {GOALS.map((g) => (
        <div class={`goal-card accent-${g.accent}`} role="button" tabIndex={0} onClick={() => go(`/${g.id}`)} onKeyDown={(e) => e.key === 'Enter' && go(`/${g.id}`)}>
          <div class="goal-name">
            <span class="goal-glyph"><Icon name={GOAL_ICON[g.id]} /></span>
            {g.name}
          </div>
          <span class="chev"><Icon name="chev" size={20} /></span>
          <div class="goal-tag">{g.tagline}</div>
          <div class="badges">
            {g.badges.map((b) => <Badge label={b.label} evidence={b.evidence} />)}
          </div>
        </div>
      ))}

      <div class="bottom-nav">
        <button onClick={() => go('/breathe')}><Icon name="lungs" />Breathe</button>
        <button onClick={() => go('/lab')}><Icon name="flask" />Lab</button>
        <button onClick={() => go('/evidence')}><Icon name="book" />Evidence</button>
        <button onClick={() => go('/settings')}><Icon name="gear" />Settings</button>
      </div>
      <p class="tiny faint center" style="margin-top:20px">
        An experimental wellness tool, not a medical device. <a href="#/about">About & disclaimer</a>
      </p>
    </>
  );
}
