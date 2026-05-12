import { describe, it, expect, vi, beforeEach } from 'vitest';

const { campaignFindUnique, campaignUpdate, assignmentFindMany, assignmentUpdate, sendCampaignEmailMock, auditFn } = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  campaignUpdate: vi.fn(),
  assignmentFindMany: vi.fn(),
  assignmentUpdate: vi.fn(),
  sendCampaignEmailMock: vi.fn(),
  auditFn: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique, update: campaignUpdate },
    campaignAssignment: { findMany: assignmentFindMany, update: assignmentUpdate },
  },
}));
vi.mock('@/lib/campaign-mail', () => ({ sendCampaignEmail: sendCampaignEmailMock }));
vi.mock('@/lib/audit', () => ({
  audit: auditFn,
  AUDIT_ACTIONS: { CAMPAIGN_SEND: 'CAMPAIGN_SEND' },
}));
vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'r' }) }));

import { sendCampaign } from './send';
import { ApiError } from '@/lib/errors';

beforeEach(() => {
  for (const m of [campaignFindUnique, campaignUpdate, assignmentFindMany, assignmentUpdate, sendCampaignEmailMock, auditFn]) {
    m.mockReset();
  }
});

const baseCamp = (overrides: any = {}) => ({
  id: 'c1', title: 'T', emailSubjectTemplate: 's', emailBodyTemplate: 'b',
  deadline: null, status: 'DRAFT', ...overrides,
});
const asg = (overrides: any = {}) => ({
  id: 'a1', token: 't1', emailSentAt: null, submittedAt: null,
  employee: { id: 'e1', name: 'X', empCode: 'E1', designation: 'D', email: 'x@y' },
  ...overrides,
});

describe('sendCampaign', () => {
  it('throws ApiError 404 when campaign missing', async () => {
    campaignFindUnique.mockResolvedValueOnce(null);
    await expect(
      sendCampaign({ campaignId: 'c?', actorId: 'u', actorEmail: 'a' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('flips campaign DRAFT -> ACTIVE on first invite', async () => {
    campaignFindUnique.mockResolvedValueOnce(baseCamp());
    assignmentFindMany.mockResolvedValueOnce([asg()]);
    sendCampaignEmailMock.mockResolvedValue(undefined);
    await sendCampaign({ campaignId: 'c1', actorId: 'u', actorEmail: 'a' });
    expect(campaignUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' }, data: { status: 'ACTIVE' } }),
    );
  });

  it('stamps emailSentAt on first invite', async () => {
    campaignFindUnique.mockResolvedValueOnce(baseCamp({ status: 'ACTIVE' }));
    assignmentFindMany.mockResolvedValueOnce([asg()]);
    sendCampaignEmailMock.mockResolvedValue(undefined);
    await sendCampaign({ campaignId: 'c1', actorId: 'u', actorEmail: 'a' });
    const upd = assignmentUpdate.mock.calls[0][0];
    expect(upd.data.emailSentAt).toBeInstanceOf(Date);
  });

  it('reminder path increments reminderCount + lastReminderSentAt', async () => {
    campaignFindUnique.mockResolvedValueOnce(baseCamp({ status: 'ACTIVE' }));
    assignmentFindMany.mockResolvedValueOnce([asg({ emailSentAt: new Date() })]);
    sendCampaignEmailMock.mockResolvedValue(undefined);
    await sendCampaign({ campaignId: 'c1', resend: true, actorId: 'u', actorEmail: 'a' });
    const upd = assignmentUpdate.mock.calls[0][0];
    expect(upd.data.reminderCount).toEqual({ increment: 1 });
    expect(upd.data.lastReminderSentAt).toBeInstanceOf(Date);
  });

  it('aggregates failures into the result without throwing', async () => {
    campaignFindUnique.mockResolvedValueOnce(baseCamp({ status: 'ACTIVE' }));
    assignmentFindMany.mockResolvedValueOnce([asg(), asg({ id: 'a2', token: 't2' })]);
    sendCampaignEmailMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('smtp boom'));
    const r = await sendCampaign({ campaignId: 'c1', actorId: 'u', actorEmail: 'a' });
    expect(r.sent).toBe(1);
    expect(r.failed).toEqual([{ assignmentId: 'a2', error: 'smtp boom' }]);
  });

  it('audits the send with isReminder + counts', async () => {
    campaignFindUnique.mockResolvedValueOnce(baseCamp({ status: 'ACTIVE' }));
    assignmentFindMany.mockResolvedValueOnce([asg()]);
    sendCampaignEmailMock.mockResolvedValue(undefined);
    await sendCampaign({ campaignId: 'c1', actorId: 'u', actorEmail: 'a' });
    expect(auditFn).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CAMPAIGN_SEND',
        metadata: expect.objectContaining({ isReminder: false, sent: 1 }),
      }),
    );
  });
});
