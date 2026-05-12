import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { QuestionType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const items = await prisma.question.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(items);
}

const Body = z.object({
  text: z.string().min(1).max(2000),
  type: z.nativeEnum(QuestionType),
  options: z.array(z.string().min(1)).optional(),
  required: z.boolean().optional(),
  allowText: z.boolean().optional(),
  textRequired: z.boolean().optional(),
});

function needsOptions(t: QuestionType) {
  return t === 'RADIO' || t === 'CHECKBOX' || t === 'MCQ_SINGLE' || t === 'MCQ_MULTI';
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const { text, type, options, required, allowText, textRequired } = parsed.data;
  if (needsOptions(type)) {
    if (!options || options.length < 2) return NextResponse.json({ error: 'choice questions need at least 2 options' }, { status: 400 });
  }
  // Comment-box flags only apply to choice questions; force them off for plain text types.
  const allowComment = needsOptions(type) ? !!allowText : false;
  const commentRequired = allowComment ? !!textRequired : false;
  const q = await prisma.question.create({
    data: {
      text,
      type,
      options: needsOptions(type) ? options : undefined,
      required: !!required,
      allowText: allowComment,
      textRequired: commentRequired,
    },
  });
  return NextResponse.json(q, { status: 201 });
}
