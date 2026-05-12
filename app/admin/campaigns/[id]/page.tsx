import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { RecipientsBuilder } from './ui';
import { formatDate } from '@/lib/dates';

export default async function CampaignPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      assignments: true,
      questions: { include: { targets: true }, orderBy: { order: 'asc' } },
    },
  });
  if (!campaign) return notFound();

  const [employees, locations, officeTypes, departments] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { empCode: 'asc' },
      include: { location: true, officeType: true, department: true },
    }),
    prisma.location.findMany({ orderBy: { name: 'asc' } }),
    prisma.officeType.findMany({ orderBy: { name: 'asc' } }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const totalSubmitted = campaign.assignments.filter((a) => a.submittedAt).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{campaign.title}</h1>
          <p className="text-sm text-[color:var(--text-secondary)]">
            <span className="badge mr-2">{campaign.status}</span>
            {totalSubmitted} / {campaign.assignments.length} submitted
            · {campaign.questions.length} question{campaign.questions.length === 1 ? '' : 's'}
            {campaign.deadline && <> · deadline {formatDate(campaign.deadline)}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`/admin/campaigns/${campaign.id}/edit`}>Edit settings</Link>
          <Link className="btn-secondary" href={`/admin/campaigns/${campaign.id}/questions`}>Manage questions</Link>
          <Link className="btn-secondary" href={`/admin/campaigns/${campaign.id}/report`}>Report</Link>
          <Link className="btn" href={`/admin/campaigns/${campaign.id}/responses`}>View responses</Link>
        </div>
      </div>

      <RecipientsBuilder
        campaign={{
          id: campaign.id,
          title: campaign.title,
          status: campaign.status,
          assignments: campaign.assignments.map((a) => ({
            id: a.id,
            employeeId: a.employeeId,
            emailSentAt: a.emailSentAt?.toISOString() ?? null,
            emailOpenedAt: a.emailOpenedAt?.toISOString() ?? null,
            submittedAt: a.submittedAt?.toISOString() ?? null,
            confirmedAt: a.confirmedAt?.toISOString() ?? null,
            reminderCount: a.reminderCount,
            lastReminderSentAt: a.lastReminderSentAt?.toISOString() ?? null,
          })),
          questions: campaign.questions.map((cq) => ({
            id: cq.id,
            questionId: cq.questionId,
            order: cq.order,
            audience: cq.audience,
            targetEmployeeIds: cq.targets.map((t) => t.employeeId),
          })),
        }}
        employees={employees.map((e) => ({
          id: e.id,
          empCode: e.empCode,
          name: e.name,
          email: e.email,
          designation: e.designation,
          location: e.location,
          officeType: e.officeType,
          department: e.department,
        }))}
        locations={locations}
        officeTypes={officeTypes}
        departments={departments}
      />
    </div>
  );
}
