import { prisma } from '@/lib/db';
import { formatDate, formatDateTime } from '@/lib/dates';
import { AnswersList, type AnswerCard } from './AnswersList';

export async function renderEmployeeResponse({ campaignId, employeeId }: { campaignId: string; employeeId: string }) {
  const a = await prisma.campaignAssignment.findUnique({
    where: { campaignId_employeeId: { campaignId, employeeId } },
    include: {
      campaign: true,
      employee: { include: { location: true, officeType: true, department: true } },
      response: { include: { answers: true } },
    },
  });
  if (!a) return null;
  const cqs = await prisma.campaignQuestion.findMany({
    where: { campaignId },
    orderBy: { order: 'asc' },
    include: { question: true, targets: true },
  });
  const visible = cqs.filter((cq) => cq.audience === 'ALL' || cq.targets.some((t) => t.employeeId === employeeId));
  const ansMap = new Map((a.response?.answers || []).map((x) => [x.questionId, x]));

  const cards: AnswerCard[] = visible.map((cq) => {
    const ans = ansMap.get(cq.questionId);
    return {
      id: cq.id,
      questionText: cq.question.text,
      type: cq.question.type as AnswerCard['type'],
      required: cq.question.required,
      allowText: cq.question.allowText,
      valueText: ans?.valueText ?? null,
      valueOptions: (ans?.valueOptions as string[] | null) ?? null,
      hasAnswer: !!ans,
    };
  });

  return (
    <div className="space-y-4">
      {/* Identity / status header */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--accent-primary)' }}>
              Response
            </p>
            <h1 className="text-2xl font-bold tracking-tight mt-1" style={{ color: 'var(--text-primary)' }}>
              {a.campaign.title}
            </h1>
          </div>
          {a.submittedAt
            ? <span className="badge pill-success" title={formatDateTime(a.submittedAt)}>Submitted {formatDate(a.submittedAt)}</span>
            : <span className="badge pill-warn">Not yet submitted</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <Meta label="Employee">
            <span className="font-semibold">{a.employee.name}</span>
            <span className="ml-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{a.employee.empCode}</span>
          </Meta>
          <Meta label="Designation">{a.employee.designation || '—'}</Meta>
          <Meta label="Group">
            {a.employee.location.name} <span style={{ color: 'var(--text-muted)' }}>›</span>{' '}
            {a.employee.officeType.name} <span style={{ color: 'var(--text-muted)' }}>›</span>{' '}
            {a.employee.department.name}
          </Meta>
        </div>

        {a.campaign.deadline && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Deadline: {formatDate(a.campaign.deadline)}
          </p>
        )}
      </div>

      <AnswersList cards={cards} />
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)' }}>{children}</div>
    </div>
  );
}
