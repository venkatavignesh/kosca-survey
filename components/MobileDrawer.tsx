'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const DrawerCtx = createContext<Ctx>({ open: false, setOpen: () => {} });

export function MobileDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <DrawerCtx.Provider value={{ open, setOpen }}>{children}</DrawerCtx.Provider>;
}

export function useMobileDrawer() {
  return useContext(DrawerCtx);
}

export function MobileDrawerButton() {
  const { setOpen } = useMobileDrawer();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open menu"
      className="md:hidden p-1 rounded transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
      style={{ color: 'var(--text-muted)' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}

export function MobileDrawer({ links, role }: { links: { href: string; label: string }[]; role: string }) {
  const { open, setOpen } = useMobileDrawer();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(false), [setOpen]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Lock scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        aria-hidden
        className="fixed inset-0 z-40 bg-black/50"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: open ? 'opacity 200ms ease-out' : 'opacity 150ms ease-in',
        }}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="fixed inset-y-0 left-0 z-50 flex flex-col"
        style={{
          width: '72vw',
          maxWidth: '280px',
          background: 'var(--surface-primary)',
          borderRight: '1px solid var(--border-primary)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: open ? 'transform 250ms ease-out' : 'transform 200ms ease-in',
        }}
      >
        <div
          className="flex items-center gap-2 px-4 h-12"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--header-border)' }}
        >
          <Image
            src="/kosca-logo.png"
            alt="Kosca"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
          <div className="font-bold tracking-tight text-sm">
            <span style={{ color: 'var(--accent-primary)' }}>Kosca Distribution LLP</span>
            <span className="mx-1.5" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>|</span>
            <span style={{ color: 'var(--accent-primary)' }}>Survey</span>
            <span
              className="ml-2 rounded-full px-1.5 py-[1px] text-[9px] uppercase font-bold tracking-wider align-middle"
              style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)' }}
            >
              {role}
            </span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {links.map((l) => {
            const isRoot = l.href === '/admin' || l.href === '/hr';
            const active = isRoot ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + '/');
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="block text-xs font-semibold transition-colors"
                style={{
                  padding: '9px 12px',
                  margin: '0 8px',
                  borderRadius: 6,
                  background: active ? 'var(--nav-active-bg)' : 'transparent',
                  color: active ? 'var(--nav-active-text)' : 'var(--text-secondary)',
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div
          className="px-4 py-3 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {session?.user.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors border self-start"
            style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-primary)' }}
          >
            Sign out
          </button>
        </div>
      </aside>
    </>,
    document.body,
  );
}
