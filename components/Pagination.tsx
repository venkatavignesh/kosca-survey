'use client';
import { useMemo } from 'react';
import { PER_PAGE_OPTIONS, type PerPage, clampPerPage } from './pagination-utils';

export { PER_PAGE_OPTIONS, type PerPage, clampPerPage };

export function usePaginated<T>(items: T[], page: number, perPage: number) {
  return useMemo(() => {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * perPage;
    const slice = items.slice(start, start + perPage);
    return { slice, total, totalPages, safePage };
  }, [items, page, perPage]);
}

function deriveRange(page: number, perPage: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);
  return { totalPages, safePage, from, to };
}

export function PaginationStats({
  page, perPage, total, onPerPageChange,
}: {
  page: number;
  perPage: number;
  total: number;
  onPerPageChange: (p: PerPage) => void;
}) {
  const { from, to } = deriveRange(page, perPage, total);
  return (
    <div className="flex items-center justify-end gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
      <span>Rows per page</span>
      <select
        className="input !py-0.5 !px-2 !text-xs w-auto"
        value={perPage}
        onChange={(e) => onPerPageChange(clampPerPage(e.target.value))}
        aria-label="Rows per page"
      >
        {PER_PAGE_OPTIONS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <span>{from}–{to} of {total}</span>
    </div>
  );
}

export function PaginationNav({
  page, perPage, total, onPageChange,
}: {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const { totalPages, safePage } = deriveRange(page, perPage, total);
  return (
    <div className="flex items-center justify-center gap-1 text-xs">
      <PgButton disabled={safePage <= 1} onClick={() => onPageChange(1)} aria-label="First page">«</PgButton>
      <PgButton disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} aria-label="Previous page">‹</PgButton>
      <span className="px-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
        {safePage} / {totalPages}
      </span>
      <PgButton disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} aria-label="Next page">›</PgButton>
      <PgButton disabled={safePage >= totalPages} onClick={() => onPageChange(totalPages)} aria-label="Last page">»</PgButton>
    </div>
  );
}

function PgButton({
  children, disabled, onClick, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="px-2 py-1 rounded-md text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-primary)' }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)'; }}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
      {...rest}
    >
      {children}
    </button>
  );
}
