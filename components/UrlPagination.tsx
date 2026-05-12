'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { PaginationStats, PaginationNav, PerPage } from './Pagination';

function useUrlState() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const perPage = Number(params.get('perPage')) || 10;
  const page = Number(params.get('page')) || 1;
  const update = (next: { page?: number; perPage?: number }) => {
    const sp = new URLSearchParams(params.toString());
    if (next.page !== undefined) sp.set('page', String(next.page));
    if (next.perPage !== undefined) {
      sp.set('perPage', String(next.perPage));
      sp.set('page', '1');
    }
    router.push(`${pathname}?${sp.toString()}`);
  };
  return { page, perPage, update };
}

export function UrlPaginationStats({ total }: { total: number }) {
  const { page, perPage, update } = useUrlState();
  return (
    <PaginationStats
      total={total}
      page={page}
      perPage={perPage}
      onPerPageChange={(p: PerPage) => update({ perPage: p })}
    />
  );
}

export function UrlPaginationNav({ total }: { total: number }) {
  const { page, perPage, update } = useUrlState();
  return (
    <PaginationNav
      total={total}
      page={page}
      perPage={perPage}
      onPageChange={(p) => update({ page: p })}
    />
  );
}
