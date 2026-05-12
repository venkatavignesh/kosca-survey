'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function CampaignActionsMenu({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function duplicate() {
    setOpen(false);
    if (!confirm('Duplicate this campaign? A copy will be created in DRAFT status with all questions and groups, but no recipients.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Failed to duplicate campaign');
        return;
      }
      const clone = await res.json();
      startTransition(() => router.push(`/admin/campaigns/${clone.id}`));
    } catch (e: any) {
      alert(e?.message || 'Failed to duplicate campaign');
    } finally {
      setBusy(false);
    }
  }

  const itemClass =
    'block w-full text-left px-3 py-2 text-sm hover:bg-[color:var(--accent-hover)] focus:bg-[color:var(--accent-hover)] focus:outline-none';

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        className="btn-secondary inline-flex items-center gap-2"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={busy || pending}
      >
        {busy || pending ? 'Working…' : 'Actions'}
        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 z-50 min-w-[12rem] rounded-md border shadow-lg overflow-hidden"
          style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}
        >
          <Link
            role="menuitem"
            href={`/admin/campaigns/${campaignId}/edit`}
            className={itemClass}
            style={{ color: 'var(--text-primary)' }}
            onClick={() => setOpen(false)}
          >
            Edit settings
          </Link>
          <Link
            role="menuitem"
            href={`/admin/campaigns/${campaignId}/questions`}
            className={itemClass}
            style={{ color: 'var(--text-primary)' }}
            onClick={() => setOpen(false)}
          >
            Manage questions
          </Link>
          <Link
            role="menuitem"
            href={`/admin/campaigns/${campaignId}/report`}
            className={itemClass}
            style={{ color: 'var(--text-primary)' }}
            onClick={() => setOpen(false)}
          >
            View Report
          </Link>
          <button
            role="menuitem"
            type="button"
            className={itemClass}
            style={{ color: 'var(--text-primary)' }}
            onClick={duplicate}
          >
            Duplicate
          </button>
        </div>
      )}
    </div>
  );
}
