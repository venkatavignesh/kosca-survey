import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { CampaignEditForm } from './ui';
import { formatDateInputIso } from '@/lib/dates';

export default async function EditCampaignPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) return notFound();
  return (
    <CampaignEditForm
      id={c.id}
      title={c.title}
      description={c.description ?? ''}
      deadline={formatDateInputIso(c.deadline)}
      emailSubjectTemplate={c.emailSubjectTemplate}
      emailBodyTemplate={c.emailBodyTemplate}
      status={c.status}
    />
  );
}
