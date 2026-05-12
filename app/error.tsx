'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('RouteError caught', { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div className="card" style={{ maxWidth: 560, margin: '3rem auto', textAlign: 'center' }}>
      <h1 className="text-xl font-semibold mb-2">This page hit an error</h1>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Reload the page or head back to the dashboard. If it keeps happening, share the reference below with the IT team.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          Ref: {error.digest}
        </p>
      )}
      <div className="flex justify-center gap-2 mt-4">
        <button className="btn-secondary" onClick={() => reset()}>Try again</button>
        <Link className="btn" href="/admin">Dashboard</Link>
      </div>
    </div>
  );
}
