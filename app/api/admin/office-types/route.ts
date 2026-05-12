import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api';
import { listMaster, createMaster } from '@/lib/services/masters';
import { ApiError } from '@/lib/errors';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  return NextResponse.json(await listMaster('officeType'));
}

const Body = z.object({ name: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  try {
    const item = await createMaster('officeType', parsed.data.name, auth.session.user.id, auth.session.user.email);
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
