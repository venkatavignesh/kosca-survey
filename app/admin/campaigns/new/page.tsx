'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const DEFAULT_SUBJECT = 'Appraisal survey for {{name}} ({{empCode}})';
const DEFAULT_BODY = `Hi {{name}},

Please take a few minutes to complete the {{title}} survey.

{{#deadline}}Please submit by {{deadline}}.{{/deadline}}`;

export default function NewCampaignPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch('/api/admin/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, description,
        emailSubjectTemplate: subject,
        emailBodyTemplate: body,
        // Treat the chosen date as inclusive: keep the survey open until 23:59:59 IST of that day.
        // Pinning to +05:30 makes the cutoff identical regardless of the admin's browser TZ.
        deadline: deadline ? new Date(`${deadline}T23:59:59+05:30`).toISOString() : null,
      }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'Failed'); return; }
    const c = await res.json();
    router.push(`/admin/campaigns/${c.id}`);
  }

  return (
    <form onSubmit={submit} className="card max-w-3xl mx-auto space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">New campaign</h1>

      <div>
        <label htmlFor="campaign-title" className="label">Title</label>
        <input id="campaign-title" className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <label htmlFor="campaign-description" className="label">Description (optional)</label>
        <textarea id="campaign-description" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div>
        <label htmlFor="campaign-deadline" className="label">Deadline (optional)</label>
        <input id="campaign-deadline" type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-describedby="campaign-deadline-help" />
        <p id="campaign-deadline-help" className="text-xs text-[color:var(--text-muted)] mt-1">Submissions are accepted through the end of this day (local time).</p>
      </div>

      <div>
        <label htmlFor="campaign-subject" className="label">Email subject template</label>
        <input id="campaign-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required aria-describedby="campaign-subject-help" />
        <p id="campaign-subject-help" className="text-xs text-[color:var(--text-muted)] mt-1">Available: {'{{name}}, {{empCode}}, {{designation}}, {{title}}, {{deadline}}'}</p>
      </div>

      <div>
        <label htmlFor="campaign-body" className="label">Email body template</label>
        <textarea id="campaign-body" className="input font-mono text-xs" rows={10} value={body} onChange={(e) => setBody(e.target.value)} required aria-describedby="campaign-body-help" />
        <p id="campaign-body-help" className="text-xs text-[color:var(--text-muted)] mt-1">
          Same vars + {'{{url}}'}. Use {'{{#deadline}}…{{/deadline}}'} to wrap copy that should only appear when a deadline is set. The verification code is sent in a separate email when the employee opens the link.
        </p>
      </div>

      {err && <div className="form-error">{err}</div>}

      <div className="flex gap-2 justify-end">
        <Link href="/admin/campaigns" className="btn-secondary">Cancel</Link>
        <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create campaign'}</button>
      </div>
    </form>
  );
}
