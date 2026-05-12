import { describe, it, expect } from 'vitest';
import { applyEmployeeFilters } from './responses';

describe('applyEmployeeFilters', () => {
  it('returns the where untouched when no filters', () => {
    const w: any = { campaignId: 'c1' };
    expect(applyEmployeeFilters(w)).toEqual({ campaignId: 'c1' });
  });

  it('adds locationId IN clause', () => {
    const w = applyEmployeeFilters({ campaignId: 'c1' }, { locationIds: ['l1', 'l2'] });
    expect(w.employee.locationId).toEqual({ in: ['l1', 'l2'] });
  });

  it('layers multiple demographic filters under employee', () => {
    const w = applyEmployeeFilters(
      { campaignId: 'c1' },
      { locationIds: ['l1'], officeTypeIds: ['o1'], departmentIds: ['d1'] },
    );
    expect(w.employee.locationId).toEqual({ in: ['l1'] });
    expect(w.employee.officeTypeId).toEqual({ in: ['o1'] });
    expect(w.employee.departmentId).toEqual({ in: ['d1'] });
  });

  it('builds case-insensitive OR for q', () => {
    const w = applyEmployeeFilters({ campaignId: 'c1' }, { q: 'venk' });
    expect(w.employee.OR).toHaveLength(4);
    expect(w.employee.OR[0]).toEqual({ name: { contains: 'venk', mode: 'insensitive' } });
  });

  it('trims whitespace from q', () => {
    const w = applyEmployeeFilters({ campaignId: 'c1' }, { q: '  venk  ' });
    expect(w.employee.OR[0].name.contains).toBe('venk');
  });

  it('ignores empty q', () => {
    const w = applyEmployeeFilters({ campaignId: 'c1' }, { q: '   ' });
    expect(w.employee).toBeUndefined();
  });
});
