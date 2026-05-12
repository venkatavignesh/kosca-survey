// Pure helpers, safe to import from server components.

export const PER_PAGE_OPTIONS = [10, 25, 50] as const;
export type PerPage = typeof PER_PAGE_OPTIONS[number];

export function clampPerPage(v: unknown, fallback: PerPage = 10): PerPage {
  const n = Number(v);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(n) ? (n as PerPage) : fallback;
}

export function clampPage(v: unknown, totalPages: number): number {
  const n = Math.max(1, Math.floor(Number(v) || 1));
  return Math.min(n, Math.max(1, totalPages));
}
