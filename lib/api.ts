import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { getSession } from './auth';

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (session.user.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function requireStaff() {
  const session = await getSession();
  if (!session?.user) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.HR) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { session };
}

export function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}
