import { describe, it, expect, vi, beforeEach } from 'vitest';

const { auditCreate } = vi.hoisted(() => ({ auditCreate: vi.fn() }));

vi.mock('@/lib/db', () => ({ prisma: { auditLog: { create: auditCreate } } }));
vi.mock('./db', () => ({ prisma: { auditLog: { create: auditCreate } } }));
vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (k: string) =>
      k === 'x-request-id' ? 'req-test' :
      k === 'x-forwarded-for' ? '1.2.3.4, 9.9.9.9' :
      null,
  }),
}));

import { audit, AUDIT_ACTIONS } from './audit';

beforeEach(() => auditCreate.mockReset());

describe('audit', () => {
  it('persists action, userId, requestId and parsed first-hop ip', async () => {
    auditCreate.mockResolvedValueOnce({});
    await audit({
      action: AUDIT_ACTIONS.USER_LOGIN,
      userId: 'u1',
      actorEmail: 'a@b',
      entityType: 'User',
      entityId: 'u1',
      metadata: { ok: true },
    });
    const data = auditCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      action: 'USER_LOGIN',
      userId: 'u1',
      actorEmail: 'a@b',
      entityType: 'User',
      entityId: 'u1',
      requestId: 'req-test',
      ip: '1.2.3.4',
    });
  });

  it('swallows DB failures (never throws)', async () => {
    auditCreate.mockRejectedValueOnce(new Error('boom'));
    await expect(audit({ action: AUDIT_ACTIONS.USER_LOGIN })).resolves.toBeUndefined();
  });

  it('exposes every action code as its own constant', () => {
    expect(AUDIT_ACTIONS.CAMPAIGN_CREATE).toBe('CAMPAIGN_CREATE');
    expect(AUDIT_ACTIONS.EMPLOYEE_IMPORT).toBe('EMPLOYEE_IMPORT');
  });
});
