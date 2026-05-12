import { logger } from './logger';

// Outbound error reporter. Production should set ERROR_SINK_URL (any HTTPS
// endpoint that accepts a JSON POST: Sentry's tunnel API, Slack/Discord webhook
// JSON, or a Datadog/Loki HTTP ingest).
//
// Calls are non-blocking and failures are swallowed — we never want the report
// path to itself fail a request.

const URL_ENV = process.env.ERROR_SINK_URL;
const SERVICE = 'kosca-survey';
const ENV = process.env.NODE_ENV || 'development';

export type ErrorReport = {
  message: string;
  stack?: string;
  requestId?: string;
  path?: string;
  digest?: string;
  level?: 'error' | 'fatal';
  extra?: Record<string, unknown>;
};

export function reportError(report: ErrorReport): void {
  // Always log locally so we have a record even without a sink configured.
  logger.error(
    { err: { message: report.message, stack: report.stack }, ...report },
    'error reported to sink',
  );
  if (!URL_ENV) return;
  // Fire-and-forget; do not await. Use a 1.5s timeout so a slow sink can't
  // block request shutdown.
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 1500);
  fetch(URL_ENV, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      service: SERVICE,
      env: ENV,
      timestamp: new Date().toISOString(),
      ...report,
    }),
    signal: ctl.signal,
  })
    .catch((err) => logger.warn({ err }, 'error sink delivery failed'))
    .finally(() => clearTimeout(t));
}
