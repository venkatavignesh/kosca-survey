import { describe, it, expect } from 'vitest';
import { logger, withRequestId } from './logger';

describe('logger', () => {
  it('exposes pino-style level methods', () => {
    for (const lvl of ['debug', 'info', 'warn', 'error', 'fatal'] as const) {
      expect(typeof logger[lvl]).toBe('function');
    }
  });

  it('binds requestId on a child logger', () => {
    const child = withRequestId('req-abc');
    expect(child.bindings()).toMatchObject({ requestId: 'req-abc' });
  });

  it('child inherits base service tag', () => {
    expect(logger.bindings()).toMatchObject({ service: 'kosca-survey' });
  });
});
