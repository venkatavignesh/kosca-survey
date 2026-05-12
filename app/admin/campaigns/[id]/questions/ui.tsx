'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Q = {
  id: string;
  text: string;
  type: 'RADIO' | 'CHECKBOX' | 'MCQ_SINGLE' | 'MCQ_MULTI' | 'TEXT' | 'LONG_TEXT';
  options: string[] | null;
  required: boolean;
};
type CQ = {
  id: string;
  questionId: string;
  order: number;
  audience: 'ALL' | 'SPECIFIC';
  groupId: string | null;
  targetEmployeeIds: string[];
};
type GroupRow = { id: string; name: string; order: number };

export function QuestionsBuilder({ campaignId, savedEmployeeIds, savedQuestions, savedGroups, questions }: {
  campaignId: string;
  savedEmployeeIds: string[];
  savedQuestions: CQ[];
  savedGroups: GroupRow[];
  questions: Q[];
}) {
  const router = useRouter();
  const [campaignQuestions, setCampaignQuestions] = useState<CQ[]>(savedQuestions);
  const [groups, setGroups] = useState<GroupRow[]>(savedGroups);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupErr, setGroupErr] = useState<string | null>(null);

  function setQuestionGroup(qid: string, groupId: string | null) {
    setCampaignQuestions((prev) => prev.map((c) => (c.questionId === qid ? { ...c, groupId } : c)));
  }

  async function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    setGroupBusy(true); setGroupErr(null);
    const res = await fetch(`/api/admin/campaigns/${campaignId}/groups`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setGroupBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setGroupErr(j.error || 'Failed'); return; }
    const g = await res.json();
    setGroups((prev) => [...prev, { id: g.id, name: g.name, order: g.order }]);
    setNewGroupName('');
  }

  async function renameGroup(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch(`/api/admin/campaigns/${campaignId}/groups/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Failed'); return; }
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name: trimmed } : g)));
  }

  async function removeGroup(id: string, name: string) {
    if (!confirm(`Delete group "${name}"? Questions in it will become Ungrouped.`)) return;
    const res = await fetch(`/api/admin/campaigns/${campaignId}/groups/${id}`, { method: 'DELETE' });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Failed'); return; }
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setCampaignQuestions((prev) => prev.map((c) => (c.groupId === id ? { ...c, groupId: null } : c)));
  }
  const [questionSearch, setQuestionSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);

  const usedQids = useMemo(() => new Set(campaignQuestions.map((c) => c.questionId)), [campaignQuestions]);

  const unselectedQuestions = useMemo(() => {
    const s = questionSearch.trim().toLowerCase();
    return questions.filter((q) => {
      if (usedQids.has(q.id)) return false;
      if (!s) return true;
      if (q.text.toLowerCase().includes(s)) return true;
      if (q.type.toLowerCase().includes(s)) return true;
      if (q.options?.some((o) => o.toLowerCase().includes(s))) return true;
      return false;
    });
  }, [questions, usedQids, questionSearch]);

  const savedState = useMemo(
    () => JSON.stringify(savedQuestions.map((q) => ({ qid: q.questionId, o: q.order, a: q.audience, g: q.groupId ?? '', t: [...q.targetEmployeeIds].sort() }))),
    [savedQuestions],
  );
  const currentState = JSON.stringify(campaignQuestions.map((q) => ({ qid: q.questionId, o: q.order, a: q.audience, g: q.groupId ?? '', t: [...q.targetEmployeeIds].sort() })));
  const dirty = currentState !== savedState;

  function addQuestion(qid: string) {
    if (campaignQuestions.find((c) => c.questionId === qid)) return;
    setCampaignQuestions((prev) => [
      ...prev,
      { id: 'tmp_' + qid, questionId: qid, order: prev.length, audience: 'ALL', groupId: null, targetEmployeeIds: [] },
    ]);
  }
  function removeQuestion(qid: string) {
    setCampaignQuestions((prev) => prev.filter((c) => c.questionId !== qid).map((c, i) => ({ ...c, order: i })));
  }
  function moveQuestion(qid: string, dir: -1 | 1) {
    setCampaignQuestions((prev) => {
      const idx = prev.findIndex((c) => c.questionId === qid);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy.map((c, i) => ({ ...c, order: i }));
    });
  }

  // Auto-save on change
  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return; }
    if (!dirty) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/campaigns/${campaignId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeIds: savedEmployeeIds,
            questions: campaignQuestions.map((cq) => ({
              questionId: cq.questionId,
              order: cq.order,
              audience: cq.audience,
              groupId: cq.groupId ?? null,
              employeeIds: cq.audience === 'SPECIFIC' ? cq.targetEmployeeIds : [],
            })),
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setErr(j.error || 'Auto-save failed');
          setSaveStatus('error');
          return;
        }
        setErr(null);
        setSaveStatus('saved');
        router.refresh();
      } catch {
        setSaveStatus('error');
      }
    }, 700);
    return () => clearTimeout(t);
  }, [campaignQuestions, dirty, campaignId, savedEmployeeIds, router]);

  return (
    <div className="space-y-4">
    <div className="card space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Groups <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(internal — never shown to survey takers)</span></h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Group questions that share a positivity pattern (1st option = most positive). Used by the report to combine answers.
          </p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <input
          className="input max-w-xs"
          placeholder="New group name (e.g. Leadership)"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }}
          aria-label="New group name"
        />
        <button type="button" className="btn !py-1.5 text-xs" disabled={groupBusy || !newGroupName.trim()} onClick={addGroup}>Add group</button>
      </div>
      {groupErr && <div className="form-error">{groupErr}</div>}
      {groups.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {groups.map((g) => {
            const count = campaignQuestions.filter((c) => c.groupId === g.id).length;
            return (
              <li key={g.id} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border" style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}>
                <span className="font-semibold">{g.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>· {count}</span>
                <button type="button" className="hover:underline" style={{ color: 'var(--text-muted)' }} onClick={() => {
                  const name = prompt('Rename group', g.name);
                  if (name) renameGroup(g.id, name);
                }} aria-label={`Rename ${g.name}`}>edit</button>
                <button type="button" className="hover:underline" style={{ color: 'var(--error-text)' }} onClick={() => removeGroup(g.id, g.name)} aria-label={`Delete ${g.name}`}>×</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Selected ({campaignQuestions.length})
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'error' && <span style={{ color: 'var(--error-text)' }}>Auto-save failed</span>}
          </span>
        </div>

        {campaignQuestions.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            No questions added yet. Pick from the bank on the right.
          </p>
        ) : (
          <ol className="space-y-2">
            {campaignQuestions.map((cq, idx) => {
              const q = questions.find((x) => x.id === cq.questionId);
              if (!q) return null;
              return (
                <li key={cq.questionId} className="border border-[var(--border-primary)] rounded-lg p-3 space-y-2 bg-[var(--surface-primary)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm">
                        <span className="font-semibold mr-1">{idx + 1}.</span>
                        {q.text}
                        {q.required && <span className="ml-1 text-[color:var(--error-text)]">*</span>}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {q.type}{q.options ? ` · ${q.options.join(' / ')}` : ''}
                      </div>
                      {groups.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <label className="text-xs" style={{ color: 'var(--text-muted)' }} htmlFor={`grp-${cq.questionId}`}>Group</label>
                          <select
                            id={`grp-${cq.questionId}`}
                            className="input !py-1 !text-xs max-w-[200px]"
                            value={cq.groupId ?? ''}
                            onChange={(e) => setQuestionGroup(cq.questionId, e.target.value || null)}
                          >
                            <option value="">— Ungrouped —</option>
                            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => moveQuestion(cq.questionId, -1)} disabled={idx === 0} aria-label="Move up">↑</button>
                      <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => moveQuestion(cq.questionId, 1)} disabled={idx === campaignQuestions.length - 1} aria-label="Move down">↓</button>
                      <button className="btn-danger !py-1 !px-2 text-xs" onClick={() => removeQuestion(cq.questionId)} aria-label="Remove">Remove</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {err && <div className="form-error">{err}</div>}
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Question bank</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{unselectedQuestions.length} available</span>
        </div>

        <input
          className="input"
          placeholder="Search question text, type, or option…"
          value={questionSearch}
          onChange={(e) => setQuestionSearch(e.target.value)}
          aria-label="Search question bank"
        />

        {unselectedQuestions.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
            {questionSearch ? 'No questions match.' : 'All questions added (or none in the bank).'}
          </p>
        ) : (
          <ul className="border border-[var(--border-primary)] rounded-lg divide-y divide-[var(--border-subtle)] overflow-hidden max-h-[600px] overflow-y-auto">
            {unselectedQuestions.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => addQuestion(q.id)}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--dropdown-hover)] text-sm flex items-start gap-2"
                >
                  <span className="badge mt-0.5">{q.type}</span>
                  <span className="flex-1">{q.text} {q.required && <span className="text-[color:var(--error-text)]" title="Required">*</span>}</span>
                  <span className="text-xs shrink-0" style={{ color: 'var(--accent-primary)' }}>+ Add</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    </div>
  );
}
