import Image from 'next/image';

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-30 h-12"
        style={{
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--header-border)',
        }}
      >
        <div className="px-4 lg:px-8 h-12 flex items-center gap-2">
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
          </div>
        </div>
      </header>
      <main id="main-content" className="max-w-3xl mx-auto w-full px-4 lg:px-8 py-4 flex-1">
        {children}
      </main>
      <footer className="text-center text-xs p-4" style={{ color: 'var(--text-muted)' }}>
        Confidential — for internal use only.
      </footer>
    </div>
  );
}
