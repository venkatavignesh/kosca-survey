import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';

const PatchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  order: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; groupId: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id, groupId } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const data: any = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.order !== undefined) data.order = parsed.data.order;

  try {
    const group = await prisma.campaignQuestionGroup.update({
      where: { id: groupId, campaignId: id },
      data,
    });
    return NextResponse.json(group);
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'Group name already exists' }, { status: 409 });
    if (e?.code === 'P2025') return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    throw e;
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; groupId: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id, groupId } = await ctx.params;
  try {
    await prisma.campaignQuestionGroup.delete({ where: { id: groupId, campaignId: id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    throw e;
  }
}
