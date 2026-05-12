import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getQuestionReport, getGroupReports, type GroupReport } from '@/lib/reports';
import { SearchInput } from '@/components/SearchInput';
import { QuestionPicker } from '@/components/QuestionPicker';
import { UrlPaginationStats, UrlPaginationNav } from '@/components/UrlPagination';
import { clampPage, clampPerPage } from '@/components/pagination-utils';
import { formatDate, formatDateTime } from '@/lib/dates';
import { BackToTop } from '@/components/BackToTop';

// Shared body — admin and HR mirrors render the same UI.
export async function ReportView({
  campaignId,
  sp,
  basePath,
  backHref,
  exportBase,
}: {
  campaignId: string;
  sp: Record<string, string | string[] | undefined>;
  basePath: string;
  backHref: string;
  exportBase: string;
}) {
  const arr = (k: string): string[] => Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : [];
  const q = typeof sp.q === 'string' ? sp.q : '';
  const questionId = typeof sp.questionId === 'string' ? sp.questionId : '';
  const selectedOptions = arr('option');
  const textQuery = typeof sp.text === 'string' ? sp.text : '';
  const openGroup = typeof sp.openGroup === 'string' ? sp.openGroup : '';

  const [report, groupReports, locations, officeTypes, departments] = await Promise.all([
    getQuestionReport(campaignId, {
      questionId: questionId || undefined,
      selectedOptions: selectedOptions.length ? selectedOptions : undefined,
      textQuery: textQuery || undefined,
      locationIds: arr('locationId'),
      officeTypeIds: arr('officeTypeId'),
      departmentIds: arr('departmentId'),
      q,
    }),
    getGroupReports(campaignId, {
      locationIds: arr('locationId'),
      officeTypeIds: arr('officeTypeId'),
      departmentIds: arr('departmentId'),
      q,
    }),
    prisma.location.findMany({ orderBy: { name: 'asc' } }),
    prisma.officeType.findMany({ orderBy: { name: 'asc' } }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ]);
  if (!report) return notFound();

  const perPage = clampPerPage(sp.perPage);
  const totalPages = Math.max(1, Math.ceil(report.matches.length / perPage));
  const page = clampPage(sp.page, totalPages);
  const pageSlice = report.matches.slice((page - 1) * perPage, page * perPage);

  // Build the export URL preserving the current filters.
  const exportParams = new URLSearchParams();
  if (questionId) exportParams.set('questionId', questionId);
  selectedOptions.forEach((o) => exportParams.append('option', o));
  if (textQuery) exportParams.set('text', textQuery);
  if (q) exportParams.set('q', q);
  arr('locationId').forEach((x) => exportParams.append('locationId', x));
  arr('officeTypeId').forEach((x) => exportParams.append('officeTypeId', x));
  arr('departmentId').forEach((x) => exportParams.append('departmentId', x));
  const exportHref = `${exportBase}?${exportParams.toString()}`;

  const isText = report.question?.type === 'TEXT' || report.question?.type === 'LONG_TEXT';

  return (
    <div id="top" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--accent-primary)' }}>
            Report
          </p>
          <h1 className="text-2xl font-bold tracking-tight mt-1">{report.campaign.title}</h1>
          <div className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Drill into a question to find the employees who picked each answer — for follow-up conversations.
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={backHref} className="btn-secondary">← Campaign</Link>
          {report.question && (
            <Link href={exportHref} className="btn">Export filtered</Link>
          )}
        </div>
      </div>

      {groupReports.length > 0 && (
        <GroupDistribution
          groups={groupReports}
          basePath={basePath}
          sp={sp}
          selectedQuestionId={questionId || null}
          openGroup={openGroup}
        />
      )}

      <div className="card space-y-2">
        <label htmlFor="report-question" className="label">Question</label>
        <QuestionPicker
          questions={report.campaign.questions.map((q) => ({ id: q.id, text: q.text }))}
          current={questionId}
        />
      </div>

      {report.question && !isText && (
        <DistributionStrip
          basePath={basePath}
          sp={sp}
          options={report.optionCounts}
          totalAnswered={report.totalAnswered}
          selected={selectedOptions}
        />
      )}

      {report.question && isText && (
        <div className="card space-y-2">
          <SearchInput id="report-text" paramName="text" label="Search answer text" placeholder="keyword in employee answers…" />
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {textQuery
              ? `${report.matches.length} answer${report.matches.length === 1 ? '' : 's'} contain “${textQuery}” (of ${report.totalAnswered} answered)`
              : `${report.totalAnswered} employee${report.totalAnswered === 1 ? '' : 's'} answered this question`}
          </div>
        </div>
      )}

      <FilterRow
        locations={locations}
        officeTypes={officeTypes}
        departments={departments}
        sp={sp}
        basePath={basePath}
      />

      {!report.question ? (
        <div id="recipients" className="card text-center" style={{ color: 'var(--text-muted)' }}>
          Pick a question above to see the answer distribution and the employees behind each option.
        </div>
      ) : (
        <div id="recipients" className="card overflow-x-auto" style={{ scrollMarginTop: '1rem' }}>
          <div className="pb-3">
            <UrlPaginationStats total={report.matches.length} />
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Emp. Code</th>
                <th>Employee</th>
                <th>Group</th>
                <th>Submitted</th>
                <th>Answer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {pageSlice.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
                    No employees match the current filters.
                  </td>
                </tr>
              ) : (
                pageSlice.map((m) => (
                  <tr key={m.assignmentId}>
                    <td className="font-mono text-xs">{m.empCode}</td>
                    <td>
                      <div>{m.name}</div>
                      <div className="text-xs text-[color:var(--text-muted)]">{m.designation}</div>
                    </td>
                    <td className="text-xs">{m.group.location} › {m.group.officeType} › {m.group.department}</td>
                    <td className="text-xs whitespace-nowrap">
                      <span title={formatDateTime(m.submittedAt)}>{formatDate(m.submittedAt)}</span>
                    </td>
                    <td className="align-middle text-center">
                      <div className="inline-flex flex-col items-center gap-1.5">
                        {m.answer.options.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {m.answer.options.map((o, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
                                style={{
                                  background: 'var(--page-bg)',
                                  color: 'var(--accent-primary)',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                {o}
                              </span>
                            ))}
                          </div>
                        )}
                        {m.answer.text && m.answer.text.trim() && (
                          <div
                            className="text-xs leading-snug italic max-w-xs"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <span className="not-italic font-semibold mr-1" style={{ color: 'var(--text-muted)' }}>
                              Comment:
                            </span>
                            {m.answer.text}
                          </div>
                        )}
                        {m.answer.options.length === 0 && !m.answer.text?.trim() && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="pt-3">
            <UrlPaginationNav total={report.matches.length} />
          </div>
        </div>
      )}
      <BackToTop />
    </div>
  );
}

function DistributionStrip({
  basePath, sp, options, totalAnswered, selected,
}: {
  basePath: string;
  sp: Record<string, string | string[] | undefined>;
  options: { option: string; count: number }[];
  totalAnswered: number;
  selected: string[];
}) {
  const arr = (k: string): string[] => Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : [];
  function build(updates: Record<string, string[] | string | null>) {
    const params = new URLSearchParams();
    const merged: Record<string, string[] | string> = {
      questionId: typeof sp.questionId === 'string' ? sp.questionId : '',
      option: arr('option'),
      locationId: arr('locationId'),
      officeTypeId: arr('officeTypeId'),
      departmentId: arr('departmentId'),
      q: typeof sp.q === 'string' ? sp.q : '',
    };
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) delete merged[k];
      else merged[k] = v;
    }
    Object.entries(merged).forEach(([k, vs]) => {
      if (Array.isArray(vs)) vs.forEach((v) => params.append(k, v));
      else if (vs) params.set(k, vs);
    });
    return basePath + '?' + params.toString();
  }
  const definedCount = options.length;
  const positivityLetters = LETTERS.slice(0, Math.min(definedCount, LETTERS.length));
  const positivityLabels = bucketLabels(positivityLetters.length);
  const maxCount = Math.max(1, ...options.map((o) => o.count));
  const topCount = Math.max(...options.map((o) => o.count));
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="inline-flex items-baseline gap-2">
          <span className="label !mb-0">Distribution</span>
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {totalAnswered} answered · {definedCount} option{definedCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {definedCount >= 2 && (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: BUCKET_COLORS.A }} />
                Positive
              </span>
              <span aria-hidden>→</span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: BUCKET_COLORS[positivityLetters[positivityLetters.length - 1]] ?? BUCKET_COLORS.E }} />
                Negative
              </span>
            </div>
          )}
          {selected.length > 0 && (
            <a href={build({ option: [] })} className="text-[11px] font-semibold hover:underline" style={{ color: 'var(--accent-primary)' }}>
              Clear {selected.length} filter{selected.length === 1 ? '' : 's'}
            </a>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {options.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No options defined.</span>
        )}
        {options.map((opt, i) => {
          const active = selected.includes(opt.option);
          const next = active ? selected.filter((x) => x !== opt.option) : [...selected, opt.option];
          const pct = totalAnswered > 0 ? (opt.count / totalAnswered) * 100 : 0;
          const pctRounded = Math.round(pct);
          const letter = positivityLetters[i] ?? 'A';
          const positivity = positivityLabels[i] ?? '';
          const color = BUCKET_COLORS[letter] ?? '#888';
          const w = maxCount > 0 ? (opt.count / maxCount) * 100 : 0;
          const isTop = opt.count > 0 && opt.count === topCount;
          return (
            <a
              key={opt.option}
              href={build({ option: next })}
              aria-pressed={active}
              title={active ? `Click to remove "${opt.option}" from filter` : `Click to filter by "${opt.option}"`}
              className="block rounded-md px-2 py-2 transition-colors"
              style={{
                background: active ? 'var(--accent-hover, var(--page-bg))' : 'transparent',
                border: `1px solid ${active ? 'var(--accent-primary)' : 'transparent'}`,
              }}
            >
              <div
                className="grid items-center gap-2"
                style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(120px, 2.4fr) auto' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {active && (
                      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: 'var(--accent-primary)' }}>
                        <path d="M3 8l4 4 6-8" />
                      </svg>
                    )}
                    <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {opt.option}
                    </span>
                    {isTop && (
                      <span
                        className="text-[9px] uppercase font-bold tracking-wider rounded-sm px-1 py-px"
                        style={{ background: color, color: '#ffffff', opacity: 0.9 }}
                      >
                        Top
                      </span>
                    )}
                  </div>
                  {positivity && (
                    <div className="text-[10px] mt-0.5 font-semibold uppercase tracking-wider" style={{ color }}>
                      {positivity}
                    </div>
                  )}
                </div>
                <div
                  className="relative h-4 rounded-full overflow-hidden border"
                  style={{ background: 'var(--page-bg)', borderColor: 'var(--border-subtle)' }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                    style={{
                      width: `${Math.max(w, opt.count > 0 ? 1.5 : 0)}%`,
                      background: color,
                      opacity: opt.count === 0 ? 0.18 : 1,
                    }}
                  />
                </div>
                <div className="text-right tabular-nums whitespace-nowrap shrink-0">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{opt.count}</span>
                  <span className="ml-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{pctRounded}%</span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function FilterRow({ locations, officeTypes, departments, sp, basePath }: {
  locations: { id: string; name: string }[];
  officeTypes: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  sp: Record<string, string | string[] | undefined>;
  basePath: string;
}) {
  const arr = (k: string): string[] => Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : [];
  const q = typeof sp.q === 'string' ? sp.q : '';
  function build(updates: Record<string, string[] | string | null>) {
    const params = new URLSearchParams();
    const merged: Record<string, string[] | string> = {
      questionId: typeof sp.questionId === 'string' ? sp.questionId : '',
      option: arr('option'),
      text: typeof sp.text === 'string' ? sp.text : '',
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
          <SearchInput id="report-q" label="Search recipients" placeholder="name / code / email / designation…" />
        </div>
        {anyFilterActive && (
          <a
            href={build({ locationId: [], officeTypeId: [], departmentId: [], q: '' })}
            className="text-xs hover:underline pb-2.5"
            style={{ color: 'var(--text-muted)' }}
          >
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

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Fixed positivity palette: A (most positive) → red (most negative).
const BUCKET_COLORS: Record<string, string> = {
  A: '#16a34a', // green
  B: '#84cc16', // lime
  C: '#f59e0b', // amber
  D: '#f97316', // orange
  E: '#ef4444', // red
  F: '#b91c1c', // deep red
};

// Map a question's bucket count → human labels in positivity order.
// Index 0 = most positive (A), last = most negative.
function bucketLabels(n: number): string[] {
  switch (n) {
    case 1: return ['Positive'];
    case 2: return ['Positive', 'Negative'];
    case 3: return ['Positive', 'Neutral', 'Negative'];
    case 4: return ['Very positive', 'Positive', 'Negative', 'Very negative'];
    case 5: return ['Very positive', 'Positive', 'Neutral', 'Negative', 'Very negative'];
    case 6: return ['Very positive', 'Positive', 'Slightly positive', 'Slightly negative', 'Negative', 'Very negative'];
    default: return Array.from({ length: n }, (_, i) => `Level ${i + 1}`);
  }
}

function GroupDistribution({
  groups, basePath, sp, selectedQuestionId, openGroup,
}: {
  groups: GroupReport[];
  basePath: string;
  sp: Record<string, string | string[] | undefined>;
  selectedQuestionId: string | null;
  openGroup: string;
}) {
  const arr = (k: string): string[] => Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : [];
  function buildUrl(updates: Record<string, string | string[] | null>) {
    const params = new URLSearchParams();
    const base: Record<string, string[] | string> = {
      questionId: typeof sp.questionId === 'string' ? sp.questionId : '',
      option: arr('option'),
      text: typeof sp.text === 'string' ? sp.text : '',
      locationId: arr('locationId'),
      officeTypeId: arr('officeTypeId'),
      departmentId: arr('departmentId'),
      q: typeof sp.q === 'string' ? sp.q : '',
      openGroup: typeof sp.openGroup === 'string' ? sp.openGroup : '',
    };
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) delete base[k];
      else base[k] = v;
    }
    Object.entries(base).forEach(([k, vs]) => {
      if (Array.isArray(vs)) vs.forEach((v) => params.append(k, v));
      else if (vs) params.set(k, vs);
    });
    return basePath + '?' + params.toString();
  }
  const effectiveOpen = openGroup;
  const openedGroup = groups.find((g) => (g.groupId || 'ungrouped') === effectiveOpen) || null;
  const GROUP_ACCENT = 'var(--accent-primary)';
  // Y-axis scale shared across groups so heights are comparable across the page.
  const maxCount = Math.max(1, ...groups.flatMap((g) => g.buckets.map((b) => b.count)));
  return (
    <div className="card space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Group distribution</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Each question's options are mapped from most positive to most negative. Bar heights share a common scale across groups.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: BUCKET_COLORS.A }} />
            Positive
          </span>
          <span aria-hidden>→</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: BUCKET_COLORS.E }} />
            Negative
          </span>
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gridAutoFlow: 'dense' }}>
        {groups.map((g) => {
          const total = g.buckets.reduce((s, b) => s + b.count, 0);
          const gid = g.groupId || 'ungrouped';
          const isOpen = effectiveOpen === gid;
          const accent = GROUP_ACCENT;
          return (
          <React.Fragment key={gid}>
            <div
              className="rounded-lg border p-3 flex flex-col relative overflow-hidden"
              style={{
                borderLeftColor: isOpen ? 'var(--accent-primary)' : 'var(--border-subtle)',
                borderRightColor: isOpen ? 'var(--accent-primary)' : 'var(--border-subtle)',
                borderTopWidth: '3px',
                borderTopStyle: 'solid',
                borderTopColor: accent,
                borderBottomWidth: '3px',
                borderBottomStyle: 'solid',
                borderBottomColor: accent,
                background: 'var(--surface-primary)',
                boxShadow: isOpen ? '0 0 0 1px var(--accent-primary)' : undefined,
              }}
            >
              <div className="text-center mb-2 font-semibold text-base truncate" style={{ color: accent }}>
                {g.name}
              </div>
              {total === 0 ? (
                <div className="text-sm italic flex-1 flex items-center justify-center py-6" style={{ color: 'var(--text-muted)' }}>
                  No answers yet.
                </div>
              ) : (
                <GroupedBars buckets={g.buckets} maxCount={maxCount} total={total} />
              )}
              <div className="text-center mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {g.questionCount} question{g.questionCount === 1 ? '' : 's'} · {total} answer{total === 1 ? '' : 's'}
              </div>
              {g.questions.length > 0 && (
                <Link
                  prefetch
                  scroll={false}
                  href={buildUrl({ openGroup: isOpen ? null : gid })}
                  className="mt-4 cursor-pointer list-none select-none flex items-center justify-center gap-2 rounded-md py-2 px-3 text-xs font-semibold transition-colors hover:opacity-90"
                  style={{
                    color: isOpen ? '#ffffff' : 'var(--accent-primary)',
                    background: isOpen ? 'var(--accent-primary)' : 'var(--page-bg)',
                    border: `1px solid ${isOpen ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  }}
                >
                  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                  {isOpen
                    ? 'Hide questions'
                    : `Show ${g.questions.length} question${g.questions.length === 1 ? '' : 's'}`}
                </Link>
              )}
            </div>
            {isOpen && g.questions.length > 0 && (
              <div
                className="rounded-lg border p-4"
                style={{
                  gridColumn: '1 / -1',
                  borderColor: 'var(--accent-primary)',
                  background: 'color-mix(in srgb, var(--accent-primary) 18%, var(--surface-primary))',
                }}
              >
                <div className="relative mb-3">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
                    {g.questions.length} question{g.questions.length === 1 ? '' : 's'}
                  </span>
                  <h3 className="text-sm font-semibold text-center" style={{ color: 'var(--text-primary)' }}>
                    {g.name}
                  </h3>
                  <Link
                    prefetch
                    scroll={false}
                    href={buildUrl({ openGroup: null })}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] font-semibold hover:underline"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    Hide ×
                  </Link>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  {g.questions.map((q) => {
                    const isSelected = selectedQuestionId === q.questionId;
                    const allHref = buildUrl({ questionId: q.questionId, openGroup: gid, option: [] }) + '#recipients';
                    return (
                      <div
                        key={q.questionId}
                        className="block rounded-md p-3 space-y-2 transition-colors"
                        style={{
                          background: 'var(--surface-primary)',
                          border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                          boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : undefined,
                          color: 'var(--text-primary)',
                          flex: g.questions.length <= 2
                            ? '1 1 min(100%, 32rem)'
                            : '1 1 calc((100% - 1.5rem) / 3)',
                          maxWidth: g.questions.length <= 2
                            ? 'min(100%, 32rem)'
                            : 'calc((100% - 1.5rem) / 3)',
                          minWidth: g.questions.length >= 3 ? '16rem' : undefined,
                        }}
                      >
                        <Link
                          prefetch
                          href={allHref}
                          title="See everyone who answered this question"
                          className="block text-[12.5px] leading-snug font-medium hover:underline"
                          style={{ color: 'inherit', textDecoration: 'none' }}
                        >
                          <span
                            className="inline-flex items-center justify-center mr-2 rounded-full text-[10px] font-semibold align-middle"
                            style={{
                              minWidth: '1.4rem',
                              height: '1.4rem',
                              padding: '0 0.4rem',
                              background: 'var(--surface-primary)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-subtle)',
                            }}
                            aria-label={`Question ${q.position}`}
                          >
                            Q{q.position}
                          </span>
                          {q.text}
                        </Link>
                        {q.totalAnswered === 0 ? (
                          <div className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>No answers yet.</div>
                        ) : (
                          <GroupedBars
                            buckets={q.buckets}
                            maxCount={Math.max(1, ...q.buckets.map((b) => b.count))}
                            total={q.totalAnswered}
                            compact
                            options={q.options}
                            buildOptionHref={(opt) => buildUrl({ questionId: q.questionId, openGroup: gid, option: [opt] }) + '#recipients'}
                          />
                        )}
                        <Link
                          prefetch
                          href={allHref}
                          className="block text-center text-[10px] font-medium hover:underline"
                          style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                        >
                          {q.totalAnswered} answered
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function GroupedBars({
  buckets, maxCount, total, compact = false, options, buildOptionHref,
}: {
  buckets: { letter: string; count: number }[];
  maxCount: number;
  total: number;
  compact?: boolean;
  options?: string[];
  buildOptionHref?: (option: string) => string;
}) {
  const labels = bucketLabels(buckets.length);
  const labelCol = compact ? '5.25rem' : '5.75rem';
  const countCol = compact ? '3rem' : '4.25rem';
  const barH = compact ? 'h-2' : 'h-3.5';
  const fontSize = compact ? 'text-[10px]' : 'text-[13px]';
  const rowGap = compact ? '0.5rem' : '0.4rem';
  return (
    <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {buckets.map((b, i) => {
        const w = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
        const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
        const optionText = options?.[i];
        const drillHref = optionText && buildOptionHref ? buildOptionHref(optionText) : null;
        const content = (
          <>
            <span
              className={`${fontSize} font-medium leading-tight truncate`}
              style={{ color: 'var(--text-secondary)' }}
            >
              {labels[i]}
            </span>
            <div
              className={`relative ${barH} rounded-full overflow-hidden border`}
              style={{ background: 'var(--page-bg)', borderColor: 'var(--border-subtle)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{
                  width: `${Math.max(w, b.count > 0 ? 1.5 : 0)}%`,
                  background: BUCKET_COLORS[b.letter] ?? '#888',
                  opacity: b.count === 0 ? 0.18 : 1,
                }}
              />
            </div>
            <span
              className={`${fontSize} tabular-nums grid whitespace-nowrap`}
              style={{ color: 'var(--text-muted)', gridTemplateColumns: '1fr 1fr', columnGap: '0.4rem' }}
            >
              <span className="text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{b.count}</span>
              <span className="text-right">({pct}%)</span>
            </span>
          </>
        );
        if (drillHref && b.count > 0) {
          return (
            <Link
              key={b.letter}
              prefetch
              href={drillHref}
              className="grid items-center rounded-md px-1 py-0.5 -mx-1 hover:bg-[var(--accent-hover,var(--page-bg))] transition-colors cursor-pointer"
              style={{ gridTemplateColumns: `${labelCol} 1fr ${countCol}`, columnGap: rowGap, color: 'inherit', textDecoration: 'none' }}
              title={`${labels[i]} — ${optionText}: ${b.count} (${pct}%). Click to see respondents.`}
            >
              {content}
            </Link>
          );
        }
        return (
          <div
            key={b.letter}
            className="grid items-center"
            style={{ gridTemplateColumns: `${labelCol} 1fr ${countCol}`, columnGap: rowGap }}
            title={`${labels[i]}${optionText ? ` — ${optionText}` : ''}: ${b.count} (${pct}%)`}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
