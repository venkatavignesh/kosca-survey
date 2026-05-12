import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { QuestionType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';

const Body = z.object({
  text: z.string().min(1).max(2000).optional(),
  type: z.nativeEnum(QuestionType).optional(),
  options: z.array(z.string().min(1)).optional(),
  required: z.boolean().optional(),
  allowText: z.boolean().optional(),
  textRequired: z.boolean().optional(),
});

function needsOptions(t: QuestionType) {
  return t === 'RADIO' || t === 'CHECKBOX' || t === 'MCQ_SINGLE' || t === 'MCQ_MULTI';
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const data: any = { ...parsed.data };
  if (parsed.data.type) {
    if (needsOptions(parsed.data.type)) {
      if (!parsed.data.options || parsed.data.options.length < 2) {
        return NextResponse.json({ error: 'choice questions need at least 2 options' }, { status: 400 });
      }
    } else {
      // Switching to a plain-text type: clear choice-only fields.
      data.options = null;
      data.allowText = false;
      data.textRequired = false;
    }
  }
  // Keep dependent flag consistent.
  if (data.allowText === false) data.textRequired = false;
  const q = await prisma.question.update({ where: { id }, data });
  return NextResponse.json(q);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const usedCount = await prisma.campaignQuestion.count({ where: { questionId: id } });
  if (usedCount > 0) return NextResponse.json({ error: `used in ${usedCount} campaign(s)` }, { status: 409 });
  await prisma.question.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
