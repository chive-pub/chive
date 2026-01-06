import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { PreprintsPageContent } from './preprints-content';
import { PreprintsPageSkeleton } from './loading';

/**
 * Preprints page metadata.
 */
export const metadata: Metadata = {
  title: 'Preprints | Chive',
  description:
    'Browse and discover the latest preprints on Chive, a decentralized preprint server built on AT Protocol.',
};

/**
 * Preprints index page component.
 *
 * @remarks
 * Server component that displays recent preprints and provides
 * navigation to browse and search functionality.
 */
export default function PreprintsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Preprints</h1>
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

      <Suspense fallback={<PreprintsPageSkeleton />}>
        <PreprintsPageContent />
      </Suspense>
    </div>
  );
}
