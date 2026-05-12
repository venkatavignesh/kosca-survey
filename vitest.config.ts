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
      // Current measured: stmts 86.2 / branches 70.7 / fns 89.2 / lines 87.7.
      // Floor sits ~2pp below current so a regression bigger than that fails.
      thresholds: {
        statements: 84,
        branches: 70,
        functions: 87,
        lines: 85,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
