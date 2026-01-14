import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { EprintsPageContent } from './eprints-content';
import { EprintsPageSkeleton } from './loading';

/**
 * Eprints page metadata.
 */
export const metadata: Metadata = {
  title: 'Eprints',
  description:
    'Browse and discover the latest eprints on Chive, a decentralized eprint server built on AT Protocol.',
};

/**
 * Eprints index page component.
 *
 * @remarks
 * Server component that displays recent eprints and provides
 * navigation to browse and search functionality.
 */
export default function EprintsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Eprints</h1>
          <p className="mt-2 text-muted-foreground">Discover the latest research shared on Chive</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/browse">Browse by Field</Link>
          </Button>
          <Button asChild>
            <Link href="/search">Search</Link>
          </Button>
        </div>
      </header>

      <Suspense fallback={<EprintsPageSkeleton />}>
        <EprintsPageContent />
      </Suspense>
    </div>
  );
}
