import { describe, it, expect } from 'vitest';
import { parsePage, pagedResult } from './pagination';

const sp = (q: string) => new URLSearchParams(q);

describe('parsePage', () => {
  it('defaults to page 1 / limit 50', () => {
    expect(parsePage(sp(''))).toEqual({ page: 1, limit: 50, skip: 0 });
  });
  it('clamps limit to 200', () => {
    expect(parsePage(sp('limit=99999')).limit).toBe(200);
  });
  it('floors negatives to 1', () => {
    expect(parsePage(sp('page=-3&limit=-9')).page).toBe(1);
    expect(parsePage(sp('page=-3&limit=-9')).limit).toBe(1);
  });
  it('handles non-numeric input gracefully', () => {
    expect(parsePage(sp('page=foo&limit=bar'))).toEqual({ page: 1, limit: 50, skip: 0 });
  });
  it('computes skip', () => {
    expect(parsePage(sp('page=3&limit=20')).skip).toBe(40);
  });
});

describe('pagedResult', () => {
  it('reports totalPages', () => {
    const r = pagedResult([1, 2, 3], 25, { page: 2, limit: 10, skip: 10 });
    expect(r.totalPages).toBe(3);
    expect(r.items).toEqual([1, 2, 3]);
  });
  it('returns 1 totalPages when total is 0', () => {
    expect(pagedResult([], 0, { page: 1, limit: 10, skip: 0 }).totalPages).toBe(1);
  });
});
