import { describe, it, expect, vi, beforeEach } from 'vitest';

const { txCA, txCQ, txCQE, $transaction, auditFn } = vi.hoisted(() => {
  const txCA = { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() };
  const txCQ = { deleteMany: vi.fn(), create: vi.fn() };
  const txCQE = { createMany: vi.fn() };
  const $transaction = vi.fn(async (cb: any) => cb({
    campaignAssignment: txCA,
    campaignQuestion: txCQ,
    campaignQuestionEmployee: txCQE,
  }));
  return { txCA, txCQ, txCQE, $transaction, auditFn: vi.fn() };
});

vi.mock('@/lib/db', () => ({ prisma: { $transaction } }));
vi.mock('@/lib/audit', () => ({
  audit: auditFn,
  AUDIT_ACTIONS: { CAMPAIGN_ASSIGN: 'CAMPAIGN_ASSIGN' },
}));
vi.mock('@/lib/tokens', () => ({ generateToken: () => 'tok-static' }));
vi.mock('next/headers', () => ({ headers: () => ({ get: () => 'req-id' }) }));

import { syncCampaignAssignments } from './assignments';

beforeEach(() => {
  txCA.findMany.mockReset();
  txCA.create.mockReset();
  txCA.deleteMany.mockReset();
  txCQ.deleteMany.mockReset();
  txCQ.create.mockReset();
  txCQE.createMany.mockReset();
  auditFn.mockReset();
});

describe('syncCampaignAssignments', () => {
  it('creates assignments for new employees only (does not duplicate kept)', async () => {
    txCA.findMany.mockResolvedValueOnce([
      { id: 'a1', employeeId: 'e1', submittedAt: null },
    ]);
    txCQ.create.mockResolvedValue({ id: 'cq1' });

    const stats = await syncCampaignAssignments({
      campaignId: 'c1',
      employeeIds: ['e1', 'e2'],
      questions: [{ questionId: 'q1', order: 0, audience: 'ALL' as any }],
      actorId: 'u',
      actorEmail: 'a',
    });

    expect(txCA.create).toHaveBeenCalledTimes(1);
    expect(txCA.create.mock.calls[0][0].data.employeeId).toBe('e2');
    expect(stats).toMatchObject({ added: 1, removed: 0, kept: 1, questions: 1 });
  });

  it('removes only unsubmitted assignments when employee deselected', async () => {
    txCA.findMany.mockResolvedValueOnce([
      { id: 'a1', employeeId: 'e1', submittedAt: new Date() },
      { id: 'a2', employeeId: 'e2', submittedAt: null },
    ]);
    txCQ.create.mockResolvedValue({ id: 'cq1' });

    await syncCampaignAssignments({
      campaignId: 'c1',
      employeeIds: [],
      questions: [],
      actorId: 'u',
      actorEmail: 'a',
    });

    expect(txCA.deleteMany).toHaveBeenCalledOnce();
    expect(txCA.deleteMany.mock.calls[0][0]).toEqual({ where: { id: { in: ['a2'] } } });
  });

  it('replaces the question set and persists groupId + audience targets', async () => {
    txCA.findMany.mockResolvedValueOnce([]);
    txCQ.create
      .mockResolvedValueOnce({ id: 'cq1' })
      .mockResolvedValueOnce({ id: 'cq2' });

    await syncCampaignAssignments({
      campaignId: 'c1',
      employeeIds: ['e1', 'e2'],
      questions: [
        { questionId: 'q1', order: 0, audience: 'ALL' as any, groupId: 'g1' },
        { questionId: 'q2', order: 1, audience: 'SPECIFIC' as any, employeeIds: ['e1', 'eX'] },
      ],
      actorId: 'u',
      actorEmail: 'a',
    });

    expect(txCQ.deleteMany).toHaveBeenCalledOnce();
    expect(txCQE.createMany).toHaveBeenCalledOnce();
    const data = txCQE.createMany.mock.calls[0][0].data;
    expect(data).toEqual([{ campaignQuestionId: 'cq2', employeeId: 'e1' }]);
  });

  it('audits the sync with the resulting stats', async () => {
    txCA.findMany.mockResolvedValueOnce([]);
    txCQ.create.mockResolvedValue({ id: 'cq1' });

    await syncCampaignAssignments({
      campaignId: 'c1',
      employeeIds: ['e1'],
      questions: [{ questionId: 'q1', order: 0, audience: 'ALL' as any }],
      actorId: 'u',
      actorEmail: 'a',
    });

    expect(auditFn).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CAMPAIGN_ASSIGN',
        entityId: 'c1',
        metadata: expect.objectContaining({ added: 1, questions: 1 }),
      }),
    );
  });
});
