'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PaginationStats, PaginationNav, usePaginated, PerPage } from '@/components/Pagination';
import { Modal } from '@/components/Modal';

type QType = 'RADIO' | 'CHECKBOX' | 'MCQ_SINGLE' | 'MCQ_MULTI' | 'TEXT' | 'LONG_TEXT';
type Q = { id: string; text: string; type: QType; options: string[] | null; required: boolean; allowText: boolean; textRequired: boolean; createdAt: string };

const TYPES: { value: QType; label: string; needsOptions: boolean }[] = [
  { value: 'RADIO', label: 'Radio (single choice)', needsOptions: true },
  { value: 'MCQ_SINGLE', label: 'MCQ (single)', needsOptions: true },
  { value: 'CHECKBOX', label: 'Checkbox (multi)', needsOptions: true },
  { value: 'MCQ_MULTI', label: 'MCQ (multi)', needsOptions: true },
  { value: 'TEXT', label: 'Short text', needsOptions: false },
  { value: 'LONG_TEXT', label: 'Long text', needsOptions: false },
];

export function QuestionsClient({ questions }: { questions: Q[] }) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Q | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(10);
  const { slice, total } = usePaginated(questions, page, perPage);

  async function remove(id: string, label: string) {
    if (!confirm(`Delete "${label}"?`)) return;
    const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || 'Failed'); return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Question bank</h1>
        <button className="btn" onClick={() => setShowNew(true)}>New question</button>
      </div>
      <div className="card overflow-x-auto">
        <div className="pb-3">
          <PaginationStats total={total} page={page} perPage={perPage} onPerPageChange={(p) => { setPerPage(p); setPage(1); }} />
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Question</th>
              <th>Type</th>
              <th>Options</th>
              <th>Required</th>
              <th className="">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {slice.map((q) => (
              <tr key={q.id}>
                <td className="max-w-xl">{q.text} {q.required && <span className="text-[color:var(--error-text)]" title="Required">*</span>}</td>
                <td><span className="badge">{q.type}</span></td>
                <td className="text-[color:var(--text-secondary)] text-xs">
                  {q.options?.join(' · ') || '—'}
                  {q.allowText && (
                    <span className="ml-2 badge pill-info" title={q.textRequired ? 'Comment required' : 'Comment optional'}>
                      + comment{q.textRequired ? '*' : ''}
                    </span>
                  )}
                </td>
                <td>{q.required ? 'Yes' : 'No'}</td>
                <td className="">
                  <div className="flex gap-2 justify-center">
                    <button className="btn-secondary !py-1 !px-3 text-xs" onClick={() => setEditing(q)}>Edit</button>
                    <button className="btn-danger !py-1 !px-3 text-xs" onClick={() => remove(q.id, q.text.slice(0, 40))}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {questions.length === 0 && <tr><td colSpan={5} className="text-center text-[color:var(--text-muted)] py-6">No questions yet.</td></tr>}
          </tbody>
        </table>
        <div className="pt-3">
          <PaginationNav total={total} page={page} perPage={perPage} onPageChange={setPage} />
        </div>
      </div>
      {showNew && <Editor mode="create" onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); router.refresh(); }} />}
      {editing && <Editor mode="edit" question={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}

function Editor({ mode, question, onClose, onDone }: {
  mode: 'create' | 'edit'; question?: Q; onClose: () => void; onDone: () => void;
}) {
  const [text, setText] = useState(question?.text || '');
  const [type, setType] = useState<QType>(question?.type || 'RADIO');
  const [options, setOptions] = useState<string[]>(question?.options || ['', '']);
  const [required, setRequired] = useState<boolean>(question?.required || false);
  const [allowText, setAllowText] = useState<boolean>(question?.allowText || false);
  const [textRequired, setTextRequired] = useState<boolean>(question?.textRequired || false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const needsOpts = TYPES.find((t) => t.value === type)?.needsOptions;
  // Comment box only makes sense alongside choice questions; pure-text types already are text.
  const canAllowText = !!needsOpts;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const opts = needsOpts ? options.map((o) => o.trim()).filter(Boolean) : undefined;
    const url = mode === 'create' ? '/api/admin/questions' : `/api/admin/questions/${question!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        type,
        options: opts,
        required,
        allowText: canAllowText && allowText,
        textRequired: canAllowText && allowText && textRequired,
      }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'Failed'); return; }
    onDone();
  }

  return (
    <Modal title={mode === 'create' ? 'New question' : 'Edit question'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
          <div>
            <label htmlFor="question-text" className="label">Question text</label>
            <textarea id="question-text" className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="question-type" className="label">Type</label>
            <select id="question-type" className="input" value={type} onChange={(e) => setType(e.target.value as QType)}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {needsOpts && (
            <fieldset className="border-0 p-0 m-0">
              <legend className="label">Options</legend>
              <div className="space-y-2">
                {options.map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input" aria-label={`Option ${i + 1}`} value={o} onChange={(e) => setOptions(options.map((x, j) => j === i ? e.target.value : x))} />
                    <button type="button" className="btn-secondary !py-1 !px-3 text-xs" onClick={() => setOptions(options.filter((_, j) => j !== i))}>Remove</button>
                  </div>
                ))}
                <button type="button" className="btn-secondary !py-1 !px-3 text-xs" onClick={() => setOptions([...options, ''])}>Add option</button>
              </div>
            </fieldset>
          )}
          <label className="flex items-center gap-2 text-sm pt-2">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Required
          </label>

          {canAllowText && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowText} onChange={(e) => { setAllowText(e.target.checked); if (!e.target.checked) setTextRequired(false); }} />
                Allow additional comment (short text)
              </label>
              {allowText && (
                <label className="flex items-center gap-2 text-sm pl-6" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={textRequired} onChange={(e) => setTextRequired(e.target.checked)} />
                  Comment is required
                </label>
              )}
            </div>
          )}
          {err && <div className="form-error">{err}</div>}
          <div className="flex gap-2 justify-end pt-2 border-t border-[var(--border-subtle)]">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={busy}>{busy ? (mode === 'create' ? 'Creating…' : 'Saving…') : (mode === 'create' ? 'Create' : 'Save')}</button>
          </div>
        </form>
    </Modal>
  );
}
