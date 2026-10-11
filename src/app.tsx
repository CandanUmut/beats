import { useEffect } from 'preact/hooks';
import { route, go } from './ui/router';
import { settings, settingsLoaded, loadSettings } from './data/settings';
import { HelpSheet } from './ui/components';
import { Home } from './ui/screens/Home';
import { Onboarding } from './ui/screens/Onboarding';
import { Breathe, Calm, Focus, Move, Relax, Sleep, Urge } from './ui/screens/Flows';
import { About, EvidenceDetail, EvidenceList, Log, Myths, Settings, SleepDiary } from './ui/screens/Info';
import { Lab } from './ui/screens/Lab';

export function App() {
  useEffect(() => {
    void loadSettings();
  }, []);
  if (!settingsLoaded.value) return <div class="app" />;
  const r = route.value;
  let page;
  if (!settings.value.onboarded) page = <Onboarding onDone={() => go('/')} />;
  else if (r === '/') page = <Home />;
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
    <div class="app" key={r}>
      {page}
      <HelpSheet />
    </div>
  );
}
