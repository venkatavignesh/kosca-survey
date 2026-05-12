import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendCampaignEmail } from '@/lib/campaign-mail';

export const dynamic = 'force-dynamic';

const REMINDER_DEBOUNCE_HOURS = 23;

/**
 * Daily reminder cron endpoint.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` header. Lives outside
 * proxy.ts auth matcher (which only covers /admin /hr /account paths).
 *
 * Runs once daily at 09:30 IST via the kosca_survey_cron sidecar container.
 *
 * Idempotent: a 23h debounce on `lastAutoReminderAt` makes safe to retry. The
 * debounce reads ONLY `lastAutoReminderAt` (not `lastReminderSentAt`), so a
 * manual reminder fired earlier in the day does not stop the cron from
 * firing — admin's deliberate action is respected, automatic cadence stays
 * undisturbed (see plan §2 bookkeeping table).
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization') || '';
  const got = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (got !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Eligible campaigns: ACTIVE and either no deadline or deadline in the future.
  // (CLOSED / DRAFT campaigns are excluded; deleted campaigns don't exist in the table.)
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ deadline: null }, { deadline: { gt: now } }],
    },
  });

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3002';
  const cutoff = new Date(now.getTime() - REMINDER_DEBOUNCE_HOURS * 60 * 60 * 1000);

  let remindersSent = 0;
  const failed: { assignmentId: string; error: string }[] = [];

  for (const campaign of campaigns) {
    // Eligible recipients: invited at least 24h ago, not submitted, debounced
    // 23h since last AUTO reminder. Same-day invitees are deliberately excluded
    // — a reminder must NEVER cluster with the initial invite.
    const recipients = await prisma.campaignAssignment.findMany({
      where: {
        campaignId: campaign.id,
        submittedAt: null,
        emailSentAt: { not: null, lt: cutoff },
        OR: [
          { lastAutoReminderAt: null },
          { lastAutoReminderAt: { lt: cutoff } },
        ],
      },
      include: { employee: true },
    });

    for (const a of recipients) {
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
          isReminder: true,
        });
        const stamp = new Date();
        await prisma.campaignAssignment.update({
          where: { id: a.id },
          data: {
            reminderCount: { increment: 1 },
            lastReminderSentAt: stamp,
            lastAutoReminderAt: stamp,
          },
        });
        remindersSent++;
      } catch (e: any) {
        // Log + continue — one bad recipient must not block the rest of the campaign.
        // eslint-disable-next-line no-console
        console.error(`[cron/daily-reminders] send failed assignment=${a.id}:`, e?.message || e);
        failed.push({ assignmentId: a.id, error: e?.message || 'send failed' });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    campaignsProcessed: campaigns.length,
    remindersSent,
    failed,
    ranAt: now.toISOString(),
  });
}
