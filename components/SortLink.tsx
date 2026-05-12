import Link from 'next/link';

export type SortDir = 'asc' | 'desc';

export function buildSortHref(
  basePath: string,
  field: string,
  current: { sort?: string; dir?: SortDir },
  extra: Record<string, string | string[] | undefined> = {},
): string {
  const params = new URLSearchParams();
  Object.entries(extra).forEach(([k, v]) => {
    if (v == null) return;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else params.set(k, v as string);
  });
  const nextDir: SortDir = current.sort === field && current.dir === 'asc' ? 'desc' : 'asc';
  params.set('sort', field);
  params.set('dir', nextDir);
  return `${basePath}?${params.toString()}`;
}

export function SortLink({
  basePath, field, label, current, extra,
}: {
  basePath: string;
  field: string;
  label: string;
  current: { sort?: string; dir?: SortDir };
  extra?: Record<string, string | string[] | undefined>;
}) {
  const active = current.sort === field;
  const arrow = active ? (current.dir === 'asc' ? '▲' : '▼') : '↕';
  return (
    <Link
      href={buildSortHref(basePath, field, current, extra)}
      className="inline-flex items-center gap-1 text-current hover:opacity-80 transition-opacity"
    >
      {label}
      <span className={'text-xs ' + (active ? 'opacity-100' : 'opacity-60')}>{arrow}</span>
    </Link>
  );
}
