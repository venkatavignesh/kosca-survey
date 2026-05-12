import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const Body = z.object({ code: z.string().min(4).max(8) });
const MAX_ATTEMPTS = 5;
const CODE_TTL_MINUTES = 15;

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const a = await prisma.campaignAssignment.findUnique({ where: { token } });
  if (!a) return NextResponse.json({ error: 'invalid link' }, { status: 404 });
  if (a.submittedAt) return NextResponse.json({ error: 'already submitted' }, { status: 410 });
  if (!a.emailConfirmCode || !a.confirmCodeSentAt) {
    return NextResponse.json({ error: 'no code requested yet' }, { status: 400 });
  }
  if (a.confirmAttempts >= MAX_ATTEMPTS) return NextResponse.json({ error: 'too many attempts; request a new code' }, { status: 429 });
  const ageMs = Date.now() - a.confirmCodeSentAt.getTime();
  if (ageMs > CODE_TTL_MINUTES * 60 * 1000) {
    return NextResponse.json({ error: 'code expired; request a new code' }, { status: 410 });
  }

  if (parsed.data.code.trim() !== a.emailConfirmCode) {
    await prisma.campaignAssignment.update({
      where: { id: a.id },
      data: { confirmAttempts: { increment: 1 } },
    });
    return NextResponse.json({ error: 'incorrect code' }, { status: 400 });
  }

  await prisma.campaignAssignment.update({
    where: { id: a.id },
    data: {
      confirmedAt: a.confirmedAt ?? new Date(),
      openedAt: a.openedAt ?? new Date(),
      emailConfirmCode: null,
      confirmCodeSentAt: null,
      confirmAttempts: 0,
    },
  });

  // Set httpOnly cookie. Path must be '/' so the browser also sends it on
  // /api/survey/<token> requests; the cookie name still embeds the token so
  // it's scoped to this assignment.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(`survey_${token}`, '1', {
    httpOnly: true,
    // strict prevents this cookie from being attached to cross-site POSTs,
    // which kills CSRF as an attack class on survey submission.
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 6, // 6h
  });
  return res;
}
