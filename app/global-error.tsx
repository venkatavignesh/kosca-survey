'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to whatever log sink we have. In production this should
    // be forwarded to Sentry / structured log collector.
    console.error('GlobalError caught', { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
        <p style={{ color: '#666', marginBottom: '1.25rem' }}>
          The page failed to render. Our team has been notified.
        </p>
        {error.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#999', marginBottom: '1.25rem' }}>
            Ref: {error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          style={{ padding: '0.5rem 1rem', background: '#4d47a8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
