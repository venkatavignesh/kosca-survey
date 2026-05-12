'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function QuestionPicker({
  questions,
  current,
}: {
  questions: { id: string; text: string }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sp = new URLSearchParams(params.toString());
    const v = e.target.value;
    if (v) sp.set('questionId', v);
    else sp.delete('questionId');
    // Switching question invalidates option selections, text search, and page.
    sp.delete('option');
    sp.delete('text');
    sp.delete('page');
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  return (
    <select
      id="report-question"
      className="input"
      value={current}
      onChange={onChange}
    >
      <option value="">— Pick a question —</option>
      {questions.map((q, i) => (
        <option key={q.id} value={q.id}>
          Q{i + 1}. {q.text.length > 90 ? q.text.slice(0, 90) + '…' : q.text}
        </option>
      ))}
    </select>
  );
}
