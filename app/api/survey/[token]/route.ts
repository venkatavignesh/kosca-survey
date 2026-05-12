import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

const SubmitBody = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      valueText: z.string().nullable().optional(),
      valueOptions: z.array(z.string()).nullable().optional(),
    }),
  ),
});

async function loadSurvey(token: string) {
  const a = await prisma.campaignAssignment.findUnique({
    where: { token },
    include: {
      campaign: true,
      employee: { include: { location: true, officeType: true, department: true } },
    },
  });
  if (!a) return null;
  const cqs = await prisma.campaignQuestion.findMany({
    where: { campaignId: a.campaignId },
    orderBy: { order: 'asc' },
    include: { question: true, targets: true },
  });
  const visible = cqs.filter((cq) =>
    cq.audience === 'ALL' || cq.targets.some((t) => t.employeeId === a.employeeId),
  );
  return { a, visible };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ck = await cookies();
  if (!ck.get(`survey_${token}`)) return NextResponse.json({ error: 'unconfirmed' }, { status: 401 });
  const data = await loadSurvey(token);
  if (!data) return NextResponse.json({ error: 'invalid' }, { status: 404 });
  if (data.a.submittedAt) return NextResponse.json({ error: 'already submitted' }, { status: 410 });
  return NextResponse.json({
    campaign: { title: data.a.campaign.title, description: data.a.campaign.description, deadline: data.a.campaign.deadline },
    employee: { name: data.a.employee.name, empCode: data.a.employee.empCode, designation: data.a.employee.designation },
    questions: data.visible.map((cq) => ({
      id: cq.question.id,
      text: cq.question.text,
      type: cq.question.type,
      options: cq.question.options as string[] | null,
      required: cq.question.required,
      order: cq.order,
    })),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ck = await cookies();
  if (!ck.get(`survey_${token}`)) return NextResponse.json({ error: 'unconfirmed' }, { status: 401 });
  const json = await req.json().catch(() => null);
  const parsed = SubmitBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const data = await loadSurvey(token);
  if (!data) return NextResponse.json({ error: 'invalid' }, { status: 404 });
  if (data.a.submittedAt) return NextResponse.json({ error: 'already submitted' }, { status: 410 });
  if (data.a.campaign.deadline && data.a.campaign.deadline < new Date()) {
    return NextResponse.json({ error: 'deadline passed' }, { status: 410 });
  }

  const visibleIds = new Set(data.visible.map((v) => v.questionId));
  const byId = new Map(data.visible.map((v) => [v.questionId, v.question]));
  // validate required + textRequired
  for (const v of data.visible) {
    const q = v.question;
    const ans = parsed.data.answers.find((x) => x.questionId === v.questionId);
    const isText = q.type === 'TEXT' || q.type === 'LONG_TEXT';
    if (q.required) {
      if (!ans) return NextResponse.json({ error: `missing required: ${q.text}` }, { status: 400 });
      if (isText) {
        if (!ans.valueText || !ans.valueText.trim()) return NextResponse.json({ error: `required: ${q.text}` }, { status: 400 });
      } else {
        if (!ans.valueOptions || ans.valueOptions.length === 0) return NextResponse.json({ error: `required: ${q.text}` }, { status: 400 });
      }
    }
    if (q.allowText && q.textRequired) {
      if (!ans?.valueText || !ans.valueText.trim()) {
        return NextResponse.json({ error: `comment required: ${q.text}` }, { status: 400 });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    const response = await tx.response.create({ data: { assignmentId: data.a.id } });
    for (const ans of parsed.data.answers) {
      if (!visibleIds.has(ans.questionId)) continue;
      const q = byId.get(ans.questionId)!;
      const isText = q.type === 'TEXT' || q.type === 'LONG_TEXT';
      // Store the comment text alongside option(s) for choice questions that
      // have allowText enabled. Pure text questions store valueText only;
      // pure choice questions (no allowText) store valueOptions only.
      const wantsText = isText || q.allowText;
      const wantsOptions = !isText;
      await tx.answer.create({
        data: {
          responseId: response.id,
          questionId: ans.questionId,
          valueText: wantsText ? (ans.valueText ?? null) : null,
          valueOptions: wantsOptions ? ((ans.valueOptions ?? []) as any) : undefined,
        },
      });
    }
    await tx.campaignAssignment.update({
      where: { id: data.a.id },
      data: { submittedAt: new Date() },
    });
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(`survey_${token}`, '', { path: '/', maxAge: 0 });
  return res;
}
