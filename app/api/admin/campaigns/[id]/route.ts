import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CampaignStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';

const Body = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  emailSubjectTemplate: z.string().min(1).optional(),
  emailBodyTemplate: z.string().min(1).optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
  deadline: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const data: any = { ...parsed.data };
  if ('deadline' in parsed.data) data.deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;
  const c = await prisma.campaign.update({ where: { id }, data });
  return NextResponse.json(c);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
