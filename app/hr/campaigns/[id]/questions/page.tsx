import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

export default async function HrCampaignQuestionsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const c = await prisma.campaign.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { question: true },
      },
    },
  });
  if (!c) return notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{c.title} · Questions</h1>
          <p className="text-sm text-[color:var(--text-secondary)] mt-1">{c.questions.length} question{c.questions.length === 1 ? '' : 's'} in this campaign</p>
        </div>
        <Link href={`/hr/campaigns/${id}`} className="btn-secondary">← Back to campaign</Link>
      </div>

      {c.questions.length === 0 ? (
        <div className="card text-sm text-[color:var(--text-muted)]">No questions assigned to this campaign yet.</div>
      ) : (
        <div className="space-y-3">
          {c.questions.map((cq, i) => {
            const q = cq.question;
            const opts = (q.options as string[] | null) || null;
            return (
              <div key={cq.id} className="card">
                <div className="text-xs text-[color:var(--text-muted)]">Question {i + 1} · {q.type}{q.required ? ' · required' : ''}</div>
                <div className="font-medium mt-1">{q.text} {q.required && <span className="text-[color:var(--error-text)]" title="Required">*</span>}</div>
                {opts && opts.length > 0 && (
                  <ul className="mt-3 list-disc pl-5 text-sm text-[color:var(--text-primary)] space-y-1">
                    {opts.map((o, j) => <li key={j}>{o}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
