import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Readiness probe: returns 200 only when the process can serve real traffic.
// Currently checks the database. Add cache / queue checks as those layers
// come online.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const checks: Record<string, 'ok' | string> = {};
  let allOk = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch (err) {
    allOk = false;
    checks.db = err instanceof Error ? err.message : 'error';
  }

  return NextResponse.json(
    { status: allOk ? 'ready' : 'unready', checks },
    { status: allOk ? 200 : 503 },
  );
}
