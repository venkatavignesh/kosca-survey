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
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());

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
    setMissingIds(new Set());
  }, [safePage]);

  function clearMissing(qid: string) {
    setMissingIds((s) => {
      if (!s.has(qid)) return s;
      const next = new Set(s);
      next.delete(qid);
      return next;
    });
  }
  function setText(qid: string, v: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], valueText: v } }));
    setErr(null);
    clearMissing(qid);
  }
  function setComment(qid: string, v: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], valueText: v } }));
    setErr(null);
    clearMissing(qid);
  }
  function setSingle(qid: string, opt: string) {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], valueOptions: [opt] } }));
    setErr(null);
    clearMissing(qid);
  }
  function toggleMulti(qid: string, opt: string) {
    setAnswers((a) => {
      const cur = a[qid]?.valueOptions || [];
      const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
      return { ...a, [qid]: { ...a[qid], valueOptions: next } };
    });
    setErr(null);
    clearMissing(qid);
  }

  // Returns the IDs of unanswered required questions in the given scope.
  // textRequired (comment) is enforced independently of the primary required flag.
  function allMissingRequired(scope: Q[]): string[] {
    const out: string[] = [];
    for (const q of scope) {
      const a = answers[q.id];
      const isText = q.type === 'TEXT' || q.type === 'LONG_TEXT';
      let missing = false;
      if (q.required) {
        if (isText) {
          if (!a?.valueText || !a.valueText.trim()) missing = true;
        } else if (!a?.valueOptions || a.valueOptions.length === 0) {
          missing = true;
        }
      }
      if (!missing && q.allowText && q.textRequired) {
        if (!a?.valueText || !a.valueText.trim()) missing = true;
      }
      if (missing) out.push(q.id);
    }
    return out;
  }

  function scrollToQuestion(qid: string) {
    if (typeof window === 'undefined') return;
    // Two RAFs: first lets React commit the state (card-missing class added),
    // second runs after the browser has laid out the new styles so the element's
    // position is final before we scroll.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`q-${qid}`);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const y = window.scrollY + rect.top - 100;
        window.scrollTo({ top: y, left: 0, behavior: 'smooth' });
      });
    });
  }

  function goNext() {
    setErr(null);
    // Validate ONLY the current page — never peek at the next page's questions.
    const missingList = allMissingRequired(slice);
    if (missingList.length > 0) {
      setMissingIds(new Set(missingList));
      const firstIdx = slice.findIndex((q) => q.id === missingList[0]);
      setErr(`Please answer question ${startIdx + firstIdx + 1} before continuing.`);
      scrollToQuestion(missingList[0]);
      return;
    }
    setMissingIds(new Set());
    // Defer the page advance to the next tick so the browser fully completes
    // the in-flight click event (incl. its default action) before React swaps
    // this Next button for the Submit button. Without this, React's
    // synchronous commit inside the click handler can change the live
    // button's type to "submit" mid-event, causing the browser to auto-fire
    // a form submission on the freshly-rendered submit button — which would
    // then trigger our validation and flash a stale "answer question 11"
    // error on page 2 the moment it loads.
    setTimeout(() => {
      setPage(safePage + 1);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    }, 0);
  }

  function goPrev() {
    setErr(null);
    setPage(safePage - 1);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    // Validate ONLY the current (last) page on submit. Earlier pages were
    // already gated by goNext, so by construction they're complete.
    const missingList = allMissingRequired(slice);
    if (missingList.length > 0) {
      setMissingIds(new Set(missingList));
      const firstIdx = slice.findIndex((q) => q.id === missingList[0]);
      setErr(`Please answer question ${startIdx + firstIdx + 1} before submitting.`);
      scrollToQuestion(missingList[0]);
      return;
    }
    setMissingIds(new Set());
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
          <div key={q.id} id={`q-${q.id}`} className={`card space-y-3${missingIds.has(q.id) ? ' card-missing' : ''}`}>
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
          <button key="submit-btn" type="submit" className="btn" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit responses'}
          </button>
        ) : (
          <button key="next-btn" type="button" className="btn" onClick={goNext} disabled={busy}>
            Next →
          </button>
        )}
      </div>
    </form>
  );
}
