import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

import { Providers } from '@/components/providers';
import { ConditionalHeader } from '@/components/conditional-header';
import { SkipLink } from '@/components/skip-link';
import { Toaster } from '@/components/ui/sonner';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Chive - Decentralized Preprint Server',
    template: '%s | Chive',
  },
  description:
    'Open access preprint server built on AT Protocol. Discover, share, and discuss academic research with full data sovereignty.',
  keywords: [
    'preprint',
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
    title: 'Chive - Decentralized Preprint Server',
    description: 'Open access preprint server built on AT Protocol with full data sovereignty.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chive - Decentralized Preprint Server',
    description: 'Open access preprint server built on AT Protocol.',
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
        <Providers>
          <SkipLink />
          <div className="relative flex min-h-screen flex-col">
            <ConditionalHeader />
            <main id="main-content" className="flex-1" tabIndex={-1}>
              {children}
            </main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
