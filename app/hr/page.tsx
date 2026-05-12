import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/dates';

export default async function HrDashboard() {
  const [campaigns, employeeCount, totalAssignments, totalResponses, activeCampaignCount] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { assignments: true, questions: true } },
        assignments: { select: { submittedAt: true } },
      },
    }),
    prisma.employee.count(),
    prisma.campaignAssignment.count(),
    prisma.response.count(),
    prisma.campaign.count({ where: { status: 'ACTIVE' } }),
  ]);

  const pending = totalAssignments - totalResponses;
  const overallPct = totalAssignments > 0 ? Math.round((totalResponses / totalAssignments) * 100) : 0;

  const stats = [
    { label: 'Employees', value: employeeCount, href: '/hr/employees' },
    { label: 'Active campaigns', value: activeCampaignCount, href: '/hr/campaigns' },
    { label: 'Submissions', value: totalResponses, href: '/hr/campaigns', sub: `${overallPct}% completion across all campaigns` },
    { label: 'Pending', value: pending, href: '/hr/campaigns', sub: pending > 0 ? `${pending} of ${totalAssignments} assignments` : 'All caught up' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">HR dashboard</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card hover:border-[var(--accent-primary)] hover:shadow-md transition-[border-color,box-shadow] group">
            <div className="text-sm font-semibold text-[color:var(--text-secondary)] group-hover:text-[color:var(--accent-primary)] transition-colors">{s.label}</div>
            <div className="text-3xl font-bold mt-1 text-[color:var(--text-primary)]">{s.value}</div>
            {s.sub && <div className="text-xs text-[color:var(--text-muted)] mt-1">{s.sub}</div>}
          </Link>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <h2 className="font-semibold p-3 border-b">Campaigns</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Questions</th>
              <th>Submitted</th>
              <th>Progress</th>
              <th>Deadline</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {campaigns.map((c) => {
              const submitted = c.assignments.filter((a) => a.submittedAt).length;
              const total = c._count.assignments;
              const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
              return (
                <tr key={c.id}>
                  <td><Link href={`/hr/campaigns/${c.id}`} className="hover:underline">{c.title}</Link></td>
                  <td><span className="badge">{c.status}</span></td>
                  <td>{c._count.questions}</td>
                  <td>{submitted} / {total}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded bg-[var(--border-primary)] overflow-hidden">
                        <div className="h-full bg-[var(--accent-primary)]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-[color:var(--text-secondary)] tabular-nums">{pct}%</span>
                    </div>
                  </td>
                  <td>{formatDate(c.deadline)}</td>
                  <td className="">
                    <Link href={`/hr/campaigns/${c.id}/responses`} className="text-sm hover:underline">Responses →</Link>
                  </td>
                </tr>
              );
            })}
            {campaigns.length === 0 && <tr><td colSpan={7} className="text-center text-[color:var(--text-muted)] py-6">No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
