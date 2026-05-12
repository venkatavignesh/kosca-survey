import { prisma } from '@/lib/db';
import { sendCampaignEmail } from '@/lib/campaign-mail';
import { audit, AUDIT_ACTIONS } from '@/lib/audit';
import { ApiError } from '@/lib/errors';

// Send invites or reminders for a campaign. Audited as a single CAMPAIGN_SEND
// event with the counters in metadata. Idempotent for invites (we only target
// people who haven't been mailed yet); reminders only target people we've
// already invited.

export type SendInput = {
  campaignId: string;
  assignmentIds?: string[];
  resend?: boolean;
  actorId: string;
  actorEmail: string;
};

export type SendResult = {
  sent: number;
  failed: { assignmentId: string; error: string }[];
};

export async function sendCampaign(input: SendInput): Promise<SendResult> {
  const campaign = await prisma.campaign.findUnique({ where: { id: input.campaignId } });
  if (!campaign) throw new ApiError(404, 'NOT_FOUND', 'campaign not found');

  const isReminder = !!input.resend;
  const where: any = {
    campaignId: input.campaignId,
    submittedAt: null,
  };
  if (input.assignmentIds && input.assignmentIds.length > 0) {
    where.id = { in: input.assignmentIds };
  }
  if (isReminder) where.emailSentAt = { not: null };
  else where.emailSentAt = null;

  const assignments = await prisma.campaignAssignment.findMany({
    where,
    include: { employee: true },
  });

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3002';

  if (campaign.status === 'DRAFT' && assignments.length > 0) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'ACTIVE' } });
  }

  const sent: string[] = [];
  const failed: SendResult['failed'] = [];

  for (const a of assignments) {
    try {
      await sendCampaignEmail({
        campaign: {
          id: campaign.id,
          title: campaign.title,
          emailSubjectTemplate: campaign.emailSubjectTemplate,
          emailBodyTemplate: campaign.emailBodyTemplate,
          deadline: campaign.deadline,
        },
        assignment: { id: a.id, token: a.token, employee: a.employee },
        appUrl,
        isReminder,
      });
      const now = new Date();
      if (isReminder) {
        await prisma.campaignAssignment.update({
          where: { id: a.id },
          data: { reminderCount: { increment: 1 }, lastReminderSentAt: now },
        });
      } else if (!a.emailSentAt) {
        await prisma.campaignAssignment.update({
          where: { id: a.id },
          data: { emailSentAt: now },
        });
      }
      sent.push(a.id);
    } catch (e: any) {
      failed.push({ assignmentId: a.id, error: e?.message || 'send failed' });
    }
  }

  await audit({
    action: AUDIT_ACTIONS.CAMPAIGN_SEND,
    userId: input.actorId,
    actorEmail: input.actorEmail,
    entityType: 'Campaign',
    entityId: campaign.id,
    metadata: { isReminder, sent: sent.length, failed: failed.length },
  });

  return { sent: sent.length, failed };
}
