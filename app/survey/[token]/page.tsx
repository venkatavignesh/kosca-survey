import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { ConfirmForm } from './confirm-form';

export default async function SurveyEntry(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const a = await prisma.campaignAssignment.findUnique({
    where: { token },
    include: { campaign: true, employee: true },
  });
  if (!a) return notFound();
  if (a.submittedAt) redirect(`/survey/${token}/done`);

  const ck = await cookies();
  if (ck.get(`survey_${token}`)) redirect(`/survey/${token}/form`);

  // Mask email for display
  const [u, d] = a.employee.email.split('@');
  const masked = !u || !d
    ? a.employee.email
    : (u.length <= 2 ? u[0] + '*' : u[0] + '*'.repeat(Math.max(1, u.length - 2)) + u[u.length - 1]) + '@' + d;

  return (
    <div className="card overflow-hidden !p-0" style={{ borderColor: 'var(--border-primary)' }}>
      {/* Brand accent stripe */}
      <div className="h-1" style={{ background: 'var(--accent-primary)' }} />

      <div className="p-6 md:p-8 space-y-5">
        <div>
          <p className="text-[11px] uppercase font-bold tracking-wider" style={{ color: 'var(--accent-primary)' }}>
            Verify your identity
          </p>
          <h1 className="text-2xl font-bold tracking-tight mt-1" style={{ color: 'var(--text-primary)' }}>
            {a.campaign.title}
          </h1>
        </div>

        <div
          className="rounded-lg p-4 text-sm"
          style={{ background: 'var(--surface-tertiary)', color: 'var(--text-secondary)' }}
        >
          To confirm it's you, we'll email a one-time verification code to{' '}
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{masked}</span>.
        </div>

        <ConfirmForm token={token} maskedEmail={masked} />
      </div>
    </div>
  );
}
