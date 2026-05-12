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
