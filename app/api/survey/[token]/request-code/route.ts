import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateConfirmCode } from '@/lib/tokens';
import { sendMailFireAndForget, emailShell, escapeHtml } from '@/lib/mailer';

const CODE_TTL_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 30;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const a = await prisma.campaignAssignment.findUnique({
    where: { token },
    include: { employee: true, campaign: true },
  });
  if (!a) return NextResponse.json({ error: 'invalid link' }, { status: 404 });
  if (a.submittedAt) return NextResponse.json({ error: 'already submitted' }, { status: 410 });

  // Cooldown to prevent abuse
  if (a.confirmCodeSentAt) {
    const elapsed = Date.now() - a.confirmCodeSentAt.getTime();
    if (elapsed < RESEND_COOLDOWN_SECONDS * 1000) {
      const wait = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - elapsed) / 1000);
      return NextResponse.json({ error: `please wait ${wait}s before requesting another code` }, { status: 429 });
    }
  }

  const code = generateConfirmCode();
  await prisma.campaignAssignment.update({
    where: { id: a.id },
    data: {
      emailConfirmCode: code,
      confirmCodeSentAt: new Date(),
      confirmAttempts: 0,
      openedAt: a.openedAt ?? new Date(),
    },
  });

  const mask = (e: string) => {
    const [u, d] = e.split('@');
    if (!u || !d) return e;
    const masked = u.length <= 2 ? u[0] + '*' : u[0] + '*'.repeat(Math.max(1, u.length - 2)) + u[u.length - 1];
    return `${masked}@${d}`;
  };

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || '';

  // Fire-and-forget: don't make the user wait for SMTP. They get an instant
  // "code sent" response; if it doesn't arrive they can hit "Send a new code".
  sendMailFireAndForget({
    to: a.employee.email,
    subject: `Verification code for ${a.employee.name} (${a.employee.empCode}) · ${a.campaign.title}`,
    text: `Hi ${a.employee.name} (Emp Code: ${a.employee.empCode}),\n\nYour one-time verification code is: ${code}\n\nIt expires in ${CODE_TTL_MINUTES} minutes. Enter it in the survey page to continue.\n\nIf this code wasn't intended for you, ignore the email.`,
    html: emailShell(
      `<p style="margin:0 0 4px;">Hi ${escapeHtml(a.employee.name)},</p>
<p style="margin:0 0 16px;font-size:13px;color:#4b5563;">Emp Code: <span style="font-family:Consolas,'Courier New',monospace;color:#1a1a1a;">${escapeHtml(a.employee.empCode)}</span></p>
<p style="margin:0;">Your one-time verification code:</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;">
  <tr><td align="center" style="padding:24px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;padding:16px 28px;font-family:Consolas,'Courier New',monospace;font-size:30px;font-weight:bold;letter-spacing:8px;color:#1a1a1a;border:1px solid #e5e7eb;border-radius:8px;">${escapeHtml(code)}</td></tr>
    </table>
  </td></tr>
</table>
<p style="margin:0;font-size:13px;color:#4b5563;text-align:center;">Expires in ${CODE_TTL_MINUTES} minutes. If this code wasn't intended for you, ignore this email.</p>`,
      `Your verification code for ${a.campaign.title}`,
      appUrl,
    ),
    context: `otp/${a.id}`,
  });

  return NextResponse.json({ ok: true, sentTo: mask(a.employee.email), ttlMinutes: CODE_TTL_MINUTES });
}
