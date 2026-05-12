import { describe, it, expect, vi } from 'vitest';

const { sendMailMock, createTransportMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  createTransportMock: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (cfg: any) => {
      createTransportMock(cfg);
      return { sendMail: sendMailMock };
    },
  },
}));

import { escapeHtml, emailShell, emailButton, sendMail, sendMailFireAndForget } from './mailer';

describe('escapeHtml', () => {
  it('replaces all five entity characters', () => {
    expect(escapeHtml(`O'Brien & <Co> "ltd"`)).toBe(
      'O&#39;Brien &amp; &lt;Co&gt; &quot;ltd&quot;',
    );
  });
  it('treats null/undefined as empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
  it('coerces non-strings to string', () => {
    expect(escapeHtml(42 as any)).toBe('42');
  });
});

describe('emailShell', () => {
  it('wraps the body in a 600px table layout', () => {
    const html = emailShell('<p>hi</p>', 'Subject', 'http://h');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<p>hi</p>');
    expect(html).toContain('http://h/kosca-logo.png');
  });
  it('omits the logo cell when appUrl is empty', () => {
    const html = emailShell('<p>hi</p>', 'Subject');
    expect(html).not.toContain('kosca-logo.png');
  });
  it('html-escapes the title', () => {
    expect(emailShell('', '<bad>')).toContain('&lt;bad&gt;');
  });
});

describe('emailButton', () => {
  it('produces both the MSO and modern fallbacks', () => {
    const html = emailButton('http://h/go', 'Go');
    expect(html).toContain('v:roundrect');
    expect(html).toContain('href="http://h/go"');
    expect(html).toContain('Go');
  });
  it('escapes href + label', () => {
    expect(emailButton('"javascript:bad"', '<b>')).toContain('&lt;b&gt;');
  });
});

describe('sendMail / sendMailFireAndForget', () => {
  it('builds a transporter with env-driven host/port/auth', async () => {
    process.env.SMTP_HOST = 'mail.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    process.env.SMTP_FROM = 'no@reply';
    sendMailMock.mockResolvedValueOnce({ accepted: ['a@b'] });
    await sendMail({ to: 'a@b', subject: 's', text: 't' });
    const cfg = createTransportMock.mock.calls[0][0];
    expect(cfg.host).toBe('mail.example.com');
    expect(cfg.port).toBe(587);
    expect(cfg.auth).toEqual({ user: 'u', pass: 'p' });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'no@reply', to: 'a@b' }),
    );
  });

  it('sendMailFireAndForget never throws on send failure', () => {
    sendMailMock.mockRejectedValueOnce(new Error('smtp down'));
    expect(() => sendMailFireAndForget({ to: 'x', subject: 's', text: 't' })).not.toThrow();
  });
});
