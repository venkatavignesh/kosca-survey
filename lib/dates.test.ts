import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatTime, formatDateInputIso, formatCount } from './dates';

// Fixed instant: 2026-04-05T00:50:00.000Z → in IST this is 06:20 on 5 Apr 2026.
const FIXED = new Date('2026-04-05T00:50:00.000Z');

describe('dates', () => {
  describe('formatDate', () => {
    it('formats a Date as DD-MON-YYYY in IST', () => {
      expect(formatDate(FIXED)).toBe('05-APR-2026');
    });
    it('handles ISO strings', () => {
      expect(formatDate('2026-04-05T00:50:00.000Z')).toBe('05-APR-2026');
    });
    it('returns em-dash for null/undefined', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
    });
    it('returns em-dash for invalid input', () => {
      expect(formatDate('not a date')).toBe('—');
    });
  });

  describe('formatDateTime', () => {
    it('formats with am/pm in IST', () => {
      expect(formatDateTime(FIXED)).toBe('05 Apr 2026, 06:20 am');
    });
    it('uses 12-hour clock with midnight as 12', () => {
      // 2026-04-04T18:30Z → 00:00 IST = "12:00 am"
      expect(formatDateTime('2026-04-04T18:30:00.000Z')).toBe('05 Apr 2026, 12:00 am');
    });
  });

  describe('formatTime', () => {
    it('returns time-of-day only', () => {
      expect(formatTime(FIXED)).toBe('06:20 am');
    });
  });

  describe('formatDateInputIso', () => {
    it('returns YYYY-MM-DD in IST', () => {
      expect(formatDateInputIso(FIXED)).toBe('2026-04-05');
    });
    it('returns empty string for null', () => {
      expect(formatDateInputIso(null)).toBe('');
    });
  });

  describe('formatCount', () => {
    it('uses Indian grouping', () => {
      expect(formatCount(123456)).toBe('1,23,456');
    });
  });
});
