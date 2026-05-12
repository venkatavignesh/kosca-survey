// Single source of truth for cursor/offset pagination on API list endpoints.
// All admin GET routes should funnel through `parsePage` so the limits
// (max=200, default=50) cannot be bypassed by a malicious client.

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export type PagedQuery = {
  page: number;       // 1-based
  limit: number;
  skip: number;
};

export function parsePage(searchParams: URLSearchParams): PagedQuery {
  const rawPage = Number(searchParams.get('page') ?? 1);
  const rawLimit = Number(searchParams.get('limit') ?? DEFAULT_LIMIT);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.floor(rawLimit)), MAX_LIMIT)
    : DEFAULT_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

export type PagedResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function pagedResult<T>(items: T[], total: number, p: PagedQuery): PagedResult<T> {
  return {
    items,
    page: p.page,
    limit: p.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / p.limit)),
  };
}
