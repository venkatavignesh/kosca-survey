'use client';
import Link from 'next/link';
import Image from 'next/image';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { MobileDrawer, MobileDrawerButton, MobileDrawerProvider } from './MobileDrawer';

export function StaffNav({ role }: { role: 'ADMIN' | 'HR' }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const adminLinks = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/campaigns', label: 'Campaigns' },
    { href: '/admin/employees', label: 'Employees' },
    { href: '/admin/questions', label: 'Questions' },
    { href: '/admin/masters/locations', label: 'Locations' },
    { href: '/admin/masters/office-types', label: 'Office types' },
    { href: '/admin/masters/departments', label: 'Departments' },
    { href: '/admin/users', label: 'Staff users' },
  ];
  const hrLinks = [
    { href: '/hr', label: 'Dashboard' },
    { href: '/hr/campaigns', label: 'Campaigns' },
    { href: '/hr/employees', label: 'Employees' },
  ];
  const links = role === 'ADMIN' ? adminLinks : hrLinks;

  const initial = (session?.user.email ?? '?').charAt(0).toUpperCase();

  return (
    <MobileDrawerProvider>
      <nav
        className="sticky top-0 z-30 h-12"
        style={{
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--header-border)',
        }}
      >
        <div className="px-4 lg:px-8 grid grid-cols-[1fr_auto_1fr] items-center h-12 gap-4">
          <div className="flex items-center gap-2 min-w-0 justify-self-start">
            <MobileDrawerButton />
            <Link href={role === 'ADMIN' ? '/admin' : '/hr'} className="flex items-center gap-2">
              <Image
                src="/kosca-logo.png"
                alt="Kosca"
                width={32}
                height={32}
                priority
                className="h-8 w-8 object-contain"
              />
              <span className="font-bold tracking-tight text-sm whitespace-nowrap hidden sm:inline">
                <span style={{ color: 'var(--accent-primary)' }}>Kosca Distribution LLP</span>
                <span className="mx-1.5" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>|</span>
                <span style={{ color: 'var(--accent-primary)' }}>Survey</span>
              </span>
            </Link>
          </div>
          <div className="hidden md:flex items-center gap-1 justify-self-center min-w-0 overflow-x-auto">
            {links.map((l) => {
              const isRoot = l.href === '/admin' || l.href === '/hr';
              const active = isRoot
                ? pathname === l.href
                : pathname === l.href || pathname.startsWith(l.href + '/');
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors"
                  style={
                    active
                      ? { background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)' }
                      : { color: 'var(--text-secondary)' }
                  }
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = '';
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2 justify-self-end">
            <ThemeToggle />
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span
                className="text-xs font-semibold max-w-[180px] truncate"
                style={{ color: 'var(--text-secondary)' }}
                title={session?.user.email}
              >
                {session?.user.email}
              </span>
              <span
                className="rounded-full px-1.5 py-[1px] text-[9px] uppercase font-bold tracking-wider mt-0.5"
                style={{ background: 'var(--badge-bg)', color: 'var(--badge-text)' }}
              >
                {role}
              </span>
            </div>
            <Link
              href="/account/password"
              aria-label="Account"
              className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{
                background:
                  'linear-gradient(135deg, var(--accent-gradient-from), var(--accent-gradient-to))',
              }}
            >
              {initial}
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="hidden sm:inline-flex px-2.5 py-1 rounded-md text-xs font-semibold transition-colors border"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-primary)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
      <MobileDrawer links={links} role={role} />
    </MobileDrawerProvider>
  );
}
