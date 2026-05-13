import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Audience } from '@prisma/client';
import { requireAdmin } from '@/lib/api';
import { syncCampaignAssignments } from '@/lib/services/assignments';

const Body = z.object({
  employeeIds: z.array(z.string()).min(0),
  // Omit `questions` from the body to leave the campaign's question set
  // untouched (recipients page does this). Pass an array to replace it
  // (questions page does this).
  questions: z
    .array(
      z.object({
        questionId: z.string(),
        order: z.number().int(),
        audience: z.nativeEnum(Audience),
        groupId: z.string().nullable().optional(),
        employeeIds: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id: campaignId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const stats = await syncCampaignAssignments({
    campaignId,
    employeeIds: parsed.data.employeeIds,
    questions: parsed.data.questions,
    actorId: auth.session.user.id,
    actorEmail: auth.session.user.email,
  });

  return NextResponse.json({ ok: true, ...stats });
}
