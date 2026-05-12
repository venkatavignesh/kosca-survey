import { Audience } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateToken } from '@/lib/tokens';
import { audit, AUDIT_ACTIONS } from '@/lib/audit';

// Idempotent "set the recipients + question set for this campaign" operation.
// Existing assignments are preserved (so their tokens, emailSentAt etc stay
// valid); only newly-added employees get a fresh token, and only unsubmitted
// removals are deleted.

export type AssignmentQuestionInput = {
  questionId: string;
  order: number;
  audience: Audience;
  groupId?: string | null;
  employeeIds?: string[];
};

export type SyncAssignmentsInput = {
  campaignId: string;
  employeeIds: string[];
  questions: AssignmentQuestionInput[];
  actorId: string;
  actorEmail: string;
};

export async function syncCampaignAssignments(input: SyncAssignmentsInput) {
  const { campaignId, employeeIds, questions } = input;
  const empSet = new Set(employeeIds);

  const stats = { added: 0, removed: 0, kept: 0, questions: questions.length };

  await prisma.$transaction(async (tx) => {
    const existing = await tx.campaignAssignment.findMany({
      where: { campaignId },
      select: { id: true, employeeId: true, submittedAt: true },
    });
    const existingByEmp = new Map(existing.map((a) => [a.employeeId, a]));

    for (const empId of employeeIds) {
      if (!existingByEmp.has(empId)) {
        await tx.campaignAssignment.create({
          data: { campaignId, employeeId: empId, token: generateToken() },
        });
        stats.added += 1;
      } else {
        stats.kept += 1;
      }
    }
    const toRemove = existing.filter((a) => !empSet.has(a.employeeId) && !a.submittedAt);
    if (toRemove.length > 0) {
      await tx.campaignAssignment.deleteMany({ where: { id: { in: toRemove.map((x) => x.id) } } });
      stats.removed = toRemove.length;
    }

    // Question set is replaced wholesale — order and audience can change
    // arbitrarily on every save and the diff would be more code than it saves.
    await tx.campaignQuestion.deleteMany({ where: { campaignId } });
    for (const q of questions) {
      const cq = await tx.campaignQuestion.create({
        data: {
          campaignId,
          questionId: q.questionId,
          order: q.order,
          audience: q.audience,
          groupId: q.groupId ?? null,
        },
      });
      if (q.audience === Audience.SPECIFIC && q.employeeIds && q.employeeIds.length > 0) {
        await tx.campaignQuestionEmployee.createMany({
          data: q.employeeIds
            .filter((e) => empSet.has(e))
            .map((employeeId) => ({ campaignQuestionId: cq.id, employeeId })),
          skipDuplicates: true,
        });
      }
    }
  });

  await audit({
    action: AUDIT_ACTIONS.CAMPAIGN_ASSIGN,
    userId: input.actorId,
    actorEmail: input.actorEmail,
    entityType: 'Campaign',
    entityId: campaignId,
    metadata: stats,
  });

  return stats;
}
