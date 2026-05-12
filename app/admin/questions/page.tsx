import { prisma } from '@/lib/db';
import { QuestionsClient } from './ui';

export default async function QuestionsPage() {
  const items = await prisma.question.findMany({ orderBy: { createdAt: 'desc' } });
  return <QuestionsClient questions={items.map((q) => ({
    ...q,
    options: (q.options as string[] | null) ?? null,
    createdAt: q.createdAt.toISOString(),
  }))} />;
}
