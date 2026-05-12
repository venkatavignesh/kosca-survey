import pino from 'pino';

// Structured JSON logger. In dev pretty-print is fine; in prod we ship raw JSON
// so log shippers (Loki/CloudWatch/Datadog) can index fields directly.
const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.secret',
    ],
    censor: '[redacted]',
  },
  base: {
    service: 'kosca-survey',
    env: process.env.NODE_ENV || 'development',
  },
});

// Helper for request-scoped child loggers.
export function withRequestId(requestId: string) {
  return logger.child({ requestId });
}
