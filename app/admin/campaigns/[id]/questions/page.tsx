import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { QuestionsBuilder } from './ui';

export default async function CampaignQuestionsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      assignments: { select: { employeeId: true } },
      questions: { include: { targets: true }, orderBy: { order: 'asc' } },
      questionGroups: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  if (!campaign) return notFound();

  const questions = await prisma.question.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{campaign.title} · Questions</h1>
          <p className="text-sm text-[color:var(--text-secondary)]">
            {campaign.questions.length} question{campaign.questions.length === 1 ? '' : 's'} attached · {questions.length - campaign.questions.length} available in the bank
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`/admin/campaigns/${campaign.id}`}>← Back to recipients</Link>
        </div>
      </div>

      <QuestionsBuilder
        campaignId={campaign.id}
        savedEmployeeIds={campaign.assignments.map((a) => a.employeeId)}
        savedQuestions={campaign.questions.map((cq) => ({
          id: cq.id,
          questionId: cq.questionId,
          order: cq.order,
          audience: cq.audience,
          groupId: cq.groupId,
          targetEmployeeIds: cq.targets.map((t) => t.employeeId),
        }))}
        savedGroups={campaign.questionGroups.map((g) => ({ id: g.id, name: g.name, order: g.order }))}
        questions={questions.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type as any,
          options: (q.options as string[] | null) || null,
          required: q.required,
        }))}
      />
    </div>
  );
}
