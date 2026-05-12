import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hashPassword, validatePassword, verifyPassword } from '@/lib/password';

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
  confirmNewPassword: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  const { currentPassword, newPassword, confirmNewPassword } = parsed.data;
  if (newPassword !== confirmNewPassword) return NextResponse.json({ error: 'passwords do not match' }, { status: 400 });
  const policyErr = validatePassword(newPassword);
  if (policyErr) return NextResponse.json({ error: policyErr }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 });

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'current password is incorrect' }, { status: 400 });

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'new password must be different' }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
