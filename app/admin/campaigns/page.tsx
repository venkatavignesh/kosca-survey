import Link from 'next/link';
import { prisma } from '@/lib/db';
import { SortLink, type SortDir } from '@/components/SortLink';
import { UrlPaginationStats, UrlPaginationNav } from '@/components/UrlPagination';
import { clampPage, clampPerPage } from '@/components/pagination-utils';
import { formatDate } from '@/lib/dates';
import { DuplicateCampaignButton } from '@/components/DuplicateCampaignButton';

const ALLOWED_SORTS = new Set(['title', 'status', 'questions', 'submitted', 'progress', 'deadline', 'createdAt']);

export default async function CampaignsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const sortParam = (typeof sp.sort === 'string' ? sp.sort : undefined);
  const sort = sortParam && ALLOWED_SORTS.has(sortParam) ? sortParam : 'createdAt';
  const dir: SortDir = sp.dir === 'asc' ? 'asc' : 'desc';

  const items = await prisma.campaign.findMany({
    include: {
      _count: { select: { assignments: true, questions: true } },
      assignments: { select: { submittedAt: true } },
    },
  });

  // Compute derived fields then sort in JS so we can sort by submitted-count and progress %.
  const enriched = items.map((c) => {
    const submitted = c.assignments.filter((a) => a.submittedAt).length;
    const total = c._count.assignments;
    const progress = total > 0 ? submitted / total : 0;
    return { ...c, submitted, total, progress };
  });
  const mul = dir === 'asc' ? 1 : -1;
  enriched.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case 'title': cmp = a.title.localeCompare(b.title); break;
      case 'status': cmp = a.status.localeCompare(b.status); break;
      case 'questions': cmp = a._count.questions - b._count.questions; break;
      case 'submitted': cmp = a.submitted - b.submitted; break;
      case 'progress': cmp = a.progress - b.progress; break;
      case 'deadline':
        cmp = (a.deadline?.getTime() ?? Number.POSITIVE_INFINITY) - (b.deadline?.getTime() ?? Number.POSITIVE_INFINITY);
        break;
      case 'createdAt':
      default:
        cmp = a.createdAt.getTime() - b.createdAt.getTime();
    }
    return cmp * mul;
  });

  const current = { sort, dir };
  const base = '/admin/campaigns';

  const perPage = clampPerPage(sp.perPage);
  const totalPages = Math.max(1, Math.ceil(enriched.length / perPage));
  const page = clampPage(sp.page, totalPages);
  const pageSlice = enriched.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
        <Link className="btn" href="/admin/campaigns/new">New campaign</Link>
      </div>
      <div className="card overflow-x-auto">
        <div className="pb-3">
          <UrlPaginationStats total={enriched.length} />
        </div>

        <table className="table">
          <thead>
            <tr>
              <th><SortLink basePath={base} field="title" label="Title" current={current} /></th>
              <th><SortLink basePath={base} field="status" label="Status" current={current} /></th>
              <th><SortLink basePath={base} field="questions" label="Questions" current={current} /></th>
              <th><SortLink basePath={base} field="submitted" label="Submitted" current={current} /></th>
              <th><SortLink basePath={base} field="progress" label="Progress" current={current} /></th>
              <th><SortLink basePath={base} field="deadline" label="Deadline" current={current} /></th>
              <th><SortLink basePath={base} field="createdAt" label="Created" current={current} /></th>
              <th className="">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {pageSlice.map((c) => {
              const pct = Math.round(c.progress * 100);
              return (
                <tr key={c.id}>
                  <td><Link className="text-[color:var(--text-primary)] hover:underline" href={`/admin/campaigns/${c.id}`}>{c.title}</Link></td>
                  <td><span className="badge">{c.status}</span></td>
                  <td>{c._count.questions}</td>
                  <td>{c.submitted} / {c.total}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded bg-[var(--border-primary)] overflow-hidden">
                        <div className="h-full bg-[var(--accent-primary)]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-[color:var(--text-secondary)] tabular-nums">{pct}%</span>
                    </div>
                  </td>
                  <td>{formatDate(c.deadline)}</td>
                  <td>{formatDate(c.createdAt)}</td>
                  <td className="">
                    <div className="flex gap-2 justify-center">
                      <Link href={`/admin/campaigns/${c.id}`} className="btn-secondary !py-1 !px-3 text-xs">Open</Link>
                      <Link href={`/admin/campaigns/${c.id}/edit`} className="btn-secondary !py-1 !px-3 text-xs">Edit</Link>
                      <DuplicateCampaignButton campaignId={c.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {enriched.length === 0 && <tr><td colSpan={8} className="text-center text-[color:var(--text-muted)] py-6">No campaigns yet.</td></tr>}
          </tbody>
        </table>
        <div className="pt-3">
          <UrlPaginationNav total={enriched.length} />
        </div>
      </div>
    </div>
  );
}
