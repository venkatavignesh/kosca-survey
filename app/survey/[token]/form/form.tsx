'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type QType = 'RADIO' | 'CHECKBOX' | 'MCQ_SINGLE' | 'MCQ_MULTI' | 'TEXT' | 'LONG_TEXT';
type Q = {
  id: string;
  text: string;
  type: QType;
  options: string[] | null;
  required: boolean;
  allowText?: boolean;       // choice questions only — show optional comment box
  textRequired?: boolean;    // when allowText, force comment to be filled
  textLabel?: string | null; // custom label for the comment box; null → "Additional comment"
};
type Answers = Record<string, { valueText?: string; valueOptions?: string[] }>;

const PER_PAGE = 10;

export function SurveyForm({ token, questions }: { token: string; questions: Q[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(questions.length / PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * PER_PAGE;
  const slice = questions.slice(startIdx, startIdx + PER_PAGE);
  const isLastPage = safePage >= totalPages;

  // Any error banner is scoped to the page that produced it. Wipe it when
  // the user moves to a different page so they never see "answer Q11" on a
  // page where Q11 isn't even shown.
  useEffect(() => {
    setErr(null);
  }, [safePage]);

  function setText(qid: string, v: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], valueText: v } }));
    setErr(null);
  }
  function setComment(qid: string, v: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], valueText: v } }));
    setErr(null);
  }
  function setSingle(qid: string, opt: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], valueOptions: [opt] } }));
    setErr(null);
  }
  function toggleMulti(qid: string, opt: string) {
    setAnswers((a) => {
      const cur = a[qid]?.valueOptions || [];
      const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
      return { ...a, [qid]: { ...a[qid], valueOptions: next } };
    });
    setErr(null);
  }

  // Returns the 1-based index of the first unanswered required question in
  // the given scope, or 0 if everything is satisfied. textRequired (comment)
  // is enforced independently of the primary required flag.
  function firstMissingRequired(scope: Q[]): number {
    for (let i = 0; i < scope.length; i++) {
      const q = scope[i];
      const a = answers[q.id];
      const isText = q.type === 'TEXT' || q.type === 'LONG_TEXT';
      if (q.required) {
        if (isText) {
          if (!a?.valueText || !a.valueText.trim()) return i + 1;
        } else if (!a?.valueOptions || a.valueOptions.length === 0) {
          return i + 1;
        }
      }
      if (q.allowText && q.textRequired) {
        if (!a?.valueText || !a.valueText.trim()) return i + 1;
      }
    }
    return 0;
  }

  function scrollToQuestion(qid: string) {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      document.getElementById(`q-${qid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function goNext() {
    setErr(null);
    // Validate ONLY the current page — never peek at the next page's questions.
    const missing = firstMissingRequired(slice);
    if (missing) {
      const q = slice[missing - 1];
      setErr(`Please answer question ${startIdx + missing} before continuing.`);
      scrollToQuestion(q.id);
      return;
    }
    setPage(safePage + 1);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goPrev() {
    setErr(null);
    setPage(safePage - 1);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    // Validate ONLY the current (last) page on submit. Earlier pages were
    // already gated by goNext, so by construction they're complete.
    const missing = firstMissingRequired(slice);
    if (missing) {
      const q = slice[missing - 1];
      setErr(`Please answer question ${startIdx + missing} before submitting.`);
      scrollToQuestion(q.id);
      return;
    }
    setBusy(true);
    const payload = {
      answers: questions.map((q) => ({
        questionId: q.id,
        valueText: answers[q.id]?.valueText,
        valueOptions: answers[q.id]?.valueOptions,
      })),
    };
    try {
      const res = await fetch(`/api/survey/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || 'Failed to submit');
        return;
      }
      router.push(`/survey/${token}/done`);
    } catch {
      setErr('Network error — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const pageAnswered = useMemo(() => slice.filter((q) => {
    const a = answers[q.id];
    if (q.type === 'TEXT' || q.type === 'LONG_TEXT') return !!a?.valueText && !!a.valueText.trim();
    return !!a?.valueOptions && a.valueOptions.length > 0;
  }).length, [slice, answers]);

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex items-center justify-between text-xs flex-wrap gap-2" style={{ color: 'var(--text-secondary)' }}>
        <span>
          Page <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{safePage}</span> of {totalPages}
          {' · '}
          {pageAnswered} of {slice.length} answered on this page
        </span>
        <span>{questions.length} question{questions.length === 1 ? '' : 's'} total</span>
      </div>

      {slice.map((q, idx) => {
        const i = startIdx + idx;
        return (
          <div key={q.id} id={`q-${q.id}`} className="card space-y-3">
            <div className="font-medium">
              {i + 1}. {q.text} {q.required && <span className="text-[color:var(--error-text)]">*</span>}
            </div>
            {q.type === 'TEXT' && (
              <input className="input" required={q.required} value={answers[q.id]?.valueText || ''} onChange={(e) => setText(q.id, e.target.value)} />
            )}
            {q.type === 'LONG_TEXT' && (
              <textarea className="input" rows={4} required={q.required} value={answers[q.id]?.valueText || ''} onChange={(e) => setText(q.id, e.target.value)} />
            )}
            {(q.type === 'RADIO' || q.type === 'MCQ_SINGLE') && (
              <div className="space-y-1">
                {(q.options || []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <input type="radio" name={q.id}
                           checked={answers[q.id]?.valueOptions?.[0] === opt}
                           onChange={() => setSingle(q.id, opt)} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {(q.type === 'CHECKBOX' || q.type === 'MCQ_MULTI') && (
              <div className="space-y-1">
                {(q.options || []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <input type="checkbox"
                           checked={answers[q.id]?.valueOptions?.includes(opt) || false}
                           onChange={() => toggleMulti(q.id, opt)} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.allowText && q.type !== 'TEXT' && q.type !== 'LONG_TEXT' && (
              <div className="pt-2">
                <label htmlFor={`comment-${q.id}`} className="label">
                  {(q.textLabel && q.textLabel.trim()) || 'Additional comment'}{' '}
                  {q.textRequired
                    ? <span className="text-[color:var(--error-text)]">*</span>
                    : <span style={{ color: 'var(--text-muted)' }}>(optional)</span>}
                </label>
                <input
                  id={`comment-${q.id}`}
                  className="input"
                  placeholder="Tell us more…"
                  value={answers[q.id]?.valueText || ''}
                  onChange={(e) => setComment(q.id, e.target.value)}
                />
              </div>
            )}
          </div>
        );
      })}

      {err && <div className="form-error" role="alert">{err}</div>}

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={goPrev}
          disabled={safePage <= 1 || busy}
        >
          ← Previous
        </button>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {safePage} / {totalPages}
        </span>
        {isLastPage ? (
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit responses'}
          </button>
        ) : (
          <button type="button" className="btn" onClick={goNext} disabled={busy}>
            Next →
          </button>
        )}
      </div>
    </form>
  );
}
