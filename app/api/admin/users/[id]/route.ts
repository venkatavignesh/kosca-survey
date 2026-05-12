import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { generateTempPassword, hashPassword } from '@/lib/password';

const Body = z.object({
  name: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  action: z.literal('resetPassword').optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });

  if (parsed.data.action === 'resetPassword') {
    const temp = generateTempPassword();
    await prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(temp), mustChangePassword: true },
    });
    return NextResponse.json({ tempPassword: temp });
  }

  const data: any = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.role) data.role = parsed.data.role;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'no fields' }, { status: 400 });
  const u = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ id: u.id, role: u.role });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;

  if (auth.session.user.id === id) {
    return NextResponse.json({ error: 'cannot delete your own account' }, { status: 400 });
  }
  // ensure at least one admin remains
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (target.role === Role.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
    if (adminCount <= 1) return NextResponse.json({ error: 'cannot delete the last admin' }, { status: 400 });
  }
  // Reassign campaign ownership to current admin
  await prisma.campaign.updateMany({ where: { createdById: id }, data: { createdById: auth.session.user.id } });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
