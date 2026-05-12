import { prisma } from '@/lib/db';
import { audit, AUDIT_ACTIONS } from '@/lib/audit';
import { ApiError } from '@/lib/errors';

// Service-layer entry points for the Campaign resource. Route handlers should
// import these instead of calling Prisma directly. Keeps business rules in one
// place (auditing, soft-delete guards, default values) and lets us unit-test
// without spinning up the HTTP stack.

export type CreateCampaignInput = {
  title: string;
  description?: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  deadline?: string | null;
  createdById: string;
  actorEmail: string;
};

export async function createCampaign(input: CreateCampaignInput) {
  const c = await prisma.campaign.create({
    data: {
      title: input.title,
      description: input.description,
      emailSubjectTemplate: input.emailSubjectTemplate,
      emailBodyTemplate: input.emailBodyTemplate,
      deadline: input.deadline ? new Date(input.deadline) : null,
      createdById: input.createdById,
    },
  });
  await audit({
    action: AUDIT_ACTIONS.CAMPAIGN_CREATE,
    userId: input.createdById,
    actorEmail: input.actorEmail,
    entityType: 'Campaign',
    entityId: c.id,
    metadata: { title: c.title },
  });
  return c;
}

export type UpdateCampaignInput = {
  id: string;
  patch: Partial<{
    title: string;
    description: string;
    emailSubjectTemplate: string;
    emailBodyTemplate: string;
    status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
    deadline: string | null;
  }>;
  actorId: string;
  actorEmail: string;
};

export async function updateCampaign(input: UpdateCampaignInput) {
  const data: any = { ...input.patch };
  if ('deadline' in input.patch) {
    data.deadline = input.patch.deadline ? new Date(input.patch.deadline) : null;
  }
  try {
    const c = await prisma.campaign.update({ where: { id: input.id }, data });
    await audit({
      action: AUDIT_ACTIONS.CAMPAIGN_UPDATE,
      userId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: 'Campaign',
      entityId: c.id,
      metadata: input.patch,
    });
    return c;
  } catch (e: any) {
    if (e?.code === 'P2025') throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
    throw e;
  }
}

// Clone an existing campaign: copy email templates, questions, groups, and
// per-question audience targets — but NOT assignments or responses. The new
// campaign always lands in DRAFT with a null deadline so the admin can review
// and dispatch it on their own schedule.
export type CloneCampaignInput = {
  sourceId: string;
  newTitle?: string;            // defaults to "<source title> (copy)"
  actorId: string;
  actorEmail: string;
};

export async function cloneCampaign(input: CloneCampaignInput) {
  const source = await prisma.campaign.findUnique({
    where: { id: input.sourceId },
    include: {
      questionGroups: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
      questions: {
        orderBy: { order: 'asc' },
        include: { targets: true },
      },
    },
  });
  if (!source) throw new ApiError(404, 'NOT_FOUND', 'Source campaign not found');

  // Pick a unique title — Postgres has no unique constraint here, but a clear
  // suffix is helpful and "(copy)" / "(copy 2)" matches user expectations.
  const baseTitle = (input.newTitle?.trim() || `${source.title} (copy)`).slice(0, 200);
  const existing = await prisma.campaign.findMany({
    where: { title: { startsWith: baseTitle } },
    select: { title: true },
  });
  let title = baseTitle;
  let n = 2;
  const taken = new Set(existing.map((c) => c.title));
  while (taken.has(title)) title = `${baseTitle} ${n++}`;

  const clone = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        title,
        description: source.description,
        emailSubjectTemplate: source.emailSubjectTemplate,
        emailBodyTemplate: source.emailBodyTemplate,
        status: 'DRAFT',
        deadline: null,
        createdById: input.actorId,
      },
    });

    // Groups: create new rows; remember old→new id mapping so questions land
    // in the right group on the new campaign.
    const groupIdMap = new Map<string, string>();
    for (const g of source.questionGroups) {
      const created = await tx.campaignQuestionGroup.create({
        data: { campaignId: campaign.id, name: g.name, order: g.order },
      });
      groupIdMap.set(g.id, created.id);
    }

    for (const cq of source.questions) {
      const newCq = await tx.campaignQuestion.create({
        data: {
          campaignId: campaign.id,
          questionId: cq.questionId,
          order: cq.order,
          audience: cq.audience,
          groupId: cq.groupId ? groupIdMap.get(cq.groupId) ?? null : null,
        },
      });
      if (cq.targets.length > 0) {
        await tx.campaignQuestionEmployee.createMany({
          data: cq.targets.map((t) => ({ campaignQuestionId: newCq.id, employeeId: t.employeeId })),
          skipDuplicates: true,
        });
      }
    }

    return campaign;
  });

  await audit({
    action: AUDIT_ACTIONS.CAMPAIGN_CLONE,
    userId: input.actorId,
    actorEmail: input.actorEmail,
    entityType: 'Campaign',
    entityId: clone.id,
    metadata: {
      sourceId: source.id,
      questionsCopied: source.questions.length,
      groupsCopied: source.questionGroups.length,
    },
  });

  return clone;
}

export async function deleteCampaign(id: string, actorId: string, actorEmail: string) {
  try {
    await prisma.campaign.delete({ where: { id } });
    await audit({
      action: AUDIT_ACTIONS.CAMPAIGN_DELETE,
      userId: actorId,
      actorEmail,
      entityType: 'Campaign',
      entityId: id,
    });
  } catch (e: any) {
    if (e?.code === 'P2025') throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
    throw e;
  }
}
