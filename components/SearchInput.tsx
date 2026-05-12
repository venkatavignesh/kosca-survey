'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const DEBOUNCE_MS = 300;

/**
 * Reactive search input. Updates the URL's `?q=…` (and resets `?page=1`) as
 * the user types, debounced. Designed for server-rendered list pages: the
 * page reads `q` from `searchParams` and re-renders the filtered slice.
 *
 * Pure URL-driven so no shared client state is needed; sort filters,
 * group-pill filters, and pagination keep working unchanged.
 */
export function SearchInput({
  paramName = 'q',
  label = 'Search',
  placeholder = 'name / code / email…',
  id = 'search-input',
}: {
  paramName?: string;
  label?: string;
  placeholder?: string;
  id?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get(paramName) || '';
  const [value, setValue] = useState(initial);
  const initialMount = useRef(true);

  // Re-sync from URL when nav happens externally (e.g. Clear-all link).
  useEffect(() => { setValue(initial); }, [initial]);

  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return; }
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      const trimmed = value.trim();
      if (trimmed) sp.set(paramName, trimmed);
      else sp.delete(paramName);
      sp.delete('page'); // any new query resets to page 1
      const next = sp.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="search"
          className="input pr-9"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setValue('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--accent-hover)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
