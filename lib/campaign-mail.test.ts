import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }));

vi.mock('./mailer', () => ({
  sendMail: sendMailMock,
  emailShell: (body: string, subject: string, appUrl: string) =>
    `<html><body data-subject="${subject}" data-app-url="${appUrl}">${body}</body></html>`,
  emailButton: (url: string, label: string) => `<a href="${url}">${label}</a>`,
  escapeHtml: (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
}));

import { sendCampaignEmail } from './campaign-mail';

beforeEach(() => sendMailMock.mockReset());

const camp = (overrides: any = {}) => ({
  id: 'c1',
  title: 'Annual survey',
  emailSubjectTemplate: 'Hi {{name}} — {{title}}',
  emailBodyTemplate: 'Hello {{name}},\n\nPlease complete by {{deadline}}.',
  deadline: new Date('2026-12-31T00:00:00Z'),
  ...overrides,
});
const asg = () => ({
  id: 'a1',
  token: 'tok-XYZ',
  employee: { name: 'Alice', empCode: 'E1', designation: 'Dev', email: 'alice@x' },
});

describe('sendCampaignEmail', () => {
  it('renders the subject and body using template vars', async () => {
    await sendCampaignEmail({ campaign: camp(), assignment: asg(), appUrl: 'http://h', isReminder: false });
    const args = sendMailMock.mock.calls[0][0];
    expect(args.to).toBe('alice@x');
    expect(args.subject).toBe('Hi Alice — Annual survey');
    expect(args.text).toContain('Hello Alice');
    expect(args.text).toContain('http://h/survey/tok-XYZ');
  });

  it('injects a reminder banner only when isReminder=true', async () => {
    await sendCampaignEmail({ campaign: camp(), assignment: asg(), appUrl: 'http://h', isReminder: false });
    expect(sendMailMock.mock.calls[0][0].html).not.toContain('Reminder.');
    sendMailMock.mockReset();
    await sendCampaignEmail({ campaign: camp(), assignment: asg(), appUrl: 'http://h', isReminder: true });
    expect(sendMailMock.mock.calls[0][0].html).toContain('Reminder.');
    expect(sendMailMock.mock.calls[0][0].text.startsWith('Reminder:')).toBe(true);
  });

  it('emits a tracking pixel pointing at /api/track/open/<token>', async () => {
    await sendCampaignEmail({ campaign: camp(), assignment: asg(), appUrl: 'http://h', isReminder: false });
    expect(sendMailMock.mock.calls[0][0].html).toContain('/api/track/open/tok-XYZ');
  });

  it('formats deadline through the date helper', async () => {
    await sendCampaignEmail({ campaign: camp(), assignment: asg(), appUrl: 'http://h', isReminder: false });
    expect(sendMailMock.mock.calls[0][0].subject).toContain('Annual');
    // body text contains the formatted DD-MON-YYYY
    expect(sendMailMock.mock.calls[0][0].text).toMatch(/\d{2}-[A-Z]{3}-\d{4}/);
  });

  it('handles null deadline by emitting empty placeholder', async () => {
    await sendCampaignEmail({
      campaign: camp({ deadline: null }),
      assignment: asg(),
      appUrl: 'http://h',
      isReminder: false,
    });
    expect(sendMailMock.mock.calls[0][0].text).toContain('Please complete by .');
  });

  it('escapes HTML in the body', async () => {
    await sendCampaignEmail({
      campaign: camp({ emailBodyTemplate: 'Hi <b>boss</b> {{name}}' }),
      assignment: asg(),
      appUrl: 'http://h',
      isReminder: false,
    });
    expect(sendMailMock.mock.calls[0][0].html).toContain('Hi &lt;b&gt;boss&lt;/b&gt; Alice');
  });
});
