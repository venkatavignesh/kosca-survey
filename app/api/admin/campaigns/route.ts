import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { audit, AUDIT_ACTIONS } from '@/lib/audit';
import { parsePage, pagedResult } from '@/lib/pagination';

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
    // Legacy clients get the full unpaginated list (current admin UI).
    const items = await prisma.campaign.findMany(findArgs);
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
  const c = await prisma.campaign.create({
    data: {
      ...parsed.data,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      createdById: auth.session.user.id,
    },
  });
  await audit({
    action: AUDIT_ACTIONS.CAMPAIGN_CREATE,
    userId: auth.session.user.id,
    actorEmail: auth.session.user.email,
    entityType: 'Campaign',
    entityId: c.id,
    metadata: { title: c.title },
  });
  return NextResponse.json(c, { status: 201 });
}
