import { signal } from '@preact/signals';

function read(): string {
  const h = location.hash.replace(/^#/, '');
  return h || '/';
}

export const route = signal(read());
let depth = 0;

window.addEventListener('hashchange', () => {
  route.value = read();
  depth = route.value === '/' ? 0 : depth + 1;
  window.scrollTo(0, 0);
});

export function go(path: string): void {
  if (read() === path) return;
  location.hash = path;
}

/** Go back within the app; if there is nowhere to go back to, go home. */
export function back(fallback = '/'): void {
  if (depth > 0) {
    depth -= 2; // the hashchange that follows adds one back
    history.back();
  }
  else go(fallback);
}
