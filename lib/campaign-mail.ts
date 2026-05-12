import { sendMail, emailShell, emailButton, escapeHtml } from './mailer';
import { renderTemplate } from './templates';
import { formatDate } from './dates';

/**
 * One source of truth for campaign-related email construction. Used by:
 *  - the manual invite / manual reminder route (POST /api/admin/campaigns/[id]/send)
 *  - the daily-reminder cron (POST /api/cron/daily-reminders)
 *
 * Pure: builds and sends one email. Does NOT mutate the database — counter
 * bookkeeping (emailSentAt / reminderCount / lastReminderSentAt /
 * lastAutoReminderAt) is the caller's responsibility so that manual and
 * automatic flows stay independent (see plan §2 bookkeeping table).
 *
 * `isReminder=true` injects a lavender REMINDER banner above the rendered
 * body. Subject is left identical so the reminder threads naturally with the
 * original invite in the recipient's inbox.
 */

export type CampaignForEmail = {
  id: string;
  title: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  deadline: Date | null;
};

export type AssignmentForEmail = {
  id: string;
  token: string;
  employee: {
    name: string;
    empCode: string;
    designation: string;
    email: string;
  };
};

export async function sendCampaignEmail(opts: {
  campaign: CampaignForEmail;
  assignment: AssignmentForEmail;
  appUrl: string;
  isReminder: boolean;
}): Promise<void> {
  const { campaign, assignment: a, appUrl, isReminder } = opts;
  const url = `${appUrl}/survey/${a.token}`;
  const vars = {
    name: a.employee.name,
    empCode: a.employee.empCode,
    designation: a.employee.designation,
    email: a.employee.email,
    url,
    title: campaign.title,
    deadline: campaign.deadline ? formatDate(campaign.deadline) : '',
  };
  const subject = renderTemplate(campaign.emailSubjectTemplate, vars);
  const bodyText = renderTemplate(campaign.emailBodyTemplate, vars);

  // Convert plain-text body to HTML paragraphs (blank line = paragraph break,
  // single \n → <br/>). Keeps reminder + invite emails visually consistent.
  const safeBody = bodyText
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p style="margin:0 0 12px;">${escapeHtml(para).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  // Lavender callout, only when this is a reminder. Same banner whether the
  // reminder was triggered manually by an admin or by the daily cron.
  // Outer single-cell table gives a reliable 24-px bottom spacer (Outlook
  // ignores margin on tables but honors padding on td). Inner content cell
  // uses border-left for the accent stripe — proven to render continuously
  // in Gmail / Outlook / Apple Mail unlike a 2-cell width="4" trick which
  // collapses in Gmail.
  const reminderBanner = isReminder
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
  <tr><td style="padding:0 0 24px 0;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#fef2f2" style="background:#fef2f2;">
      <tr>
        <td style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#991b1b;">
          <strong>Reminder.</strong> You haven't completed this survey yet &mdash; please take a few minutes when you get a chance.
        </td>
      </tr>
    </table>
  </td></tr>
</table>`
    : '';

  // 1×1 PNG tracking pixel — fires emailOpenedAt on first hit (see /api/track/open/[token]).
  const trackingPixel = `<img src="${escapeHtml(`${appUrl}/api/track/open/${a.token}`)}" alt="" width="1" height="1" border="0" style="display:block;border:0;outline:none;height:1px;width:1px;line-height:1px;" />`;

  const html = emailShell(
    `${reminderBanner}${safeBody}
${emailButton(url, 'Open survey')}
<p style="margin:0 0 24px;font-size:13px;color:#4b5563;text-align:center;">When you open the survey, we'll email you a one-time verification code to confirm it's you.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0;border-top:1px solid #e5e7eb;">
  <tr><td style="padding:16px 0 0;font-size:12px;color:#6b7280;text-align:center;">
    Button not working? Paste this link:<br/>
    <a href="${escapeHtml(url)}" style="color:#4d47a8;word-break:break-all;text-decoration:underline;">${escapeHtml(url)}</a>
  </td></tr>
</table>
${trackingPixel}`,
    subject,
    appUrl,
  );

  // Plain-text alternative — prepend a "Reminder" line for non-HTML clients.
  const textPrefix = isReminder ? `Reminder: you haven't completed this survey yet.\n\n` : '';
  const text = `${textPrefix}${bodyText}\n\nOpen the survey: ${url}\n\nWhen you open it, we'll email you a one-time verification code to confirm it's you.`;

  await sendMail({ to: a.employee.email, subject, text, html });
}
