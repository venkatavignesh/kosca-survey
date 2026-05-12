import { NextRequest, NextResponse } from 'next/server';
import { httpRequestsTotal } from '@/lib/metrics';
import { logger } from '@/lib/logger';

// Reads the in-memory metrics registry and posts to ALERT_WEBHOOK_URL when
// error rate over the last interval exceeds 1%. Driven by the cron container
// (every 5 minutes) so it shares the metrics state with the app worker.
//
// Bearer-auth via CRON_SECRET so randoms can't trigger it.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let lastTotal = 0;
let lastErr = 0;

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${process.env.CRON_SECRET || ''}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  // Sum total + 5xx counters across all label combinations.
  let total = 0;
  let err = 0;
  for (const [k, v] of (httpRequestsTotal as any).values as Map<string, number>) {
    total += v;
    // Label set is `{route="...",method="...",status="5xx"}` — match status="5
    if (/status="5/.test(k)) err += v;
  }
  const dTotal = total - lastTotal;
  const dErr = err - lastErr;
  lastTotal = total;
  lastErr = err;

  const rate = dTotal > 0 ? dErr / dTotal : 0;
  const threshold = Number(process.env.ALERT_ERROR_RATE_THRESHOLD || 0.01);
  const tripped = dTotal > 50 && rate > threshold;

  if (tripped && process.env.ALERT_WEBHOOK_URL) {
    try {
      await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `⚠️ kosca-survey error rate ${Math.round(rate * 1000) / 10}% over last interval (${dErr} of ${dTotal} requests). Threshold ${threshold * 100}%.`,
        }),
      });
    } catch (e) {
      logger.warn({ err: e }, 'alert webhook delivery failed');
    }
  }

  return NextResponse.json({
    intervalRequests: dTotal,
    intervalErrors: dErr,
    errorRate: rate,
    tripped,
  });
}
