'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Status = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export function CampaignEditForm(props: {
  id: string;
  title: string;
  description: string;
  deadline: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  status: Status;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(props.title);
  const [description, setDescription] = useState(props.description);
  const [deadline, setDeadline] = useState(props.deadline);
  const [subject, setSubject] = useState(props.emailSubjectTemplate);
  const [body, setBody] = useState(props.emailBodyTemplate);
  const [status, setStatus] = useState<Status>(props.status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    const res = await fetch(`/api/admin/campaigns/${props.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        emailSubjectTemplate: subject,
        emailBodyTemplate: body,
        status,
        // Inclusive: keep the survey open until 23:59:59 IST of that day.
        // Pin to +05:30 so the cutoff is consistent regardless of admin browser TZ.
        deadline: deadline ? new Date(`${deadline}T23:59:59+05:30`).toISOString() : null,
      }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'Failed'); return; }
    setMsg('Saved.');
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete campaign "${title}"? This will also remove all assignments and responses.`)) return;
    setBusy(true); setErr(null);
    const res = await fetch(`/api/admin/campaigns/${props.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'Failed'); return; }
    router.push('/admin/campaigns');
  }

  return (
    <form onSubmit={save} className="card max-w-3xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Edit campaign</h1>
        <Link href={`/admin/campaigns/${props.id}`} className="text-sm text-[color:var(--text-secondary)] hover:underline">← Back to builder</Link>
      </div>

      <div>
        <label htmlFor="edit-campaign-title" className="label">Title</label>
        <input id="edit-campaign-title" className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <label htmlFor="edit-campaign-description" className="label">Description (optional)</label>
        <textarea id="edit-campaign-description" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-campaign-deadline" className="label">Deadline (optional)</label>
          <input id="edit-campaign-deadline" type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-describedby="edit-campaign-deadline-help" />
          <p id="edit-campaign-deadline-help" className="text-xs text-[color:var(--text-muted)] mt-1">Submissions accepted through end of that day.</p>
        </div>
        <div>
          <label htmlFor="edit-campaign-status" className="label">Status</label>
          <select id="edit-campaign-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="DRAFT">DRAFT (no emails will go out)</option>
            <option value="ACTIVE">ACTIVE (employees can submit)</option>
            <option value="CLOSED">CLOSED (no more submissions accepted)</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="edit-campaign-subject" className="label">Email subject template</label>
        <input id="edit-campaign-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required aria-describedby="edit-campaign-subject-help" />
        <p id="edit-campaign-subject-help" className="text-xs text-[color:var(--text-muted)] mt-1">Available: {'{{name}}, {{empCode}}, {{designation}}, {{title}}, {{deadline}}'}</p>
      </div>

      <div>
        <label htmlFor="edit-campaign-body" className="label">Email body template</label>
        <textarea id="edit-campaign-body" className="input font-mono text-xs" rows={10} value={body} onChange={(e) => setBody(e.target.value)} required aria-describedby="edit-campaign-body-help" />
        <p id="edit-campaign-body-help" className="text-xs text-[color:var(--text-muted)] mt-1">
          Same vars + {'{{url}}'}. Use {'{{#deadline}}…{{/deadline}}'} to wrap copy that should only appear when a deadline is set. The verification code is sent in a separate email when the employee opens the link.
        </p>
      </div>

      {err && <div className="form-error">{err}</div>}
      {msg && <div className="text-sm text-[color:var(--status-success-text)]">{msg}</div>}

      <div className="flex gap-2 justify-between pt-2 border-t border-[var(--border-primary)]">
        <button type="button" className="btn-danger" onClick={remove} disabled={busy}>Delete campaign</button>
        <div className="flex gap-2">
          <Link href={`/admin/campaigns/${props.id}`} className="btn-secondary">Cancel</Link>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </form>
  );
}
