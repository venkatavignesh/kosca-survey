import nodemailer from 'nodemailer';

// HTML-escape user-supplied values before splicing into email HTML so that
// names like `O'Brien & <Co>` render correctly and don't break the markup.
export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Wrap a body fragment in a full Outlook-compatible HTML document with a
// table-based 600px branded container. Use for ALL system emails.
//
// `appUrl` is needed to construct an absolute URL to the brand logo PNG
// (Outlook strips data: URIs, so the logo must be served by Next.js).
export function emailShell(innerHtml: string, title = 'Kosca', appUrl = ''): string {
  const logoSrc = appUrl ? `${appUrl}/kosca-logo.png` : '';
  const logoCell = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" width="36" height="36" alt="Kosca" border="0" style="display:block;border:0;outline:none;width:36px;height:36px;" />`
    : '';
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(title)}</title>
<!--[if mso]>
<style type="text/css">
  table, td, p, a { font-family: Arial, Helvetica, sans-serif !important; }
</style>
<xml>
  <o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings>
</xml>
<![endif]-->
</head>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f4f4f4" style="background:#f4f4f4;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(77,71,168,0.08);">
    <!-- Brand accent stripe -->
    <tr><td bgcolor="#4d47a8" height="4" style="background:#4d47a8;line-height:4px;font-size:4px;height:4px;">&nbsp;</td></tr>
    <!-- Header: Kosca logo + wordmark, centered on lavender tint -->
    <tr><td bgcolor="#f0eff9" align="center" style="background:#f0eff9;padding:20px 24px;border-bottom:1px solid #dddcf2;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
        <tr>
          ${logoCell ? `<td style="vertical-align:middle;padding-right:12px;">${logoCell}</td>` : ''}
          <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#4d47a8;line-height:1;letter-spacing:0.3px;">
            Kosca Distribution LLP
            <span style="margin:0 8px;color:#9188d4;font-weight:normal;">|</span>
            Survey
          </td>
        </tr>
      </table>
    </td></tr>
    <!-- Body -->
    <tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">
${innerHtml}
    </td></tr>
    <!-- Footer strip -->
    <tr><td bgcolor="#f0eff9" align="center" style="background:#f0eff9;padding:14px 24px;border-top:1px solid #dddcf2;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#4d47a8;">
      HR &mdash; <strong>Kosca Distribution LLP</strong>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// "Bulletproof" CTA button — works in Outlook desktop via VML and in modern
// clients via a table+bgcolor fallback. Centered inside its own row so any
// surrounding paragraphs fall below it cleanly (no float wrapping).
export function emailButton(href: string, label: string, color = '#4d47a8'): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:8px 0 20px;">
  <tr><td align="center">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="${color}">
      <w:anchorlock/>
      <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">${safeLabel} &rsaquo;</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${safeHref}" style="background:${color};border:1px solid ${color};border-radius:10px;color:#ffffff;display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;line-height:48px;text-align:center;text-decoration:none;padding:0 36px;-webkit-text-size-adjust:none;mso-hide:all;">${safeLabel} <span style="margin-left:6px;font-weight:normal;">&rsaquo;</span></a>
    <!--<![endif]-->
  </td></tr>
</table>`;
}

let cached: nodemailer.Transporter | null = null;

export function getTransport() {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' }
        : undefined,
    // Pool so concurrent OTP sends actually run in parallel up to maxConnections.
    pool: true,
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 5),
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 100),
    // Reasonable timeouts so a slow SMTP doesn't tie up a worker forever.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  return cached;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const from = process.env.SMTP_FROM || 'no-reply@example.com';
  const transport = getTransport();
  return transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

/**
 * Fire-and-forget send used for OTP / non-critical mail. Returns immediately.
 * Errors are logged server-side; the caller is expected to surface a generic
 * "we sent it, click 'send a new code' if it doesn't arrive" message.
 *
 * Safe in long-running Node containers (event loop keeps the promise alive).
 * Do NOT use this on serverless platforms (Vercel/Lambda) — the function may
 * be frozen before the send completes.
 */
export function sendMailFireAndForget(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  context?: string;
}) {
  sendMail(opts).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`[mailer] send failed${opts.context ? ' (' + opts.context + ')' : ''} to=${opts.to}:`, err?.message || err);
  });
}
