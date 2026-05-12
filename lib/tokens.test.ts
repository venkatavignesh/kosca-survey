import { describe, it, expect } from 'vitest';
import { generateToken, generateConfirmCode } from './tokens';

describe('tokens', () => {
  it('generates 64-char hex tokens', () => {
    const t = generateToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });
  it('generates unique tokens', () => {
    const set = new Set(Array.from({ length: 50 }, () => generateToken()));
    expect(set.size).toBe(50);
  });
  it('generates 6-digit confirm codes', () => {
    for (let i = 0; i < 25; i++) {
      const c = generateConfirmCode();
      expect(c).toMatch(/^\d{6}$/);
      const n = Number(c);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });
});
