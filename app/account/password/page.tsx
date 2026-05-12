'use client';
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { update, data: session } = useSession();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmNewPassword, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (newPassword !== confirmNewPassword) {
      setErr('New passwords do not match.');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || 'Failed to change password');
      return;
    }
    setOk('Password updated.');
    setCurrent('');
    setNew('');
    setConfirm('');
    await update();
    setTimeout(() => {
      router.push(session?.user.role === 'ADMIN' ? '/admin' : '/hr');
      router.refresh();
    }, 600);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Change password</h1>
          {session?.user.mustChangePassword && (
            <p role="alert" className="banner-warn text-sm rounded p-2 mt-2">
              You must change your password before continuing.
            </p>
          )}
        </div>
        <div>
          <label className="label">Current password</label>
          <input type="password" className="input" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
        </div>
        <div>
          <label className="label">New password</label>
          <input type="password" className="input" value={newPassword} onChange={(e) => setNew(e.target.value)} required autoComplete="new-password" />
          <p className="text-xs text-[color:var(--text-muted)] mt-1">At least 8 chars with letter, digit, and symbol.</p>
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input type="password" className="input" value={confirmNewPassword} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
        </div>
        {err && <div className="form-error">{err}</div>}
        {ok && <div className="text-sm text-[color:var(--status-success-text)]">{ok}</div>}
        <div className="flex gap-2">
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Saving…' : 'Update password'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => signOut({ callbackUrl: '/login' })}>
            Sign out
          </button>
        </div>
      </form>
    </div>
  );
}
