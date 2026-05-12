import { prisma } from '@/lib/db';
import { MasterListClient } from '@/components/MasterListClient';

export default async function DepartmentsPage() {
  const items = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { employees: true } } },
  });
  return <MasterListClient title="Departments" apiBase="/api/admin/departments" items={items} />;
}
