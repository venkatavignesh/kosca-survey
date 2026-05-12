import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { SurveyForm } from './form';
import { formatDate } from '@/lib/dates';

export default async function SurveyFormPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const ck = await cookies();
  if (!ck.get(`survey_${token}`)) redirect(`/survey/${token}`);

  const a = await prisma.campaignAssignment.findUnique({
    where: { token },
    include: { campaign: true, employee: true },
  });
  if (!a) return notFound();
  if (a.submittedAt) redirect(`/survey/${token}/done`);

  const cqs = await prisma.campaignQuestion.findMany({
    where: { campaignId: a.campaignId },
    orderBy: { order: 'asc' },
    include: { question: true, targets: true },
  });
  const visible = cqs.filter((cq) => cq.audience === 'ALL' || cq.targets.some((t) => t.employeeId === a.employeeId));

  if (visible.length === 0) {
    return (
      <div className="card">
        <h1 className="text-xl font-semibold">{a.campaign.title}</h1>
        <p className="text-sm text-[color:var(--text-secondary)] mt-2">No questions are assigned to you in this campaign.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-semibold">{a.campaign.title}</h1>
        <p className="text-sm text-[color:var(--text-secondary)] mt-1">{a.employee.name} · {a.employee.empCode}</p>
        {a.campaign.description && <p className="text-sm text-[color:var(--text-primary)] mt-3 whitespace-pre-wrap">{a.campaign.description}</p>}
        {a.campaign.deadline && <p className="text-xs text-[color:var(--status-warn-text)] mt-2">Submit by {formatDate(a.campaign.deadline)}</p>}
      </div>
      <SurveyForm
        token={token}
        questions={visible.map((cq) => ({
          id: cq.question.id,
          text: cq.question.text,
          type: cq.question.type as any,
          options: (cq.question.options as string[] | null) || null,
          required: cq.question.required,
          allowText: cq.question.allowText,
          textRequired: cq.question.textRequired,
          textLabel: cq.question.textLabel,
        }))}
      />
    </div>
  );
}
