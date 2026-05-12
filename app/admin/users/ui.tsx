'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PaginationStats, PaginationNav, usePaginated, PerPage } from '@/components/Pagination';
import { formatDate } from '@/lib/dates';

type U = {
  id: string; email: string; name: string; role: 'ADMIN' | 'HR';
  mustChangePassword: boolean; passwordChangedAt: string | null; createdAt: string;
};

export function UsersClient({ users }: { users: U[] }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'HR'>('HR');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tempPwd, setTempPwd] = useState<{ email: string; password: string } | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(10);
  const { slice, total } = usePaginated(users, page, perPage);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, role }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || 'Failed'); return;
    }
    const j = await res.json();
    setTempPwd({ email, password: j.tempPassword });
    setEmail(''); setName(''); setRole('HR');
    router.refresh();
  }

  async function reset(id: string, email: string) {
    if (!confirm(`Reset password for ${email}? They'll be forced to change on next login.`)) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resetPassword' }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Failed'); return;
    }
    const j = await res.json();
    setTempPwd({ email, password: j.tempPassword });
    router.refresh();
  }

  async function remove(id: string, email: string) {
    if (!confirm(`Delete user ${email}?`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Failed'); return;
    }
    router.refresh();
  }

  async function changeRole(id: string, role: 'ADMIN' | 'HR') {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Failed'); return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">Staff users</h1>
        <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label htmlFor="new-user-email" className="label">Email</label>
            <input id="new-user-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="new-user-name" className="label">Name</label>
            <input id="new-user-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="new-user-role" className="label">Role</label>
            <select id="new-user-role" className="input" value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="HR">HR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
        </form>
        {err && <div className="form-error">{err}</div>}
        {tempPwd && (
          <div role="alert" className="banner-warn rounded-md p-3 text-sm">
            <div className="font-semibold">Temporary password for {tempPwd.email}</div>
            <div className="font-mono text-base mt-1">{tempPwd.password}</div>
            <div className="text-xs text-[color:var(--status-warn-text)] mt-1">Share this securely. The user will be forced to change it on first login.</div>
            <button className="btn-secondary !py-1 !px-3 text-xs mt-2" onClick={() => setTempPwd(null)}>Dismiss</button>
          </div>
        )}
      </div>
      <div className="card overflow-x-auto">
        <div className="pb-3">
          <PaginationStats total={total} page={page} perPage={perPage} onPerPageChange={(p) => { setPerPage(p); setPage(1); }} />
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Password status</th>
              <th className="">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {slice.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name}</td>
                <td>
                  <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value as any)} className="input !py-1">
                    <option value="HR">HR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td>
                  {u.mustChangePassword
                    ? <span className="badge pill-warn">Must change</span>
                    : <span className="badge">Set {u.passwordChangedAt ? formatDate(u.passwordChangedAt) : ''}</span>}
                </td>
                <td className="">
                  <div className="flex gap-2 justify-center">
                    <button className="btn-secondary !py-1 !px-3 text-xs" onClick={() => reset(u.id, u.email)}>Reset password</button>
                    <button className="btn-danger !py-1 !px-3 text-xs" onClick={() => remove(u.id, u.email)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pt-3">
          <PaginationNav total={total} page={page} perPage={perPage} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
