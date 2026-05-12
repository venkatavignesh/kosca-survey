'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  // Question ids currently flagged as "required and empty" — populated by
  // validation, drained as the user fills them in. Drives the red glow.
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
  // The page number missingIds belongs to. When the user navigates to a
  // different page, the highlights from a prior validation are stale and get
  // dropped automatically.
  const missingIdsPage = useRef<number | null>(null);

  function clearMissing(qid: string) {
    setMissingIds((prev) => {
      if (!prev.has(qid)) return prev;
      const next = new Set(prev);
      next.delete(qid);
      return next;
    });
  }

  const totalPages = Math.max(1, Math.ceil(questions.length / PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * PER_PAGE;
  const slice = questions.slice(startIdx, startIdx + PER_PAGE);
  const isLastPage = safePage >= totalPages;

  // Drop stale highlights whenever the user is on a different page than the
  // one they were last flagged against (e.g. after a successful Next, or
  // jumping back via Prev).
  useEffect(() => {
    if (missingIdsPage.current !== null && missingIdsPage.current !== safePage) {
      setMissingIds(new Set());
      missingIdsPage.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  function setText(qid: string, v: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], valueText: v } }));
    if (v.trim()) clearMissing(qid);
  }
  function setComment(qid: string, v: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], valueText: v } }));
    if (v.trim()) clearMissing(qid);
  }
  function setSingle(qid: string, opt: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], valueOptions: [opt] } }));
    clearMissing(qid);
  }
  function toggleMulti(qid: string, opt: string) {
    setAnswers((a) => {
      const cur = a[qid]?.valueOptions || [];
      const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
      if (next.length > 0) clearMissing(qid);
      return { ...a, [qid]: { ...a[qid], valueOptions: next } };
    });
  }

  // Walks the given scope and returns *every* required question that hasn't
  // been answered, plus the 1-based index of the first one (for the error
  // message). textRequired (comment) is enforced independently of the primary
  // required flag.
  function collectMissingRequired(scope: Q[]): { ids: string[]; firstIndex: number } {
    const ids: string[] = [];
    let firstIndex = 0;
    scope.forEach((q, i) => {
      const a = answers[q.id];
      const isText = q.type === 'TEXT' || q.type === 'LONG_TEXT';
      let missing = false;
      if (q.required) {
        if (isText) missing = !a?.valueText || !a.valueText.trim();
        else missing = !a?.valueOptions || a.valueOptions.length === 0;
      }
      if (!missing && q.allowText && q.textRequired) {
        missing = !a?.valueText || !a.valueText.trim();
      }
      if (missing) {
        ids.push(q.id);
        if (!firstIndex) firstIndex = i + 1;
      }
    });
    return { ids, firstIndex };
  }

  function scrollToQuestion(qid: string) {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      document.getElementById(`q-${qid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function goNext() {
    setErr(null);
    const { ids, firstIndex } = collectMissingRequired(slice);
    if (firstIndex) {
      setMissingIds(new Set(ids));
      missingIdsPage.current = safePage;
      setErr(`Please answer required question ${startIdx + firstIndex} before continuing.`);
      scrollToQuestion(slice[firstIndex - 1].id);
      return;
    }
    setMissingIds(new Set());
    missingIdsPage.current = null;
    setPage(safePage + 1);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goPrev() {
    setErr(null);
    setMissingIds(new Set());
    missingIdsPage.current = null;
    setPage(safePage - 1);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    // Validate the entire form (across pages) on submit.
    const { ids, firstIndex } = collectMissingRequired(questions);
    if (firstIndex) {
      const targetPage = Math.ceil(firstIndex / PER_PAGE);
      const targetStart = (targetPage - 1) * PER_PAGE;
      const targetIds = new Set(
        questions.slice(targetStart, targetStart + PER_PAGE)
          .filter((q) => ids.includes(q.id))
          .map((q) => q.id),
      );
      // Only glow missing questions on the page the user is being jumped to.
      // Validating elsewhere happens again when they navigate / re-submit.
      setMissingIds(targetIds);
      missingIdsPage.current = targetPage;
      setPage(targetPage);
      setErr(`Please answer required question ${firstIndex} before submitting.`);
      scrollToQuestion(questions[firstIndex - 1].id);
      return;
    }
    setMissingIds(new Set());
    missingIdsPage.current = null;
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

  // Per-page progress (count of answered, of all on this page)
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
        const flagged = missingIds.has(q.id);
        return (
          <div
            key={q.id}
            id={`q-${q.id}`}
            className={`card space-y-3 transition-shadow${flagged ? ' missing-required' : ''}`}
            style={flagged
              ? {
                  borderColor: 'var(--error-text)',
                  boxShadow: '0 0 0 2px rgba(220, 38, 38, 0.35), 0 0 18px 2px rgba(220, 38, 38, 0.45)',
                }
              : undefined}
            aria-invalid={flagged || undefined}
          >
            <div className="font-medium">
              {i + 1}. {q.text} {q.required && <span className="text-[color:var(--error-text)]">*</span>}
              {flagged && (
                <span
                  className="ml-2 text-[11px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 align-middle"
                  style={{ background: 'var(--error-text)', color: '#fff' }}
                >
                  required
                </span>
              )}
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
          <button className="btn" disabled={busy}>
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
