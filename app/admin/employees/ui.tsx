'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PaginationStats, PaginationNav, usePaginated, PerPage } from '@/components/Pagination';
import { Modal } from '@/components/Modal';

type Master = { id: string; name: string };
type Employee = {
  id: string;
  empCode: string;
  name: string;
  email: string;
  designation: string;
  location: Master;
  officeType: Master;
  department: Master;
};

export function EmployeesClient({
  employees, locations, officeTypes, departments, filters, readOnly,
}: {
  employees: Employee[];
  locations: Master[];
  officeTypes: Master[];
  departments: Master[];
  filters: { locationIds: string[]; officeTypeIds: string[]; departmentIds: string[]; q: string };
  readOnly: boolean;
}) {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(10);
  const { slice, total } = usePaginated(employees, page, perPage);

  function applyFilter(updates: Record<string, string[] | string | undefined>) {
    const params = new URLSearchParams();
    const set = (k: string, v: string[] | string | undefined) => {
      if (v == null) return;
      if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
      else if (v) params.set(k, v);
    };
    const merged = {
      locationId: 'locationIds' in updates ? (updates.locationIds as string[]) : filters.locationIds,
      officeTypeId: 'officeTypeIds' in updates ? (updates.officeTypeIds as string[]) : filters.officeTypeIds,
      departmentId: 'departmentIds' in updates ? (updates.departmentIds as string[]) : filters.departmentIds,
      q: 'q' in updates ? (updates.q as string) : filters.q,
    };
    set('locationId', merged.locationId);
    set('officeTypeId', merged.officeTypeId);
    set('departmentId', merged.departmentId);
    if (merged.q) set('q', merged.q);
    router.push('?' + params.toString());
  }

  function toggle(arr: string[], id: string): string[] {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Delete ${label}?`)) return;
    const res = await fetch(`/api/admin/employees/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Failed'); return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Employees ({employees.length})</h1>
          {!readOnly && (
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setShowImport(true)}>Import CSV</button>
              <button className="btn" onClick={() => setShowNew(true)}>New employee</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterBox label="Location" items={locations} selected={filters.locationIds}
            onToggle={(id) => applyFilter({ locationIds: toggle(filters.locationIds, id) })} />
          <FilterBox label="Office type" items={officeTypes} selected={filters.officeTypeIds}
            onToggle={(id) => applyFilter({ officeTypeIds: toggle(filters.officeTypeIds, id) })} />
          <FilterBox label="Department" items={departments} selected={filters.departmentIds}
            onToggle={(id) => applyFilter({ departmentIds: toggle(filters.departmentIds, id) })} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap pb-3">
          <div className="flex-1 min-w-[260px] max-w-md">
            <SearchBox value={filters.q} onSubmit={(v) => applyFilter({ q: v })} />
          </div>
          <PaginationStats total={total} page={page} perPage={perPage} onPerPageChange={(p) => { setPerPage(p); setPage(1); }} />
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Emp. Code</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Email</th>
              <th>Location</th>
              <th>Office</th>
              <th>Dept</th>
              {!readOnly && <th>Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {slice.map((e) => (
              <tr key={e.id}>
                <td className="font-mono text-xs">{e.empCode}</td>
                <td>{e.name}</td>
                <td className="text-[color:var(--text-secondary)]">{e.designation}</td>
                <td className="text-[color:var(--text-secondary)]">{e.email}</td>
                <td>{e.location.name}</td>
                <td>{e.officeType.name}</td>
                <td>{e.department.name}</td>
                {!readOnly && (
                  <td>
                    <div className="flex gap-2 justify-center">
                      <button className="btn-secondary !py-1 !px-3 text-xs" onClick={() => setEditing(e)}>Edit</button>
                      <button className="btn-danger !py-1 !px-3 text-xs" onClick={() => remove(e.id, e.name)}>Delete</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan={8} className="text-center text-[color:var(--text-muted)] py-6">No employees match.</td></tr>
            )}
          </tbody>
        </table>
        <div className="pt-3">
          <PaginationNav total={total} page={page} perPage={perPage} onPageChange={setPage} />
        </div>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={() => router.refresh()} />}
      {showNew && <EditModal mode="create" locations={locations} officeTypes={officeTypes} departments={departments} onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); router.refresh(); }} />}
      {editing && <EditModal mode="edit" employee={editing} locations={locations} officeTypes={officeTypes} departments={departments} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}

function FilterBox({ label, items, selected, onToggle }: {
  label: string; items: Master[]; selected: string[]; onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="border border-[var(--border-primary)] rounded bg-[var(--surface-primary)] max-h-40 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-xs text-[color:var(--text-muted)] p-2">No options</div>
        ) : items.map((it) => (
          <label key={it.id} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-[var(--dropdown-hover)] cursor-pointer">
            <input type="checkbox" checked={selected.includes(it.id)} onChange={() => onToggle(it.id)} />
            {it.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function SearchBox({ value, onSubmit }: { value: string; onSubmit: (v: string) => void }) {
  const [v, setV] = useState(value);
  // Re-sync if the parent's value changes (e.g. via a Clear-all link).
  useEffect(() => { setV(value); }, [value]);
  // Reactive: debounce the parent callback so each keystroke doesn't fire a
  // navigation. Skip the initial mount so we don't re-submit on first render.
  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return; }
    const t = setTimeout(() => { onSubmit(v.trim()); }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return (
    <div>
      <label htmlFor="employees-search" className="label">Search</label>
      <div className="relative">
        <input
          id="employees-search"
          type="search"
          className="input pr-9"
          placeholder="name / code / email…"
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
        {v && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setV('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--accent-hover)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function EditModal({
  mode, employee, locations, officeTypes, departments, onClose, onDone,
}: {
  mode: 'create' | 'edit';
  employee?: Employee;
  locations: Master[]; officeTypes: Master[]; departments: Master[];
  onClose: () => void; onDone: () => void;
}) {
  const [f, setF] = useState(() => ({
    empCode: employee?.empCode || '',
    name: employee?.name || '',
    email: employee?.email || '',
    designation: employee?.designation || '',
    locationId: employee?.location.id || locations[0]?.id || '',
    officeTypeId: employee?.officeType.id || officeTypes[0]?.id || '',
    departmentId: employee?.department.id || departments[0]?.id || '',
  }));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const url = mode === 'create' ? '/api/admin/employees' : `/api/admin/employees/${employee!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || 'Failed'); return;
    }
    onDone();
  }

  return (
    <Modal size="xl" title={mode === 'create' ? 'New employee' : `Edit ${employee?.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="emp-code" className="label">Employee code</label>
            <input id="emp-code" className="input" required value={f.empCode} onChange={(e) => setF({ ...f, empCode: e.target.value })} />
          </div>
          <div>
            <label htmlFor="emp-name" className="label">Name</label>
            <input id="emp-name" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="emp-email" className="label">Email</label>
            <input id="emp-email" className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
          <div>
            <label htmlFor="emp-designation" className="label">Designation</label>
            <input id="emp-designation" className="input" required value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} />
          </div>
          <div>
            <label htmlFor="emp-location" className="label">Location</label>
            <select id="emp-location" className="input" value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })} required>
              {locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="emp-office-type" className="label">Office type</label>
            <select id="emp-office-type" className="input" value={f.officeTypeId} onChange={(e) => setF({ ...f, officeTypeId: e.target.value })} required>
              {officeTypes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="emp-department" className="label">Department</label>
            <select id="emp-department" className="input" value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })} required>
              {departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        </div>
        {err && <div className="form-error">{err}</div>}
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>{mode === 'create' ? 'Create' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [autoCreate, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('autoCreate', String(autoCreate));
    setBusy(true);
    const res = await fetch('/api/admin/employees/import', { method: 'POST', body: fd });
    setBusy(false);
    setResult(await res.json());
  }

  return (
    <Modal size="xl" title="Import employees from CSV" onClose={onClose}>
      <form onSubmit={upload} className="space-y-3">
        <p className="text-sm text-[color:var(--text-secondary)]">
          Required columns: <code className="font-mono">empCode,name,email,designation,location,officeType,department</code>
        </p>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoCreate} onChange={(e) => setAuto(e.target.checked)} />
          Auto-create missing Location / Office type / Department entries
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn" disabled={!file || busy}>{busy ? 'Uploading…' : 'Upload'}</button>
        </div>
        {result && (
          <div className="rounded bg-[var(--surface-secondary)] border border-[var(--border-primary)] p-3 text-sm">
            <div>Inserted: <b>{result.inserted}</b> · Updated: <b>{result.updated}</b> · Errors: <b>{result.errors?.length || 0}</b></div>
            {result.errors?.length > 0 && (
              <ul className="mt-2 list-disc pl-5 max-h-40 overflow-auto text-xs">
                {result.errors.map((e: any, i: number) => <li key={i}>Row {e.row}: {e.reason}</li>)}
              </ul>
            )}
            {(result.inserted > 0 || result.updated > 0) && (
              <button type="button" className="btn-secondary mt-2 !py-1 !px-3 text-xs" onClick={onDone}>Refresh list</button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

// Modal primitive lives in components/Modal.tsx (shared with admin/questions/ui.tsx).
