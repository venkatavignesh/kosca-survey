import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installProcessHandlers } from './process-handlers';

describe('installProcessHandlers', () => {
  beforeEach(() => {
    // Reset listeners so each test sees a clean slate.
    for (const ev of ['unhandledRejection', 'uncaughtException', 'SIGTERM', 'SIGINT'] as const) {
      process.removeAllListeners(ev);
    }
  });

  it('installs unhandledRejection + uncaughtException + SIGTERM + SIGINT listeners', () => {
    installProcessHandlers();
    expect(process.listenerCount('unhandledRejection')).toBeGreaterThanOrEqual(1);
    expect(process.listenerCount('uncaughtException')).toBeGreaterThanOrEqual(1);
    expect(process.listenerCount('SIGTERM')).toBeGreaterThanOrEqual(1);
    expect(process.listenerCount('SIGINT')).toBeGreaterThanOrEqual(1);
  });

  it('does not double-install on repeated calls', () => {
    installProcessHandlers();
    const before = process.listenerCount('unhandledRejection');
    installProcessHandlers();
    expect(process.listenerCount('unhandledRejection')).toBe(before);
  });

  // Note: deliberately don't test the uncaughtException → process.exit path
  // — Node won't let us intercept exit cleanly inside a worker, and emitting
  // the event kills the vitest worker even with a spied exit.
});
