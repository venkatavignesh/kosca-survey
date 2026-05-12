import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';

const CreateBody = z.object({
  name: z.string().min(1).max(80),
  order: z.number().int().optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const groups = await prisma.campaignQuestionGroup.findMany({
    where: { campaignId: id },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const order =
    parsed.data.order ??
    ((await prisma.campaignQuestionGroup.count({ where: { campaignId: id } })) as number);

  try {
    const group = await prisma.campaignQuestionGroup.create({
      data: { campaignId: id, name: parsed.data.name.trim(), order },
    });
    return NextResponse.json(group);
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'Group name already exists' }, { status: 409 });
    throw e;
  }
}
