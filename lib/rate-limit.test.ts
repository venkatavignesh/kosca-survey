import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit, clientKey } from './rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
  });

  it('allows up to the limit', () => {
    for (let i = 1; i <= 3; i++) {
      const r = rateLimit({ name: 't1', key: 'k', limit: 3, windowMs: 1000 });
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(3 - i);
    }
  });

  it('rejects past the limit', () => {
    for (let i = 0; i < 3; i++) rateLimit({ name: 't2', key: 'k', limit: 3, windowMs: 1000 });
    const r = rateLimit({ name: 't2', key: 'k', limit: 3, windowMs: 1000 });
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('resets after the window elapses', () => {
    for (let i = 0; i < 3; i++) rateLimit({ name: 't3', key: 'k', limit: 3, windowMs: 1000 });
    expect(rateLimit({ name: 't3', key: 'k', limit: 3, windowMs: 1000 }).ok).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit({ name: 't3', key: 'k', limit: 3, windowMs: 1000 }).ok).toBe(true);
  });

  it('counts each key independently', () => {
    for (let i = 0; i < 3; i++) rateLimit({ name: 't4', key: 'a', limit: 3, windowMs: 1000 });
    expect(rateLimit({ name: 't4', key: 'b', limit: 3, windowMs: 1000 }).ok).toBe(true);
  });
});

describe('clientKey', () => {
  it('prefers the first x-forwarded-for entry', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(clientKey({ headers })).toBe('1.2.3.4');
  });
  it('falls back to x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '9.9.9.9' });
    expect(clientKey({ headers })).toBe('9.9.9.9');
  });
  it("returns 'unknown' when no proxy headers", () => {
    expect(clientKey({ headers: new Headers() })).toBe('unknown');
  });
});
