import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { parsePage, pagedResult, LEGACY_LIST_CAP } from '@/lib/pagination';
import { createEmployee } from '@/lib/services/employees';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const sp = req.nextUrl.searchParams;
  const locationIds = sp.getAll('locationId');
  const officeTypeIds = sp.getAll('officeTypeId');
  const departmentIds = sp.getAll('departmentId');
  const q = sp.get('q')?.trim();

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

  const findArgs = {
    where,
    orderBy: { empCode: 'asc' as const },
    include: { location: true, officeType: true, department: true },
  };
  const paged = sp.has('page') || sp.has('limit');
  if (!paged) {
    // Legacy unpaginated mode, capped server-side so it's not a DoS vector.
    const employees = await prisma.employee.findMany({ ...findArgs, take: LEGACY_LIST_CAP });
    return NextResponse.json(employees);
  }
  const p = parsePage(sp);
  const [items, total] = await Promise.all([
    prisma.employee.findMany({ ...findArgs, skip: p.skip, take: p.limit }),
    prisma.employee.count({ where }),
  ]);
  return NextResponse.json(pagedResult(items, total, p));
}

const Body = z.object({
  empCode: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  designation: z.string().min(1),
  locationId: z.string().min(1),
  officeTypeId: z.string().min(1),
  departmentId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  try {
    const e = await createEmployee({
      ...parsed.data,
      actorId: auth.session.user.id,
      actorEmail: auth.session.user.email,
    });
    return NextResponse.json(e, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
