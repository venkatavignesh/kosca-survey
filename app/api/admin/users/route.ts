import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { generateTempPassword, hashPassword, validatePassword } from '@/lib/password';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, name: true, role: true,
      mustChangePassword: true, passwordChangedAt: true, createdAt: true,
    },
  });
  return NextResponse.json(users);
}

const Body = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.nativeEnum(Role),
  password: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  const password = parsed.data.password || generateTempPassword();
  if (parsed.data.password) {
    const v = validatePassword(parsed.data.password);
    if (v) return NextResponse.json({ error: v }, { status: 400 });
  }
  try {
    const u = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
      },
    });
    return NextResponse.json({ id: u.id, email: u.email, tempPassword: password }, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'email already exists' }, { status: 409 });
    throw e;
  }
}
