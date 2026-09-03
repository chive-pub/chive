import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

import { absoluteUrl, siteUrl } from '@/lib/site/url';
import { Providers } from '@/components/providers';
import { FaroInit } from '@/components/observability';
import { ConditionalHeader } from '@/components/conditional-header';
import { OpenAlphaBanner } from '@/components/banners/open-alpha-banner';
import { OnboardingPromptBanner } from '@/components/banners/onboarding-prompt-banner';
import { SkipLink } from '@/components/skip-link';
import { Toaster } from '@/components/ui/sonner';
import { DebugPanel } from '@/components/debug';
import 'highlight.js/styles/github-dark.css';
import '@/styles/globals.css';

/**
 * The card shown when the site itself is shared.
 *
 * @remarks
 * The generator lives at `/api/og`; there has never been a route at `/og`.
 * Named here so the two places that reference it cannot disagree, which is how
 * one of them came to point at nothing.
 */
const DEFAULT_OG_PATH = '/api/og?type=default';

export const metadata: Metadata = {
  // Absolute URLs come from NEXT_PUBLIC_SITE_URL rather than a literal, so a
  // staging deployment stops advertising production as its canonical home.
  metadataBase: new URL(siteUrl()),
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
  authors: [{ name: 'Aaron Steven White', url: siteUrl() }],
  icons: {
    icon: '/chive-logo.svg',
    apple: '/chive-logo.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl(),
    siteName: 'Chive',
    title: 'Chive | Decentralized Eprint Service',
    description: 'Decentralized eprints on ATProto.',
    images: [
      {
        // `/api/og`, not `/og`. There is no route at `/og`, so every unfurl of
        // the site itself asked for a page that does not exist and fell back to
        // no image at all -- while eprint pages, which build the path from the
        // same generator, looked fine.
        url: absoluteUrl(DEFAULT_OG_PATH),
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
    images: [absoluteUrl(DEFAULT_OG_PATH)],
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
            <OpenAlphaBanner />
            <OnboardingPromptBanner />
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
