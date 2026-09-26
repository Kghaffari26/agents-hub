import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/shell/Header';
import { Footer } from '@/components/shell/Footer';
import { themeInitScript } from '@/lib/theme';
import { ogImages, SITE_URL } from '@/lib/data/url';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'optional' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL || 'http://localhost:3000'),
  title: { default: 'Agents Hub — four AI agents, updated automatically', template: '%s | Agents Hub' },
  description:
    'Four autonomous AI agents that track housing, the economy, federal contracts, and code — with fresh data on a schedule, sources shown, and costs published.',
  applicationName: 'Agents Hub',
  ...ogImages('default'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfa' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1015' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Pre-hydration theme: no flash (SPEC_WEBSITE §6). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="container-page">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
