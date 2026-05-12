import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatDateInputIso,
  formatCount,
  formatCurrency,
  formatPrecise,
  NEVER,
  EMDASH,
} from './dates';

describe('dates — extra coverage', () => {
  it('formatTime returns 12:00 pm at noon IST', () => {
    // 06:30Z = 12:00 IST
    expect(formatTime('2026-04-05T06:30:00Z')).toBe('12:00 pm');
  });
  it('formatTime returns 12:00 am at midnight IST', () => {
    // 2026-04-04T18:30Z = 00:00 IST on 5 Apr
    expect(formatTime('2026-04-04T18:30:00Z')).toBe('12:00 am');
  });
  it('formatCurrency renders INR without decimals', () => {
    expect(formatCurrency(125000)).toContain('1,25,000');
  });
  it('formatPrecise keeps two decimals', () => {
    expect(formatPrecise(1234.5)).toMatch(/1,234\.50/);
  });
  it('formatCount handles zero and negative', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(-12345)).toBe('-12,345');
  });
  it('placeholders are stable', () => {
    expect(NEVER).toBe('Never');
    expect(EMDASH).toBe('—');
  });
  it('formatDate handles unix-epoch strings', () => {
    expect(formatDate(new Date(0))).toBe('01-JAN-1970');
  });
  it('formatDateInputIso pads single-digit month/day', () => {
    expect(formatDateInputIso('2026-01-05T00:00:00Z')).toMatch(/^2026-01-05$/);
  });
  it('formatDateTime falls back gracefully on garbage', () => {
    expect(formatDateTime('garbage')).toBe('—');
  });
});
