import { describe, it, expect } from 'vitest';
import { parsePage, pagedResult, MAX_LIMIT, DEFAULT_LIMIT, LEGACY_LIST_CAP } from './pagination';

const sp = (q: string) => new URLSearchParams(q);

describe('pagination — edges and exports', () => {
  it('exports the relevant constants', () => {
    expect(MAX_LIMIT).toBeGreaterThan(0);
    expect(DEFAULT_LIMIT).toBeGreaterThan(0);
    expect(LEGACY_LIST_CAP).toBeGreaterThanOrEqual(MAX_LIMIT);
  });
  it('rounds down fractional page and limit', () => {
    const p = parsePage(sp('page=3.7&limit=10.9'));
    expect(p.page).toBe(3);
    expect(p.limit).toBe(10);
  });
  it('treats page=0 as 1', () => {
    expect(parsePage(sp('page=0')).page).toBe(1);
  });
  it('treats limit=0 as 1 (minimum allowed)', () => {
    expect(parsePage(sp('limit=0')).limit).toBe(1);
  });
  it('skip = (page - 1) * limit', () => {
    const p = parsePage(sp('page=5&limit=20'));
    expect(p.skip).toBe(80);
  });
  it('paged result item count equals slice', () => {
    const out = pagedResult(Array.from({ length: 7 }), 100, { page: 2, limit: 7, skip: 7 });
    expect(out.items).toHaveLength(7);
    expect(out.totalPages).toBe(Math.ceil(100 / 7));
  });
});
