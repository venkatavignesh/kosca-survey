import { describe, it, expect } from 'vitest';
import { validatePassword, hashPassword, verifyPassword, generateTempPassword } from './password';

describe('password', () => {
  describe('validatePassword', () => {
    it('rejects short passwords', () => {
      expect(validatePassword('Ab1!')).toMatch(/at least 8/);
    });
    it('rejects passwords with no letter', () => {
      expect(validatePassword('12345678!')).toMatch(/letter/);
    });
    it('rejects passwords with no digit', () => {
      expect(validatePassword('Abcdefgh!')).toMatch(/digit/);
    });
    it('rejects passwords with no symbol', () => {
      expect(validatePassword('Abcdefg1')).toMatch(/symbol/);
    });
    it('accepts a compliant password', () => {
      expect(validatePassword('Kosca@1243')).toBeNull();
    });
  });

  describe('hash/verify', () => {
    it('round-trips', async () => {
      const hash = await hashPassword('Hello@2026');
      expect(hash).not.toBe('Hello@2026');
      expect(await verifyPassword('Hello@2026', hash)).toBe(true);
      expect(await verifyPassword('wrong', hash)).toBe(false);
    });
  });

  describe('generateTempPassword', () => {
    it('always passes our own validator', () => {
      for (let i = 0; i < 20; i++) {
        const p = generateTempPassword();
        expect(validatePassword(p)).toBeNull();
      }
    });
  });
});
