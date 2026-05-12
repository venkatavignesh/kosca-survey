import { describe, it, expect, vi, beforeEach } from 'vitest';

const { campaignDel, auditFn } = vi.hoisted(() => ({
  campaignDel: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  auditFn: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: { campaign: campaignDel } }));
vi.mock('@/lib/audit', () => ({
  audit: auditFn,
  AUDIT_ACTIONS: {
    CAMPAIGN_CREATE: 'CAMPAIGN_CREATE',
    CAMPAIGN_UPDATE: 'CAMPAIGN_UPDATE',
    CAMPAIGN_DELETE: 'CAMPAIGN_DELETE',
  },
}));
vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'req-id' }) }));

import { createCampaign, updateCampaign, deleteCampaign } from './campaigns';
import { ApiError } from '@/lib/errors';

beforeEach(() => {
  campaignDel.create.mockReset();
  campaignDel.update.mockReset();
  campaignDel.delete.mockReset();
  auditFn.mockReset();
});

describe('createCampaign', () => {
  it('persists with a Date deadline and audits the create', async () => {
    campaignDel.create.mockResolvedValueOnce({ id: 'c1', title: 'T' });
    const out = await createCampaign({
      title: 'T',
      emailSubjectTemplate: 's',
      emailBodyTemplate: 'b',
      deadline: '2026-12-31T00:00:00Z',
      createdById: 'u1',
      actorEmail: 'a@b',
    });
    expect(campaignDel.create.mock.calls[0][0].data.deadline).toBeInstanceOf(Date);
    expect(out.id).toBe('c1');
    expect(auditFn).toHaveBeenCalledOnce();
    expect(auditFn.mock.calls[0][0].action).toBe('CAMPAIGN_CREATE');
  });

  it('null deadline becomes null', async () => {
    campaignDel.create.mockResolvedValueOnce({ id: 'c2' });
    await createCampaign({
      title: 't',
      emailSubjectTemplate: 's',
      emailBodyTemplate: 'b',
      createdById: 'u',
      actorEmail: 'a',
    });
    expect(campaignDel.create.mock.calls[0][0].data.deadline).toBeNull();
  });
});

describe('updateCampaign', () => {
  it('maps deadline string to Date', async () => {
    campaignDel.update.mockResolvedValueOnce({ id: 'c1' });
    await updateCampaign({
      id: 'c1',
      patch: { deadline: '2027-01-15T00:00:00Z' },
      actorId: 'u',
      actorEmail: 'a',
    });
    expect(campaignDel.update.mock.calls[0][0].data.deadline).toBeInstanceOf(Date);
  });

  it('translates Prisma P2025 to a 404 ApiError', async () => {
    campaignDel.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(
      updateCampaign({ id: 'missing', patch: { title: 'x' }, actorId: 'u', actorEmail: 'a' }),
    ).rejects.toThrow(ApiError);
  });
});

describe('deleteCampaign', () => {
  it('audits the delete on success', async () => {
    campaignDel.delete.mockResolvedValueOnce({});
    await deleteCampaign('c1', 'u', 'a@b');
    expect(auditFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CAMPAIGN_DELETE', entityId: 'c1' }),
    );
  });

  it('throws 404 ApiError when row already gone', async () => {
    campaignDel.delete.mockRejectedValueOnce({ code: 'P2025' });
    await expect(deleteCampaign('c1', 'u', 'a')).rejects.toMatchObject({ status: 404 });
  });
});
