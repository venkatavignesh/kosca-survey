import { NextResponse } from 'next/server';
import { renderMetrics } from '@/lib/metrics';

// Prometheus exposition endpoint. Only scrape from inside the cluster /
// behind your reverse proxy; this currently has no auth. If exposed publicly
// in future, gate with a `METRICS_SECRET` Bearer token like /api/cron/*.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return new NextResponse(renderMetrics(), {
    status: 200,
    headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
  });
}
