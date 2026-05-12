// Simple fixed-window rate limiter, in-memory.
// Adequate for single-instance deployments. If you ever run multiple replicas,
// swap the Map for Redis (INCR + EXPIRE) — interface stays identical.

type Bucket = { count: number; resetAt: number };

const stores = new Map<string, Map<string, Bucket>>();

function getStore(name: string): Map<string, Bucket> {
  let s = stores.get(name);
  if (!s) {
    s = new Map();
    stores.set(name, s);
  }
  return s;
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(opts: {
  name: string;       // logical limiter (auth, survey, default)
  key: string;        // per-IP / per-user identifier
  limit: number;      // requests allowed per window
  windowMs: number;   // window length
}): RateLimitResult {
  const store = getStore(opts.name);
  const now = Date.now();
  let b = store.get(opts.key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + opts.windowMs };
    store.set(opts.key, b);
  }
  b.count += 1;
  if (store.size > 5000) {
    // Bounded pruning: drop expired entries when the store grows.
    for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  }
  return {
    ok: b.count <= opts.limit,
    remaining: Math.max(0, opts.limit - b.count),
    resetAt: b.resetAt,
  };
}

export function clientKey(req: { headers: Headers }): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
