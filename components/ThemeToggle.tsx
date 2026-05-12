'use client';
import { useEffect, useState, useCallback } from 'react';

type Mode = 'system' | 'light' | 'dark';

function applyMode(mode: Mode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('light');

  useEffect(() => {
    let saved: Mode = 'light';
    try {
      const v = localStorage.getItem('theme');
      if (v === 'dark' || v === 'light' || v === 'system') saved = v;
    } catch {
      /* ignore */
    }
    setMode(saved);
    applyMode(saved);

    if (saved !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyMode('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const cycle = useCallback(() => {
    const next: Mode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
    setMode(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
    applyMode(next);
  }, [mode]);

  const label =
    mode === 'system' ? 'Theme: system (click for light)' :
    mode === 'light'  ? 'Theme: light (click for dark)'  :
                        'Theme: dark (click for system)';

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={label}
      className="p-1 rounded transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
      style={{ color: 'var(--text-muted)' }}
    >
      {mode === 'system' && (
        // monitor / system
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <rect x="2" y="4" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 18v3" />
        </svg>
      )}
      {mode === 'light' && (
        // sun
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
      {mode === 'dark' && (
        // moon
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
