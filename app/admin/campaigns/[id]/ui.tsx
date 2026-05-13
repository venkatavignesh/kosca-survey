'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PaginationStats, PaginationNav, usePaginated, PerPage } from '@/components/Pagination';
import { formatDate, formatDateTime } from '@/lib/dates';

type Master = { id: string; name: string };
type Employee = {
  id: string; empCode: string; name: string; email: string; designation: string;
  location: Master; officeType: Master; department: Master;
};
type CQ = { id: string; questionId: string; order: number; audience: 'ALL' | 'SPECIFIC'; targetEmployeeIds: string[] };
type Assignment = {
  id: string; employeeId: string;
  emailSentAt: string | null;
  emailOpenedAt: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
  reminderCount: number;
  lastReminderSentAt: string | null;
};
type Campaign = {
  id: string; title: string; status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  assignments: Assignment[];
  questions: CQ[];
};

export function RecipientsBuilder({ campaign, employees, locations, officeTypes, departments }: {
  campaign: Campaign; employees: Employee[];
  locations: Master[]; officeTypes: Master[]; departments: Master[];
}) {
  const router = useRouter();

  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(
    () => new Set(campaign.assignments.map((a) => a.employeeId)),
  );

  // employee-list filters
  const [locFilter, setLocFilter] = useState<Set<string>>(new Set());
  const [otFilter, setOtFilter] = useState<Set<string>>(new Set());
  const [deptFilter, setDeptFilter] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const savedEmpIds = useMemo(() => new Set(campaign.assignments.map((a) => a.employeeId)), [campaign.assignments]);
  // Submitted assignments can NEVER be removed server-side (see
  // syncCampaignAssignments), so we treat them as always-selected when
  // computing dirty. Without this guard, de-selecting a submitted recipient
  // creates an unresolvable diff and the auto-save loops forever.
  const lockedEmpIds = useMemo(
    () => new Set(campaign.assignments.filter((a) => a.submittedAt).map((a) => a.employeeId)),
    [campaign.assignments],
  );
  const effectiveSelected = useMemo(() => {
    const s = new Set(selectedEmpIds);
    for (const id of lockedEmpIds) s.add(id);
    return s;
  }, [selectedEmpIds, lockedEmpIds]);
  const recipientsDirty = effectiveSelected.size !== savedEmpIds.size
    || Array.from(effectiveSelected).some((id) => !savedEmpIds.has(id))
    || Array.from(savedEmpIds).some((id) => !effectiveSelected.has(id));

  const savedButUnsent = campaign.assignments.filter((a) => selectedEmpIds.has(a.employeeId) && !a.emailSentAt && !a.submittedAt).length;
  // Reminder-eligible: selected, has been invited (emailSentAt set), and not yet submitted.
  // We refuse to remind someone we never invited — there's nothing to remind them about.
  const pendingNonSubmitters = campaign.assignments.filter((a) => selectedEmpIds.has(a.employeeId) && !!a.emailSentAt && !a.submittedAt).length;

  // Sort + pagination state for the recipients table
  type SortField = 'empCode' | 'name' | 'group' | 'status' | 'sentAt' | 'openedAt' | 'submittedAt' | 'reminders';
  const [sortField, setSortField] = useState<SortField>('empCode');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(25);

  const statusWeight = (empId: string) => {
    const a = campaign.assignments.find((x) => x.employeeId === empId);
    if (!a) return 0;
    if (a.submittedAt) return 5;
    if (a.confirmedAt) return 4;
    if (a.emailOpenedAt) return 3;
    if (a.emailSentAt) return 2;
    return 1;
  };

  const filteredEmployees = useMemo(() => {
    const list = employees.filter((e) => {
      if (locFilter.size && !locFilter.has(e.location.id)) return false;
      if (otFilter.size && !otFilter.has(e.officeType.id)) return false;
      if (deptFilter.size && !deptFilter.has(e.department.id)) return false;
      if (search) {
        const s = search.toLowerCase();
        if (![e.name, e.empCode, e.email, e.designation].some((x) => x.toLowerCase().includes(s))) return false;
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    const ts = (s: string | null | undefined) => (s ? new Date(s).getTime() : Number.POSITIVE_INFINITY);
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'empCode': cmp = a.empCode.localeCompare(b.empCode); break;
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'group':
          cmp = (a.location.name + a.officeType.name + a.department.name)
            .localeCompare(b.location.name + b.officeType.name + b.department.name);
          break;
        case 'status': cmp = statusWeight(a.id) - statusWeight(b.id); break;
        case 'sentAt': {
          const aa = campaign.assignments.find((x) => x.employeeId === a.id);
          const bb = campaign.assignments.find((x) => x.employeeId === b.id);
          cmp = ts(aa?.emailSentAt) - ts(bb?.emailSentAt); break;
        }
        case 'openedAt': {
          const aa = campaign.assignments.find((x) => x.employeeId === a.id);
          const bb = campaign.assignments.find((x) => x.employeeId === b.id);
          cmp = ts(aa?.emailOpenedAt) - ts(bb?.emailOpenedAt); break;
        }
        case 'submittedAt': {
          const aa = campaign.assignments.find((x) => x.employeeId === a.id);
          const bb = campaign.assignments.find((x) => x.employeeId === b.id);
          cmp = ts(aa?.submittedAt) - ts(bb?.submittedAt); break;
        }
        case 'reminders': {
          const aa = campaign.assignments.find((x) => x.employeeId === a.id);
          const bb = campaign.assignments.find((x) => x.employeeId === b.id);
          cmp = (aa?.reminderCount ?? 0) - (bb?.reminderCount ?? 0); break;
        }
      }
      return cmp * dir;
    });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, locFilter, otFilter, deptFilter, search, sortField, sortDir, campaign.assignments]);

  const { slice, total } = usePaginated(filteredEmployees, page, perPage);

  const assignmentByEmp = useMemo(() => new Map(campaign.assignments.map((a) => [a.employeeId, a])), [campaign.assignments]);

  function addAllFiltered() {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      filteredEmployees.forEach((e) => next.add(e.id));
      return next;
    });
  }
  function removeAllFiltered() {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      filteredEmployees.forEach((e) => {
        if (lockedEmpIds.has(e.id)) return; // submitted — can't un-assign
        next.delete(e.id);
      });
      return next;
    });
  }
  function toggleEmp(id: string) {
    // Submitted recipients are locked — un-checking is a no-op so the auto-save
    // can converge.
    if (lockedEmpIds.has(id)) return;
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Auto-save: persist recipients only. Questions are managed on a separate page.
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return; }
    if (!recipientsDirty) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/campaigns/${campaign.id}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Recipients-only save: omit `questions` so the server preserves
          // each row's groupId/audience/targets (managed on the questions page).
          body: JSON.stringify({
            employeeIds: Array.from(effectiveSelected),
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setErr(j.error || 'Auto-save failed');
          setSaveStatus('error');
          return;
        }
        setErr(null);
        setSaveStatus('saved');
        router.refresh();
      } catch {
        setSaveStatus('error');
      }
    }, 700);
    return () => clearTimeout(t);
    // Intentional: do not include campaign.questions in deps. Every server
    // refresh creates a fresh array reference and would re-fire the effect
    // even though the content is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmpIds, recipientsDirty, campaign.id, router]);

  async function send(resend = false, onlyUnsent = true) {
    if (saveStatus === 'saving') {
      setErr('Still saving — please wait a second and try again.');
      return;
    }
    if (!confirm(resend ? 'Send a reminder to everyone selected who has not yet submitted?' : "Send invitations to selected recipients who haven't been emailed yet?")) return;
    setBusy(true); setErr(null); setMsg(null);
    const assignmentIds = campaign.assignments
      .filter((a) => selectedEmpIds.has(a.employeeId))
      .filter((a) => (resend ? true : (onlyUnsent ? !a.emailSentAt : true)))
      .map((a) => a.id);
    const res = await fetch(`/api/admin/campaigns/${campaign.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentIds, resend }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'Failed'); return; }
    const j = await res.json();
    setMsg(`Sent ${j.sent}${j.failed?.length ? `, failed ${j.failed.length}` : ''}.`);
    router.refresh();
  }

  function toggleSet(set: Set<string>, id: string, fn: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    fn(next);
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">
          Recipients
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
            {selectedEmpIds.size} selected · {employees.length} total
          </span>
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && <span style={{ color: 'var(--error-text)' }}>Auto-save failed</span>}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FilterDropdown label="Location" items={locations} selected={locFilter} onToggle={(id) => toggleSet(locFilter, id, setLocFilter)} />
        <FilterDropdown label="Office type" items={officeTypes} selected={otFilter} onToggle={(id) => toggleSet(otFilter, id, setOtFilter)} />
        <FilterDropdown label="Department" items={departments} selected={deptFilter} onToggle={(id) => toggleSet(deptFilter, id, setDeptFilter)} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="input flex-1 min-w-[260px] max-w-xl"
          placeholder="Search name / code / email / designation…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          aria-label="Search recipients"
        />
        <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={addAllFiltered}>Add all matching ({filteredEmployees.length})</button>
        <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={removeAllFiltered}>Remove matching</button>
        <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => { setLocFilter(new Set()); setOtFilter(new Set()); setDeptFilter(new Set()); setSearch(''); setPage(1); }}>Clear filters</button>
      </div>

      <PaginationStats
        total={total}
        page={page}
        perPage={perPage}
        onPerPageChange={(p) => { setPerPage(p); setPage(1); }}
      />

      <div className="border border-[var(--border-primary)] rounded-lg overflow-x-auto">
        <table className="table !border-0 !rounded-none">
          <thead>
            <tr>
              <th className="!w-10"></th>
              <SortHeader field="empCode" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>Emp. Code</SortHeader>
              <SortHeader field="name" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>Name</SortHeader>
              <SortHeader field="group" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>Group</SortHeader>
              <SortHeader field="status" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>Status</SortHeader>
              <SortHeader field="sentAt" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>Sent at</SortHeader>
              <SortHeader field="openedAt" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>Opened at</SortHeader>
              <SortHeader field="submittedAt" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>Submitted at</SortHeader>
              <SortHeader field="reminders" sortField={sortField} sortDir={sortDir} onClick={toggleSort}>Reminders</SortHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {slice.map((e) => {
              const a = assignmentByEmp.get(e.id);
              const locked = lockedEmpIds.has(e.id);
              const checked = selectedEmpIds.has(e.id) || locked;
              return (
                <tr key={e.id} className={a?.submittedAt ? 'bg-[var(--status-success-bg)]' : ''}>
                  <td className="!w-10">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={() => toggleEmp(e.id)}
                      aria-label={`Select ${e.name}`}
                      title={locked ? 'Submitted recipients cannot be removed' : undefined}
                    />
                  </td>
                  <td className="font-mono text-xs">{e.empCode}</td>
                  <td>
                    <div>{e.name}</div>
                    <div className="text-xs text-[color:var(--text-muted)]">{e.designation}</div>
                  </td>
                  <td className="text-xs">{e.location.name} › {e.officeType.name} › {e.department.name}</td>
                  <td className="text-xs">
                    {a?.submittedAt ? <span className="badge pill-success" title={formatDateTime(a.submittedAt)}>Submitted</span>
                      : a?.confirmedAt ? <span className="badge pill-info" title={formatDateTime(a.confirmedAt)}>Confirmed</span>
                      : a?.emailOpenedAt ? <span className="badge pill-info" title={`Opened ${formatDateTime(a.emailOpenedAt)}`}>Opened</span>
                      : a?.emailSentAt ? <span className="badge pill-neutral" title={formatDateTime(a.emailSentAt)}>Sent</span>
                      : checked ? <span className="badge">Pending</span> : null}
                  </td>
                  <td className="text-xs whitespace-nowrap">
                    {a?.emailSentAt ? <span title={formatDateTime(a.emailSentAt)}>{formatDate(a.emailSentAt)}</span> : '—'}
                  </td>
                  <td className="text-xs whitespace-nowrap">
                    {a?.emailOpenedAt ? <span title={formatDateTime(a.emailOpenedAt)}>{formatDate(a.emailOpenedAt)}</span> : '—'}
                  </td>
                  <td className="text-xs whitespace-nowrap">
                    {a?.submittedAt ? <span title={formatDateTime(a.submittedAt)}>{formatDate(a.submittedAt)}</span> : '—'}
                  </td>
                  <td className="text-xs whitespace-nowrap">
                    {a?.reminderCount && a.reminderCount > 0
                      ? <span title={a.lastReminderSentAt ? `Last sent ${formatDateTime(a.lastReminderSentAt)}` : ''}>{a.reminderCount}</span>
                      : '—'}
                  </td>
                </tr>
              );
            })}
            {filteredEmployees.length === 0 && (
              <tr><td colSpan={9} className="text-center text-[color:var(--text-muted)] py-6">No matches</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationNav
        total={total}
        page={page}
        perPage={perPage}
        onPageChange={setPage}
      />

      {savedButUnsent > 0 && (
        <div className="banner-info rounded-md p-2 text-xs">
          {savedButUnsent} recipient(s) ready to be invited (no email sent yet).
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center pt-2 border-t border-[var(--border-subtle)]">
        <button className="btn" onClick={() => send(false, true)} disabled={busy || savedButUnsent === 0}
                title={savedButUnsent === 0 ? 'No new invites to send' : `Send to ${savedButUnsent} recipient(s)`}>
          Send invitations{savedButUnsent > 0 ? ` (${savedButUnsent})` : ''}
        </button>
        <button className="btn-secondary" onClick={() => send(true, false)} disabled={busy || pendingNonSubmitters === 0}
                title={pendingNonSubmitters === 0 ? 'Send invitations first — no invited recipients are pending a reminder.' : `Remind ${pendingNonSubmitters} invited non-submitter(s)`}>
          Send reminder ({pendingNonSubmitters})
        </button>
      </div>
      {msg && <div className="text-sm" style={{ color: 'var(--status-success-text)' }}>{msg}</div>}
      {err && <div className="form-error">{err}</div>}
    </div>
  );
}

function SortHeader<F extends string>({ field, sortField, sortDir, onClick, children }: {
  field: F; sortField: F; sortDir: 'asc' | 'desc'; onClick: (f: F) => void; children: React.ReactNode;
}) {
  const active = field === sortField;
  return (
    <th>
      <button
        type="button"
        onClick={() => onClick(field)}
        className="inline-flex items-center gap-1 text-current hover:opacity-80 transition-opacity mx-auto"
      >
        {children}
        <span className={'text-xs ' + (active ? 'opacity-100' : 'opacity-60')}>{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

function FilterDropdown({ label, items, selected, onToggle }: {
  label: string; items: { id: string; name: string }[]; selected: Set<string>; onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="label">{label} {selected.size > 0 && <span className="text-xs text-[color:var(--text-muted)]">({selected.size})</span>}</div>
      <div className="border border-[var(--border-primary)] rounded-lg bg-[var(--surface-primary)] h-48 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-xs text-[color:var(--text-muted)] p-3">No options</div>
        ) : items.map((it) => (
          <label key={it.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[var(--dropdown-hover)] cursor-pointer">
            <input type="checkbox" checked={selected.has(it.id)} onChange={() => onToggle(it.id)} />
            {it.name}
          </label>
        ))}
      </div>
    </div>
  );
}
