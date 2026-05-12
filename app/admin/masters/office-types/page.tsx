import { prisma } from '@/lib/db';
import { MasterListClient } from '@/components/MasterListClient';

export default async function OfficeTypesPage() {
  const items = await prisma.officeType.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { employees: true } } },
  });
  return <MasterListClient title="Office types" apiBase="/api/admin/office-types" items={items} />;
}
