import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { SessionProvider } from '@/components/SessionProvider';

const inter = Inter({ subsets: ['latin'], weight: ['400', '600', '700'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Kosca Distribution LLP | Survey',
  description: 'Employee appraisal surveys',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        {/* Synchronous external script — runs before first paint so dark-mode
            users never see a flash of light. Source: /public/theme-bootstrap.js.
            next/script with strategy="beforeInteractive" injects this into the
            HTML shell outside React's reconciler, avoiding the React 19 dev
            warning about <script> elements inside components. */}
        <Script id="theme-bootstrap" strategy="beforeInteractive" src="/theme-bootstrap.js" />
        <a href="#main-content" className="skip-link">Skip to content</a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
