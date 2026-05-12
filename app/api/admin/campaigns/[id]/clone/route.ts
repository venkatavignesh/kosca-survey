import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api';
import { cloneCampaign } from '@/lib/services/campaigns';
import { ApiError } from '@/lib/errors';

const Body = z.object({
  title: z.string().min(1).max(200).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id: sourceId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  try {
    const clone = await cloneCampaign({
      sourceId,
      newTitle: parsed.data.title,
      actorId: auth.session.user.id,
      actorEmail: auth.session.user.email,
    });
    return NextResponse.json(clone, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
