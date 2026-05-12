import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';

const Body = z.object({
  empCode: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  designation: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  officeTypeId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const data: any = { ...parsed.data };
  if (data.email) data.email = data.email.toLowerCase().trim();
  if (data.empCode) data.empCode = data.empCode.trim();
  try {
    const e = await prisma.employee.update({ where: { id }, data });
    return NextResponse.json(e);
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'empCode already exists' }, { status: 409 });
    throw e;
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const assignmentCount = await prisma.campaignAssignment.count({ where: { employeeId: id } });
  if (assignmentCount > 0) {
    return NextResponse.json({ error: `cannot delete: employee has ${assignmentCount} campaign assignment(s)` }, { status: 409 });
  }
  await prisma.employee.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
