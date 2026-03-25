'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { useIsAuthenticated } from '@/lib/auth';
import { Button } from '@/components/ui/button';

/**
 * Public landing page for Chive.
 *
 * @remarks
 * Displays hero content and calls-to-action for unauthenticated visitors.
 * Authenticated users are redirected to the dashboard.
 */
export default function LandingPage() {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
      <div className="max-w-[600px] text-center">
        {/* Logo */}
        <Image
          src="/chive-logo.svg"
          alt="Chive"
          width={100}
          height={100}
          className="mx-auto mb-8"
          priority
        />

        {/* Title */}
        <h1 className="mb-2 text-5xl font-bold tracking-tight">Chive</h1>
        <p className="mb-6 text-2xl text-muted-foreground">Decentralized eprints on ATProto</p>

        {/* Description */}
        <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
          Share your research with full data sovereignty and community governance.
        </p>

        {/* Open Alpha Notice */}
        <div className="mx-auto mb-6 max-w-sm overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-500/10 shadow-sm">
          <div className="flex items-center gap-2 border-b border-amber-500/10 bg-amber-500/5 px-4 py-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Open Alpha
            </span>
          </div>
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Chive is in open alpha. You may encounter bugs or incomplete features. We appreciate and
            encourage{' '}
            <a
              href="https://github.com/chive-pub/chive/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              bug reports
            </a>
            .
          </p>
        </div>

        {/* CTAs */}
        <div className="mx-auto mb-8 flex max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="bg-[#157200] hover:bg-[#125f00]">
            <Link href="/eprints">Browse Eprints</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://docs.chive.pub"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-base font-medium transition-colors hover:bg-muted"
          >
            Read the Docs
          </a>
          <a
            href="https://github.com/chive-pub/chive"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-base font-medium transition-colors hover:bg-muted"
          >
            GitHub
          </a>
          <a
            href="https://atproto.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-base font-medium transition-colors hover:bg-muted"
          >
            ATProto
          </a>
        </div>
      </div>
    </div>
  );
}
