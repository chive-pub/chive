import { Suspense } from 'react';
import type { Metadata } from 'next';

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
    <div className="container py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Authors</h1>
        <p className="mt-2 text-muted-foreground">
          Discover researchers sharing their work on Chive
        </p>
      </header>

      <Suspense fallback={<AuthorsPageSkeleton />}>
        <AuthorsPageContent />
      </Suspense>
    </div>
  );
}
