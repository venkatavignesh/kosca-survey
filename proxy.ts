import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { rateLimit, clientKey } from '@/lib/rate-limit';

const ADMIN_PREFIXES = ['/admin', '/api/admin'];
const HR_PREFIXES = ['/hr', '/api/hr'];
const ACCOUNT_PREFIXES = ['/account', '/api/account'];

// Per-IP rate limits. Auth + survey-submission endpoints are abuse magnets.
const RATE_LIMITS = [
  { match: '/api/auth/callback/credentials', name: 'auth', limit: 10, windowMs: 60_000 },
  { match: '/api/auth/', name: 'auth-misc', limit: 60, windowMs: 60_000 },
  { match: '/api/survey/', name: 'survey', limit: 30, windowMs: 60_000 },
];

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(p + '/'));
}

// Hardening: per-request correlation id + baseline security headers,
// applied to every response from the proxy.
function applyRequestHeaders(req: NextRequest, res: NextResponse) {
  const incoming = req.headers.get('x-request-id');
  // Accept upstream id but only if it looks sane; otherwise mint one.
  const requestId = (incoming && /^[A-Za-z0-9_.-]{8,80}$/.test(incoming))
    ? incoming
    : crypto.randomUUID();
  res.headers.set('x-request-id', requestId);

  // Per-request CSP nonce. Next.js's runtime + theme bootstrap inline scripts
  // pick this up via getNonce() / headers().get('x-csp-nonce') so we can drop
  // 'unsafe-inline' from script-src.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  res.headers.set('x-csp-nonce', nonce);

  // Baseline security headers. CSP intentionally permissive for inline next.js
  // bootstrap; tighten when we stop using inline scripts.
  res.headers.set('x-content-type-options', 'nosniff');
  res.headers.set('x-frame-options', 'SAMEORIGIN');
  res.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  res.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains');
    // CSP is production-only to avoid blocking Next.js dev eval / inline HMR.
    // Inline scripts/styles are needed for next/script "beforeInteractive"
    // (the theme bootstrap) and Next's runtime bootstrap.
    res.headers.set(
      'content-security-policy',
      [
        "default-src 'self'",
        // 'strict-dynamic' lets nonce-loaded scripts spawn further scripts
        // (Next.js does this). 'unsafe-inline' is kept only as a fallback for
        // pre-CSP3 browsers (Safari 13- etc.) and is ignored when nonce is set.
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
        // Styles are still inlined by Next.js without nonce support — keep
        // 'unsafe-inline' on style-src until that lands upstream.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "connect-src 'self'",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join('; '),
    );
  }
  // Cross-origin protections. CORP=same-site (not same-origin) so Next.js
  // App Router RSC fetches across LAN-IP / localhost still work — full
  // same-origin breaks the segment-cache prefetch in dev.
  res.headers.set('cross-origin-opener-policy', 'same-origin-allow-popups');
  res.headers.set('cross-origin-resource-policy', 'same-site');
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate-limit before auth — abusive clients should never reach getToken.
  for (const rule of RATE_LIMITS) {
    if (pathname.startsWith(rule.match)) {
      const result = rateLimit({
        name: rule.name,
        key: clientKey(req),
        limit: rule.limit,
        windowMs: rule.windowMs,
      });
      if (!result.ok) {
        const res = new NextResponse(
          JSON.stringify({ error: 'Too many requests', retryAfterMs: Math.max(0, result.resetAt - Date.now()) }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        );
        res.headers.set('retry-after', String(Math.ceil((result.resetAt - Date.now()) / 1000)));
        return applyRequestHeaders(req, res);
      }
      break;
    }
  }

  const needsAuth =
    startsWithAny(pathname, ADMIN_PREFIXES) ||
    startsWithAny(pathname, HR_PREFIXES) ||
    startsWithAny(pathname, ACCOUNT_PREFIXES);

  if (!needsAuth) return applyRequestHeaders(req, NextResponse.next());

  // Match the cookie name configured in lib/auth.ts (useSecureCookies:false).
  // Otherwise getToken would look for `__Secure-next-auth.session-token`
  // because NEXTAUTH_URL is https, and miss the plain cookie that's actually
  // set when serving over LAN HTTP.
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, secureCookie: false });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return applyRequestHeaders(req, NextResponse.redirect(url));
  }

  // Forced password change: only allow /account/password and api auth/account
  if ((token as any).mustChangePassword) {
    const allowedWhilePwChange =
      pathname === '/account/password' ||
      pathname === '/api/account/password' ||
      pathname.startsWith('/api/auth/');
    if (!allowedWhilePwChange) {
      const url = req.nextUrl.clone();
      url.pathname = '/account/password';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  const role = (token as any).role as 'ADMIN' | 'HR' | undefined;

  if (startsWithAny(pathname, ADMIN_PREFIXES) && role !== 'ADMIN') {
    if (pathname.startsWith('/api/')) {
      return applyRequestHeaders(req, new NextResponse('Forbidden', { status: 403 }));
    }
    const url = req.nextUrl.clone();
    url.pathname = '/hr';
    url.search = '';
    return applyRequestHeaders(req, NextResponse.redirect(url));
  }

  if (startsWithAny(pathname, HR_PREFIXES) && role !== 'ADMIN' && role !== 'HR') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return applyRequestHeaders(req, NextResponse.next());
}

export const config = {
  // Match everything except next internals + static files so request-id and
  // security headers attach to every response.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|kosca-logo.png|theme-bootstrap.js).*)'],
};
