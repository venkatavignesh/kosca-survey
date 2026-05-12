'use client';
import { useState } from 'react';
import { PaginationStats, PaginationNav, usePaginated, type PerPage } from './Pagination';

export type AnswerCard = {
  id: string;
  questionText: string;
  type: 'RADIO' | 'CHECKBOX' | 'MCQ_SINGLE' | 'MCQ_MULTI' | 'TEXT' | 'LONG_TEXT';
  required: boolean;
  allowText: boolean; // when true on a choice question, valueText holds the user's comment
  valueText: string | null;
  valueOptions: string[] | null;
  hasAnswer: boolean;
};

export function AnswersList({ cards }: { cards: AnswerCard[] }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(10);
  const { slice, total } = usePaginated(cards, page, perPage);
  const startIdx = (page - 1) * perPage;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <PaginationStats
          total={total}
          page={page}
          perPage={perPage}
          onPerPageChange={(p) => { setPerPage(p); setPage(1); }}
        />
      </div>

      {slice.map((card, idx) => {
        const i = startIdx + idx;
        const isText = card.type === 'TEXT' || card.type === 'LONG_TEXT';
        const isMulti = card.type === 'CHECKBOX' || card.type === 'MCQ_MULTI';
        const opts = card.valueOptions || [];

        return (
          <div key={card.id} className="card space-y-2">
            <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Question {i + 1} · {card.type}
              {card.required && <span className="ml-1" style={{ color: 'var(--error-text)' }}>*</span>}
            </p>
            <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{card.questionText}</div>

            <div className="text-sm pt-1">
              {!card.hasAnswer ? (
                <span style={{ color: 'var(--text-muted)' }}>No answer</span>
              ) : isText ? (
                card.valueText
                  ? <p className="whitespace-pre-wrap">{card.valueText}</p>
                  : <span style={{ color: 'var(--text-muted)' }}>empty</span>
              ) : isMulti ? (
                opts.length === 0
                  ? <span style={{ color: 'var(--text-muted)' }}>No selection</span>
                  : (
                      <ul className="list-disc pl-5 space-y-1">
                        {opts.map((o, j) => <li key={j}>{o}</li>)}
                      </ul>
                    )
              ) : (
                opts.length === 0
                  ? <span style={{ color: 'var(--text-muted)' }}>No selection</span>
                  : <p>{opts[0]}</p>
              )}
            </div>

            {card.allowText && !isText && (
              <div className="pt-2 mt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-[10px] uppercase font-semibold tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Comment</p>
                {card.valueText && card.valueText.trim()
                  ? <p className="text-sm whitespace-pre-wrap">{card.valueText}</p>
                  : <span className="text-sm" style={{ color: 'var(--text-muted)' }}>(none)</span>}
              </div>
            )}
          </div>
        );
      })}

      {cards.length === 0 && (
        <div className="card">
          <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
            No questions in this response.
          </p>
        </div>
      )}

      <PaginationNav total={total} page={page} perPage={perPage} onPageChange={setPage} />
    </div>
  );
}
