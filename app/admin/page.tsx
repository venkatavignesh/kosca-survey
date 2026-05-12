import Link from 'next/link';
import { prisma } from '@/lib/db';
import { SortLink } from '@/components/SortLink';
import { formatDate } from '@/lib/dates';

export default async function AdminDashboard() {
  const [campaignCount, employeeCount, questionCount, recent] = await Promise.all([
    prisma.campaign.count(),
    prisma.employee.count(),
    prisma.question.count(),
    prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { _count: { select: { assignments: true } } },
    }),
  ]);

  const stats = [
    { label: 'Campaigns', value: campaignCount, href: '/admin/campaigns' },
    { label: 'Employees', value: employeeCount, href: '/admin/employees' },
    { label: 'Questions', value: questionCount, href: '/admin/questions' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin dashboard</h1>
        <Link className="btn" href="/admin/campaigns/new">New campaign</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card hover:border-[var(--accent-primary)] hover:shadow-md transition-[border-color,box-shadow] group">
            <div className="text-sm font-semibold text-[color:var(--text-secondary)] group-hover:text-[color:var(--accent-primary)] transition-colors">{s.label}</div>
            <div className="text-3xl font-bold mt-1 text-[color:var(--text-primary)]">{s.value}</div>
          </Link>
        ))}
      </div>
      <div className="card">
        <h2 className="font-semibold mb-3">Recent campaigns</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">No campaigns yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th><SortLink basePath="/admin/campaigns" field="title" label="Title" current={{}} /></th>
                <th><SortLink basePath="/admin/campaigns" field="status" label="Status" current={{}} /></th>
                <th><SortLink basePath="/admin/campaigns" field="submitted" label="Assignments" current={{}} /></th>
                <th><SortLink basePath="/admin/campaigns" field="createdAt" label="Created" current={{}} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {recent.map((c) => (
                <tr key={c.id}>
                  <td><Link className="text-[color:var(--text-primary)] hover:underline" href={`/admin/campaigns/${c.id}`}>{c.title}</Link></td>
                  <td><span className="badge">{c.status}</span></td>
                  <td>{c._count.assignments}</td>
                  <td>{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
