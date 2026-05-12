import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';

const Body = z.object({ name: z.string().min(1).max(100) });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  try {
    const item = await prisma.officeType.update({ where: { id }, data: { name: parsed.data.name.trim() } });
    return NextResponse.json(item);
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'already exists' }, { status: 409 });
    throw e;
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const count = await prisma.employee.count({ where: { officeTypeId: id } });
  if (count > 0) return NextResponse.json({ error: `cannot delete: ${count} employees attached` }, { status: 409 });
  await prisma.officeType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
