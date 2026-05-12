import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { parsePage, pagedResult, LEGACY_LIST_CAP } from '@/lib/pagination';
import { createCampaign } from '@/lib/services/campaigns';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const sp = req.nextUrl.searchParams;
  const paged = sp.has('page') || sp.has('limit');
  const p = parsePage(sp);
  const findArgs = {
    orderBy: { createdAt: 'desc' as const },
    include: { _count: { select: { assignments: true, questions: true } } },
  };
  if (!paged) {
    // Legacy unpaginated mode is bounded by LEGACY_LIST_CAP so a runaway
    // client can never sweep the whole table.
    const items = await prisma.campaign.findMany({ ...findArgs, take: LEGACY_LIST_CAP });
    return NextResponse.json(items);
  }
  const [items, total] = await Promise.all([
    prisma.campaign.findMany({ ...findArgs, skip: p.skip, take: p.limit }),
    prisma.campaign.count(),
  ]);
  return NextResponse.json(pagedResult(items, total, p));
}

const Body = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  emailSubjectTemplate: z.string().min(1),
  emailBodyTemplate: z.string().min(1),
  deadline: z.string().datetime().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const c = await createCampaign({
    ...parsed.data,
    createdById: auth.session.user.id,
    actorEmail: auth.session.user.email,
  });
  return NextResponse.json(c, { status: 201 });
}
