import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCampaignWithResponses } from '@/lib/responses';
import { SortLink, type SortDir } from '@/components/SortLink';
import { UrlPaginationStats, UrlPaginationNav } from '@/components/UrlPagination';
import { clampPage, clampPerPage } from '@/components/pagination-utils';
import { formatDate, formatDateTime } from '@/lib/dates';
import { SearchInput } from '@/components/SearchInput';

const ALLOWED_SORTS = new Set(['empCode', 'name', 'group', 'status', 'submittedAt', 'reminders']);
const STATUS_WEIGHT = (a: { submittedAt: Date | null; confirmedAt: Date | null; emailOpenedAt: Date | null; emailSentAt: Date | null }) =>
  a.submittedAt ? 5 : a.confirmedAt ? 4 : a.emailOpenedAt ? 3 : a.emailSentAt ? 2 : 1;

export default async function HrResponsesPage(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const arr = (k: string): string[] => Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : [];
  const q = typeof sp.q === 'string' ? sp.q : '';
  const data = await getCampaignWithResponses(id, {
    locationIds: arr('locationId'),
    officeTypeIds: arr('officeTypeId'),
    departmentIds: arr('departmentId'),
    q,
  });
  if (!data) return notFound();

  const sortParam = typeof sp.sort === 'string' ? sp.sort : undefined;
  const sort = sortParam && ALLOWED_SORTS.has(sortParam) ? sortParam : 'empCode';
  const dir: SortDir = sp.dir === 'desc' ? 'desc' : 'asc';
  const mul = dir === 'asc' ? 1 : -1;
  data.assignments.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case 'name': cmp = a.employee.name.localeCompare(b.employee.name); break;
      case 'group':
        cmp = (a.employee.location.name + a.employee.officeType.name + a.employee.department.name)
          .localeCompare(b.employee.location.name + b.employee.officeType.name + b.employee.department.name);
        break;
      case 'status': cmp = STATUS_WEIGHT(a) - STATUS_WEIGHT(b); break;
      case 'submittedAt':
        cmp = (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0); break;
      case 'reminders':
        cmp = a.reminderCount - b.reminderCount; break;
      case 'empCode':
      default: cmp = a.employee.empCode.localeCompare(b.employee.empCode);
    }
    return cmp * mul;
  });
  const [locations, officeTypes, departments] = await Promise.all([
    prisma.location.findMany({ orderBy: { name: 'asc' } }),
    prisma.officeType.findMany({ orderBy: { name: 'asc' } }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const submitted = data.assignments.filter((a) => a.submittedAt).length;
  const perPage = clampPerPage(sp.perPage);
  const totalPages = Math.max(1, Math.ceil(data.assignments.length / perPage));
  const page = clampPage(sp.page, totalPages);
  const pageSlice = data.assignments.slice((page - 1) * perPage, page * perPage);
  const params = new URLSearchParams();
  arr('locationId').forEach((x) => params.append('locationId', x));
  arr('officeTypeId').forEach((x) => params.append('officeTypeId', x));
  arr('departmentId').forEach((x) => params.append('departmentId', x));
  const exportHref = `/api/hr/campaigns/${id}/export?${params.toString()}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--accent-primary)' }}>
            Responses
          </p>
          <h1 className="text-2xl font-bold tracking-tight mt-1">{data.campaign.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm">
            {submitted === data.assignments.length && data.assignments.length > 0
              ? <span className="badge pill-success">All submitted</span>
              : submitted > 0
                ? <span className="badge pill-info">{submitted} submitted</span>
                : <span className="badge pill-neutral">No submissions yet</span>}
            <span style={{ color: 'var(--text-secondary)' }}>
              {submitted} / {data.assignments.length} of recipients
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/hr/campaigns/${id}`} className="btn-secondary">← Campaign</Link>
          <Link href={`/hr/campaigns/${id}/report`} className="btn-secondary">Report</Link>
          <Link href={exportHref} className="btn">Export Excel</Link>
        </div>
      </div>

      <FilterRow locations={locations} officeTypes={officeTypes} departments={departments} sp={sp} basePath={`/hr/campaigns/${id}/responses`} />

      <div className="card overflow-x-auto">
        <div className="pb-3">
          <UrlPaginationStats total={data.assignments.length} />
        </div>

        <table className="table">
          <thead>
            <tr>
              <th><SortLink basePath={`/hr/campaigns/${id}/responses`} field="empCode" label="Emp. Code" current={{ sort, dir }} extra={{ locationId: arr('locationId'), officeTypeId: arr('officeTypeId'), departmentId: arr('departmentId') }} /></th>
              <th><SortLink basePath={`/hr/campaigns/${id}/responses`} field="name" label="Employee" current={{ sort, dir }} extra={{ locationId: arr('locationId'), officeTypeId: arr('officeTypeId'), departmentId: arr('departmentId') }} /></th>
              <th><SortLink basePath={`/hr/campaigns/${id}/responses`} field="group" label="Group" current={{ sort, dir }} extra={{ locationId: arr('locationId'), officeTypeId: arr('officeTypeId'), departmentId: arr('departmentId') }} /></th>
              <th><SortLink basePath={`/hr/campaigns/${id}/responses`} field="status" label="Status" current={{ sort, dir }} extra={{ locationId: arr('locationId'), officeTypeId: arr('officeTypeId'), departmentId: arr('departmentId') }} /></th>
              <th><SortLink basePath={`/hr/campaigns/${id}/responses`} field="submittedAt" label="Submitted" current={{ sort, dir }} extra={{ locationId: arr('locationId'), officeTypeId: arr('officeTypeId'), departmentId: arr('departmentId') }} /></th>
              <th><SortLink basePath={`/hr/campaigns/${id}/responses`} field="reminders" label="Reminders" current={{ sort, dir }} extra={{ locationId: arr('locationId'), officeTypeId: arr('officeTypeId'), departmentId: arr('departmentId') }} /></th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {pageSlice.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-xs">{a.employee.empCode}</td>
                <td>
                  <div>{a.employee.name}</div>
                  <div className="text-xs text-[color:var(--text-muted)]">{a.employee.designation}</div>
                </td>
                <td className="text-xs">{a.employee.location.name} › {a.employee.officeType.name} › {a.employee.department.name}</td>
                <td>
                  {a.submittedAt ? <span className="badge pill-success" title={formatDateTime(a.submittedAt)}>Submitted</span>
                    : a.confirmedAt ? <span className="badge pill-info" title={formatDateTime(a.confirmedAt)}>Confirmed</span>
                    : a.emailOpenedAt ? <span className="badge pill-info" title={`Opened ${formatDateTime(a.emailOpenedAt)}`}>Opened</span>
                    : a.emailSentAt ? <span className="badge pill-neutral" title={formatDateTime(a.emailSentAt)}>Sent</span>
                    : <span className="badge">Pending</span>}
                </td>
                <td className="text-xs whitespace-nowrap">
                  {a.submittedAt ? <span title={formatDateTime(a.submittedAt)}>{formatDate(a.submittedAt)}</span> : '—'}
                </td>
                <td className="text-xs whitespace-nowrap">
                  {a.reminderCount > 0
                    ? <span title={a.lastReminderSentAt ? `Last sent ${formatDateTime(a.lastReminderSentAt)}` : ''}>{a.reminderCount}</span>
                    : '—'}
                </td>
                <td className="">
                  {a.submittedAt && (
                    <Link href={`/hr/campaigns/${id}/responses/${a.employee.id}`} className="text-sm hover:underline">View →</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pt-3">
          <UrlPaginationNav total={data.assignments.length} />
        </div>
      </div>
    </div>
  );
}

function FilterRow({ locations, officeTypes, departments, sp, basePath }: any) {
  const arr = (k: string): string[] => Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : [];
  const q = typeof sp.q === 'string' ? sp.q : '';
  function build(updates: Record<string, string[] | string | null>) {
    const params = new URLSearchParams();
    const merged: Record<string, string[] | string> = {
      locationId: arr('locationId'),
      officeTypeId: arr('officeTypeId'),
      departmentId: arr('departmentId'),
      q,
    };
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) delete merged[k];
      else merged[k] = v;
    }
    Object.entries(merged).forEach(([k, vs]) => {
      if (Array.isArray(vs)) vs.forEach((v) => params.append(k, v));
      else if (vs) params.set(k, vs);
    });
    if (typeof sp.sort === 'string') params.set('sort', sp.sort);
    if (typeof sp.dir === 'string') params.set('dir', sp.dir);
    return basePath + '?' + params.toString();
  }
  const anyFilterActive = arr('locationId').length > 0 || arr('officeTypeId').length > 0 || arr('departmentId').length > 0 || !!q;
  function renderGroup(label: string, key: string, items: { id: string; name: string }[]) {
    const sel = arr(key);
    return (
      <div>
        <div className="text-center mb-2">
          <div className="label !mb-0 inline-flex items-center gap-2 justify-center">
            <span>{label}</span>
            {sel.length > 0 && (
              <>
                <span className="text-[10px] uppercase font-bold tracking-wider rounded-full px-1.5 py-[1px]" style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
                  {sel.length}
                </span>
                <a href={build({ [key]: [] })} className="text-[11px] font-medium hover:underline" style={{ color: 'var(--text-muted)' }}>
                  Clear
                </a>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 justify-center">
          {items.map((it) => {
            const active = sel.includes(it.id);
            const next = active ? sel.filter((x) => x !== it.id) : [...sel, it.id];
            return (
              <a
                key={it.id}
                href={build({ [key]: next })}
                aria-pressed={active}
                className={
                  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors border ' +
                  (active ? 'shadow-sm' : 'hover:bg-[var(--accent-hover)]')
                }
                style={
                  active
                    ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: '#ffffff' }
                    : { background: 'var(--surface-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }
                }
              >
                {active && (
                  <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 8l4 4 6-8" />
                  </svg>
                )}
                {it.name}
              </a>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="card space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px] max-w-xl">
          <SearchInput id="responses-q" label="Search recipients" placeholder="name / code / email / designation…" />
        </div>
        {anyFilterActive && (
          <a href={basePath} className="text-xs hover:underline pb-2.5" style={{ color: 'var(--text-muted)' }}>
            Clear all filters
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="px-4 md:px-5 py-2">
          {renderGroup('Location', 'locationId', locations)}
        </div>
        <div className="px-4 md:px-5 py-2 md:border-l" style={{ borderColor: 'var(--border-subtle)' }}>
          {renderGroup('Office type', 'officeTypeId', officeTypes)}
        </div>
        <div className="px-4 md:px-5 py-2 md:border-l" style={{ borderColor: 'var(--border-subtle)' }}>
          {renderGroup('Department', 'departmentId', departments)}
        </div>
      </div>
    </div>
  );
}
