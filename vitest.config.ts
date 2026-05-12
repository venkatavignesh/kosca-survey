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
      // Current measured: stmts 62.5 / branches 55.7 / fns 70.1 / lines 62.
      // Floor sits ~2pp below so a regression of more than that fails CI.
      thresholds: {
        statements: 60,
        branches: 52,
        functions: 67,
        lines: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
