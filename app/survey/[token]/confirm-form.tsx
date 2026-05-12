'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const COOLDOWN_S = 30;

export function ConfirmForm({ token, maskedEmail }: { token: string; maskedEmail: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode() {
    setSending(true); setErr(null); setInfo(null);
    const res = await fetch(`/api/survey/${token}/request-code`, { method: 'POST' });
    setSending(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || 'Failed to send code');
      return;
    }
    const j = await res.json();
    setHasSent(true);
    setInfo(`We've emailed a 6-digit code to ${j.sentTo || maskedEmail}. It expires in ${j.ttlMinutes || 15} minutes.`);
    setCooldown(COOLDOWN_S);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch(`/api/survey/${token}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || 'Failed'); return;
    }
    router.push(`/survey/${token}/form`);
    router.refresh();
  }

  if (!hasSent) {
    return (
      <div className="space-y-3">
        {err && <div className="form-error">{err}</div>}
        <button
          className="btn w-full !py-3 text-base"
          disabled={sending}
          onClick={requestCode}
          style={{ background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
        >
          {sending ? 'Sending…' : 'Email me a verification code'}
        </button>
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          We'll send a 6-digit code to your work email. Valid for 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {info && <div className="banner-success rounded-lg text-sm p-3" role="status">{info}</div>}
      <div>
        <label htmlFor="otp-code" className="label">Enter the 6-digit code</label>
        <input
          id="otp-code"
          className="input font-mono text-center tracking-widest text-2xl !py-3"
          required
          maxLength={6}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      {err && <div className="form-error">{err}</div>}
      <button
        className="btn w-full !py-3 text-base"
        disabled={busy || code.length < 4}
        style={{ background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
      >
        {busy ? 'Verifying…' : 'Continue'}
      </button>
      <button
        type="button"
        className="text-sm w-full text-center hover:underline disabled:opacity-50"
        style={{ color: 'var(--text-secondary)' }}
        onClick={requestCode}
        disabled={cooldown > 0 || sending}
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : sending ? 'Sending…' : "Didn't get it? Send a new code"}
      </button>
    </form>
  );
}
