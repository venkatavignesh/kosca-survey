import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { sendCampaignEmail } from '@/lib/campaign-mail';

const Body = z.object({
  assignmentIds: z.array(z.string()).optional(),
  resend: z.boolean().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id: campaignId } = await ctx.params;
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json || {});
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 });

  const isReminder = !!parsed.data.resend;

  const where: any = { campaignId };
  if (parsed.data.assignmentIds && parsed.data.assignmentIds.length > 0) {
    where.id = { in: parsed.data.assignmentIds };
  }
  // First-time invite: only people who've never been emailed AND haven't submitted.
  // Reminder: only people who HAVE been invited and haven't submitted — we won't
  // remind someone we never invited; submitters are always skipped.
  where.submittedAt = null;
  if (isReminder) {
    where.emailSentAt = { not: null };
  } else {
    where.emailSentAt = null;
  }

  const assignments = await prisma.campaignAssignment.findMany({
    where,
    include: { employee: true },
  });

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3002';
  const sent: string[] = [];
  const failed: { assignmentId: string; error: string }[] = [];

  // mark active on first send
  if (campaign.status === 'DRAFT' && assignments.length > 0) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE' } });
  }

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
      // Bookkeeping per plan §2:
      //  - manual invite (isReminder=false) only stamps emailSentAt (and only if it's null).
      //  - manual reminder (isReminder=true) bumps reminderCount + lastReminderSentAt
      //    but leaves lastAutoReminderAt untouched so the cron's 23h debounce
      //    is unaffected by manual sends.
      const now = new Date();
      if (isReminder) {
        await prisma.campaignAssignment.update({
          where: { id: a.id },
          data: {
            reminderCount: { increment: 1 },
            lastReminderSentAt: now,
          },
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

  return NextResponse.json({ sent: sent.length, failed });
}
