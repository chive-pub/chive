import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { AuthorsPageContent } from './authors-content';
import { AuthorsPageSkeleton } from './loading';

/**
 * Authors page metadata.
 */
export const metadata: Metadata = {
  title: 'Authors',
  description: 'Discover researchers and their eprints on Chive.',
};

/**
 * Authors index page component.
 *
 * @remarks
 * Server component that displays featured and active authors.
 */
export default function AuthorsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Authors</h1>
          <p className="mt-2 text-muted-foreground">
            Discover researchers sharing their work on Chive
          </p>
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

      <Suspense fallback={<AuthorsPageSkeleton />}>
        <AuthorsPageContent />
      </Suspense>
    </div>
  );
}
