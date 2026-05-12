import { prisma } from '@/lib/db';
import { MasterListClient } from '@/components/MasterListClient';

export default async function LocationsPage() {
  const items = await prisma.location.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { employees: true } } },
  });
  return <MasterListClient title="Locations" apiBase="/api/admin/locations" items={items} />;
}
