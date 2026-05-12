'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PaginationStats, PaginationNav, usePaginated, PerPage } from './Pagination';

type Item = { id: string; name: string; _count?: { employees: number } };

export function MasterListClient({
  title,
  apiBase,
  items,
}: {
  title: string;
  apiBase: string;
  items: Item[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(10);
  const { slice, total } = usePaginated(items, page, perPage);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || 'Failed');
      return;
    }
    setName('');
    router.refresh();
  }

  async function save(id: string) {
    setBusy(true);
    const res = await fetch(`${apiBase}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || 'Failed');
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm('Delete this entry?')) return;
    setBusy(true);
    const res = await fetch(`${apiBase}/${id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || 'Cannot delete');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <form onSubmit={add} className="mt-3 flex gap-2 max-w-md items-end">
          <div className="flex-1">
            <label htmlFor="master-list-name" className="label">Name</label>
            <input id="master-list-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn" disabled={busy || !name.trim()}>{busy ? 'Adding…' : 'Add'}</button>
        </form>
        {err && <div className="form-error mt-2">{err}</div>}
      </div>
      <div className="card overflow-x-auto">
        <div className="pb-3">
          <PaginationStats total={total} page={page} perPage={perPage} onPerPageChange={(p) => { setPerPage(p); setPage(1); }} />
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Employees</th>
              <th className="w-40">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {slice.map((it) => (
              <tr key={it.id}>
                <td>
                  {editingId === it.id ? (
                    <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  ) : (
                    it.name
                  )}
                </td>
                <td>{it._count?.employees ?? 0}</td>
                <td className="">
                  {editingId === it.id ? (
                    <div className="flex gap-2 justify-center">
                      <button className="btn !py-1 !px-3 text-xs" onClick={() => save(it.id)} disabled={busy}>Save</button>
                      <button className="btn-secondary !py-1 !px-3 text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-center">
                      <button className="btn-secondary !py-1 !px-3 text-xs" onClick={() => { setEditingId(it.id); setEditName(it.name); }}>Edit</button>
                      <button className="btn-danger !py-1 !px-3 text-xs" onClick={() => remove(it.id)}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={3} className="text-[color:var(--text-muted)] text-center py-6">No entries yet.</td></tr>
            )}
          </tbody>
        </table>
        <div className="pt-3">
          <PaginationNav total={total} page={page} perPage={perPage} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
