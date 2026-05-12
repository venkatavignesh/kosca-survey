import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { updateMaster, deleteMaster } from '@/lib/services/masters';
import { ApiError } from '@/lib/errors';

const Body = z.object({ name: z.string().min(1).max(100) });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  try {
    return NextResponse.json(await updateMaster('officeType', id, parsed.data.name, auth.session.user.id, auth.session.user.email));
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const count = await prisma.employee.count({ where: { officeTypeId: id } });
  if (count > 0) return NextResponse.json({ error: `cannot delete: ${count} employees attached` }, { status: 409 });
  try {
    await deleteMaster('officeType', id, auth.session.user.id, auth.session.user.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
