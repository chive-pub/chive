import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

import { Providers } from '@/components/providers';
import { FaroInit } from '@/components/observability';
import { ConditionalHeader } from '@/components/conditional-header';
import { SkipLink } from '@/components/skip-link';
import { Toaster } from '@/components/ui/sonner';
import { DebugPanel } from '@/components/debug';
import 'highlight.js/styles/github-dark.css';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Chive | Decentralized Eprint Service',
    template: '%s | Chive',
  },
  description: 'Decentralized eprints on ATProto.',
  keywords: [
    'eprint',
    'academic',
    'research',
    'ATProto',
    'decentralized',
    'open access',
    'scholarly communication',
  ],
  authors: [{ name: 'Aaron Steven White', url: 'https://chive.pub' }],
  icons: {
    icon: '/chive-logo.svg',
    apple: '/chive-logo.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://chive.pub',
    siteName: 'Chive',
    title: 'Chive | Decentralized Eprint Service',
    description: 'Decentralized eprints on ATProto.',
    images: [
      {
        url: 'https://chive.pub/og',
        width: 1200,
        height: 630,
        alt: 'Chive | Decentralized Eprint Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chive | Decentralized Eprint Service',
    description: 'Decentralized eprints on ATProto.',
    images: ['https://chive.pub/og'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Initialize Grafana Faro for observability (errors, traces, web vitals) */}
        <FaroInit />
        <Providers>
          <SkipLink />
          <div className="relative flex min-h-screen flex-col">
            <ConditionalHeader />
            <main id="main-content" className="flex-1" tabIndex={-1}>
              {children}
            </main>
          </div>
          <Toaster />
          <DebugPanel />
        </Providers>
      </body>
    </html>
  );
}
