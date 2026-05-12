import { describe, it, expect, vi } from 'vitest';

vi.mock('./auth', () => ({
  getSession: vi.fn(),
}));

import { requireAdmin, requireStaff, bad } from './api';
import { getSession } from './auth';

describe('api guards', () => {
  it('bad() returns a 400 by default', async () => {
    const r = bad('nope');
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'nope' });
  });

  it('bad() accepts a custom status', async () => {
    const r = bad('rate', 429);
    expect(r.status).toBe(429);
  });

  it('requireAdmin returns 401 when no session', async () => {
    (getSession as any).mockResolvedValueOnce(null);
    const { error } = await requireAdmin();
    expect(error?.status).toBe(401);
  });

  it('requireAdmin returns 403 for non-admin users', async () => {
    (getSession as any).mockResolvedValueOnce({ user: { role: 'HR' } });
    const { error } = await requireAdmin();
    expect(error?.status).toBe(403);
  });

  it('requireAdmin returns the session for admin users', async () => {
    const session = { user: { id: 'u1', email: 'a@b', role: 'ADMIN' } };
    (getSession as any).mockResolvedValueOnce(session);
    const r = await requireAdmin();
    expect(r.error).toBeUndefined();
    expect(r.session).toBe(session);
  });

  it('requireStaff accepts HR', async () => {
    (getSession as any).mockResolvedValueOnce({ user: { id: 'u2', role: 'HR' } });
    const r = await requireStaff();
    expect(r.error).toBeUndefined();
  });

  it('requireStaff rejects unauthenticated', async () => {
    (getSession as any).mockResolvedValueOnce(null);
    const r = await requireStaff();
    expect(r.error?.status).toBe(401);
  });
});
