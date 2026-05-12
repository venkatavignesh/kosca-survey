import { NextResponse } from 'next/server';

// Liveness probe: returns 200 as long as the Node process is responsive.
// No DB / external calls — load balancers and Kubernetes use this to decide
// whether to restart the container.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({ status: 'alive', uptime: process.uptime() });
}
