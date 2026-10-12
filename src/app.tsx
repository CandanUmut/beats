import { useEffect } from 'preact/hooks';
import { route, go } from './ui/router';
import { settings, settingsLoaded, loadSettings } from './data/settings';
import { HelpSheet } from './ui/components';
import { Cat } from './ui/Cat';
import { Home } from './ui/screens/Home';
import { Onboarding } from './ui/screens/Onboarding';
import { Breathe, Calm, Focus, Move, Relax, Sleep, Urge } from './ui/screens/Flows';
import { About, EvidenceDetail, EvidenceList, Log, Myths, Settings, SleepDiary } from './ui/screens/Info';
import { Lab } from './ui/screens/Lab';
import { Tuner } from './ui/screens/Tuner';
import { MOOD_BY_ID, type MoodId } from './data/moods';

export function App() {
  useEffect(() => {
    void loadSettings();
  }, []);
  if (!settingsLoaded.value) return <div class="app" />;
  const r = route.value;
  let page;
  if (!settings.value.onboarded) page = <Onboarding onDone={() => go('/')} />;
  else if (r === '/') page = <Home />;
  else if (r.startsWith('/m/') && MOOD_BY_ID[r.slice(3) as MoodId]) page = moodPage(r.slice(3) as MoodId);
  else if (r.startsWith('/tune/') && MOOD_BY_ID[r.slice(6) as MoodId]) page = <Tuner moodId={r.slice(6) as MoodId} />;
  else if (r === '/calm') page = <Calm />;
  else if (r === '/urge') page = <Urge />;
  else if (r === '/relax') page = <Relax />;
  else if (r === '/sleep') page = <Sleep />;
  else if (r === '/sleep/diary') page = <SleepDiary />;
  else if (r === '/focus') page = <Focus />;
  else if (r === '/breathe') page = <Breathe />;
  else if (r === '/move') page = <Move />;
  else if (r === '/lab' || r.startsWith('/lab/')) page = <Lab path={r} />;
  else if (r === '/evidence') page = <EvidenceList />;
  else if (r.startsWith('/evidence/')) page = <EvidenceDetail id={r.slice('/evidence/'.length)} />;
  else if (r === '/myths') page = <Myths />;
  else if (r === '/about') page = <About />;
  else if (r === '/settings') page = <Settings />;
  else if (r === '/log') page = <Log />;
  else if (r === '/recheck') page = <Onboarding recheck onDone={() => go('/settings')} />;
  else page = <Home />;
  return (
    <>
      <div class={`app${r === '/' ? ' home' : ''}${settings.value.cat && settings.value.onboarded ? ' with-cat' : ''}`} key={r}>
        {page}
        <HelpSheet />
      </div>
      {settings.value.onboarded && <Cat />}
    </>
  );
}

function moodPage(id: MoodId) {
  switch (MOOD_BY_ID[id].flow) {
    case 'calm': return <Calm />;
    case 'urge': return <Urge />;
    case 'relax': return <Relax />;
    case 'sleep': return <Sleep />;
    case 'focus': return <Focus />;
    default: return <Breathe />;
  }
}
