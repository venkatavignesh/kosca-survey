import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api';
import { sendCampaign } from '@/lib/services/send';
import { ApiError } from '@/lib/errors';

const Body = z.object({
  assignmentIds: z.array(z.string()).optional(),
  resend: z.boolean().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id: campaignId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  try {
    const result = await sendCampaign({
      campaignId,
      assignmentIds: parsed.data.assignmentIds,
      resend: parsed.data.resend,
      actorId: auth.session.user.id,
      actorEmail: auth.session.user.email,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
