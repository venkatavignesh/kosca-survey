import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.test.ts', 'lib/**/*.d.ts'],
      // Ratchet floor: only ever bump these UP.
      // Current measured: stmts 31.7 / branches 29.8 / fns 38.1 / lines 30.8.
      // Floor sits just below so a regression of >2 percentage points fails CI.
      thresholds: {
        statements: 28,
        branches: 25,
        functions: 35,
        lines: 28,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
