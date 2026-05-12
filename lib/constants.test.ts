import { describe, it, expect } from 'vitest';
import {
  AUDIT_ACTIONS,
  CAMPAIGN_STATUS,
  ROLES,
  AUDIENCES,
  QUESTION_TYPES,
  TEXT_QUESTION_TYPES,
} from './constants';

describe('constants', () => {
  it('AUDIT_ACTIONS values match their keys', () => {
    for (const [k, v] of Object.entries(AUDIT_ACTIONS)) {
      expect(v).toBe(k);
    }
  });
  it('CAMPAIGN_STATUS exposes the three lifecycle states', () => {
    expect(Object.values(CAMPAIGN_STATUS).sort()).toEqual(['ACTIVE', 'CLOSED', 'DRAFT']);
  });
  it('ROLES contains ADMIN and HR', () => {
    expect(ROLES.ADMIN).toBe('ADMIN');
    expect(ROLES.HR).toBe('HR');
  });
  it('AUDIENCES contains ALL + SPECIFIC', () => {
    expect(AUDIENCES.ALL).toBe('ALL');
    expect(AUDIENCES.SPECIFIC).toBe('SPECIFIC');
  });
  it('QUESTION_TYPES covers all six variants', () => {
    expect(Object.keys(QUESTION_TYPES).sort()).toEqual(
      ['CHECKBOX', 'LONG_TEXT', 'MCQ_MULTI', 'MCQ_SINGLE', 'RADIO', 'TEXT'],
    );
  });
  it('TEXT_QUESTION_TYPES marks only the text variants', () => {
    expect(TEXT_QUESTION_TYPES.has('TEXT')).toBe(true);
    expect(TEXT_QUESTION_TYPES.has('LONG_TEXT')).toBe(true);
    expect(TEXT_QUESTION_TYPES.has('RADIO')).toBe(false);
  });
});
