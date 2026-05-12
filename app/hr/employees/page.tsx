import { prisma } from '@/lib/db';
import { EmployeesClient } from '@/app/admin/employees/ui';

export default async function HrEmployeesPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const arr = (k: string): string[] => Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : [];
  const locationIds = arr('locationId');
  const officeTypeIds = arr('officeTypeId');
  const departmentIds = arr('departmentId');
  const q = (sp.q as string | undefined)?.trim();

  const where: any = {};
  if (locationIds.length) where.locationId = { in: locationIds };
  if (officeTypeIds.length) where.officeTypeId = { in: officeTypeIds };
  if (departmentIds.length) where.departmentId = { in: departmentIds };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { empCode: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { designation: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [employees, locations, officeTypes, departments] = await Promise.all([
    prisma.employee.findMany({ where, orderBy: { empCode: 'asc' }, include: { location: true, officeType: true, department: true } }),
    prisma.location.findMany({ orderBy: { name: 'asc' } }),
    prisma.officeType.findMany({ orderBy: { name: 'asc' } }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <EmployeesClient
      readOnly={true}
      employees={employees}
      locations={locations}
      officeTypes={officeTypes}
      departments={departments}
      filters={{ locationIds, officeTypeIds, departmentIds, q: q || '' }}
    />
  );
}
