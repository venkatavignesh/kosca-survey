import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const items = await prisma.location.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { employees: true } } },
  });
  return NextResponse.json(items);
}

const Body = z.object({ name: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  try {
    const item = await prisma.location.create({ data: { name: parsed.data.name.trim() } });
    return NextResponse.json(item, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'already exists' }, { status: 409 });
    throw e;
  }
}
