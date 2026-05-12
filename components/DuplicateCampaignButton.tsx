'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function DuplicateCampaignButton({
  campaignId,
  className = 'btn-secondary !py-1 !px-3 text-xs',
}: {
  campaignId: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function duplicate() {
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
      // Navigate to the new campaign so the admin lands on the editable copy.
      startTransition(() => router.push(`/admin/campaigns/${clone.id}`));
    } catch (e: any) {
      alert(e?.message || 'Failed to duplicate campaign');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={duplicate} disabled={busy || pending}>
      {busy || pending ? 'Duplicating…' : 'Duplicate'}
    </button>
  );
}
