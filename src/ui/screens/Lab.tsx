import { TopBar } from '../components';

export function Lab({ path: _path }: { path: string }) {
  return (
    <div class="accent-relax">
      <TopBar title="Experiment Lab" />
      <h1>Experiment Lab</h1>
      <p class="lead">Coming next: test one part at a time (for example, the rhythm layer against a hidden sham) with a locked plan, blinded sessions and an honest verdict.</p>
    </div>
  );
}
