import { describe, it, expect, vi } from 'vitest';

vi.mock('./db', () => ({
  prisma: { location: { id: 'L' }, officeType: { id: 'O' }, department: { id: 'D' } },
}));

import { masterDelegates, masterLabels } from './masters';

describe('masters constants', () => {
  it('masterLabels covers every kind', () => {
    expect(masterLabels.location).toBe('Location');
    expect(masterLabels.officeType).toBe('Office type');
    expect(masterLabels.department).toBe('Department');
  });
  it('masterDelegates exposes one entry per master kind', () => {
    expect(Object.keys(masterDelegates).sort()).toEqual(['department', 'location', 'officeType']);
  });
});
