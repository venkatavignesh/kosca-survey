import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/dates';

export default async function HrCampaignDetail(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const c = await prisma.campaign.findUnique({
    where: { id },
    include: {
      _count: { select: { questions: true } },
      assignments: { include: { employee: { include: { location: true, officeType: true, department: true } } } },
    },
  });
  if (!c) return notFound();
  const submitted = c.assignments.filter((a) => a.submittedAt).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{c.title}</h1>
          <p className="text-sm text-[color:var(--text-secondary)] mt-1">
            <span className="badge mr-2">{c.status}</span>
            {submitted} / {c.assignments.length} submitted
            {c.deadline && <> · deadline {formatDate(c.deadline)}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`/hr/campaigns/${id}/questions`}>
            View questions ({c._count.questions})
          </Link>
          <Link className="btn-secondary" href={`/hr/campaigns/${id}/report`}>Report</Link>
          <Link className="btn" href={`/hr/campaigns/${id}/responses`}>View responses</Link>
        </div>
      </div>

      <div className="card overflow-x-auto space-y-3">
        <h2 className="text-lg font-semibold">Recipients</h2>
        <table className="table">
          <thead><tr><th>Emp. Code</th><th>Name</th><th>Group</th><th>Status</th></tr></thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {c.assignments.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-xs">{a.employee.empCode}</td>
                <td>{a.employee.name}</td>
                <td className="text-xs">{a.employee.location.name} › {a.employee.officeType.name} › {a.employee.department.name}</td>
                <td>
                  {a.submittedAt
                    ? <span className="badge pill-success">Submitted</span>
                    : a.confirmedAt ? <span className="badge pill-info">Confirmed</span>
                    : a.emailSentAt ? <span className="badge">Sent</span>
                    : <span className="badge">Pending</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
