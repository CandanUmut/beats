import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// `base` is relative so the build works on GitHub Pages under /<repo>/.
export default defineConfig({
  base: './',
  plugins: [preact()],
  worker: { format: 'es' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
} as any);
