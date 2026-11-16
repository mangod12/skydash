import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}'],
      reporter: ['text-summary'],
      // Measured over all of src (about 12% lines today, since most UI components have no tests yet). The floor stops regressions; raise it as tests are added.
      thresholds: { lines: 11, statements: 10, functions: 8, branches: 7 },
    },
  },
});
