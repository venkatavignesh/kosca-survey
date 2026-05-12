import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Audience } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { generateToken } from '@/lib/tokens';

const Body = z.object({
  employeeIds: z.array(z.string()).min(0),
  questions: z.array(
    z.object({
      questionId: z.string(),
      order: z.number().int(),
      audience: z.nativeEnum(Audience),
      groupId: z.string().nullable().optional(),
      employeeIds: z.array(z.string()).optional(),
    }),
  ),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id: campaignId } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const { employeeIds, questions } = parsed.data;
  const empSet = new Set(employeeIds);

  await prisma.$transaction(async (tx) => {
    // Assignments: ensure one per (campaignId, employeeId) in employeeIds
    const existing = await tx.campaignAssignment.findMany({ where: { campaignId } });
    const existingByEmp = new Map(existing.map((a) => [a.employeeId, a]));

    for (const empId of employeeIds) {
      if (!existingByEmp.has(empId)) {
        await tx.campaignAssignment.create({
          data: {
            campaignId,
            employeeId: empId,
            token: generateToken(),
          },
        });
      }
    }
    // Remove assignments no longer selected (only if not yet submitted)
    const toRemove = existing.filter((a) => !empSet.has(a.employeeId) && !a.submittedAt);
    if (toRemove.length > 0) {
      await tx.campaignAssignment.deleteMany({ where: { id: { in: toRemove.map((x) => x.id) } } });
    }

    // Replace question set
    await tx.campaignQuestion.deleteMany({ where: { campaignId } });
    for (const q of questions) {
      const cq = await tx.campaignQuestion.create({
        data: { campaignId, questionId: q.questionId, order: q.order, audience: q.audience, groupId: q.groupId ?? null },
      });
      if (q.audience === Audience.SPECIFIC && q.employeeIds && q.employeeIds.length > 0) {
        await tx.campaignQuestionEmployee.createMany({
          data: q.employeeIds
            .filter((e) => empSet.has(e))
            .map((employeeId) => ({ campaignQuestionId: cq.id, employeeId })),
          skipDuplicates: true,
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
