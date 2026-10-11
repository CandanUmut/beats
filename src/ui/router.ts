import { signal } from '@preact/signals';

function read(): string {
  const h = location.hash.replace(/^#/, '');
  return h || '/';
}

export const route = signal(read());

window.addEventListener('hashchange', () => {
  route.value = read();
  window.scrollTo(0, 0);
});

export function go(path: string): void {
  if (read() === path) return;
  location.hash = path;
}

export function back(fallback = '/'): void {
  if (history.length > 1) history.back();
  else go(fallback);
}
