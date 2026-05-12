'use client';
import { Suspense, useState } from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Sanitize callbackUrl: only accept same-origin paths so we never push the
  // browser to a different host than the one the user is currently on.
  function safeCallback(raw: string | null): string {
    if (!raw) return '/';
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
    try {
      const u = new URL(raw, window.location.origin);
      if (u.origin === window.location.origin) return u.pathname + u.search + u.hash;
    } catch {/* fall through */}
    return '/';
  }
  const callbackUrl = safeCallback(params.get('callbackUrl'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (!res || res.error) {
      setErr('Invalid email or password');
      return;
    }
    // Always navigate via a relative path so the browser keeps the current
    // host (LAN IP or public domain). Ignore res.url which NextAuth builds
    // from NEXTAUTH_URL and would force a host switch.
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--page-bg)' }}>
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <Image
            src="/kosca-logo.png"
            alt="Kosca"
            width={48}
            height={48}
            priority
            className="h-12 w-12 object-contain"
          />
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">
              <span style={{ color: 'var(--accent-primary)' }}>Kosca Distribution LLP</span>
              <span className="mx-1.5" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>|</span>
              <span style={{ color: 'var(--accent-primary)' }}>Survey</span>
            </h1>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Staff sign in</p>
          </div>
          <ThemeToggle />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            suppressHydrationWarning
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            suppressHydrationWarning
          />
        </div>
        {err && <div className="form-error">{err}</div>}
        <button type="submit" className="btn w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
