import { Suspense } from 'react';
import type { Metadata } from 'next';

import { FieldsPageContent } from './fields-content';
import { FieldsPageSkeleton } from './loading';

/**
 * Fields browse page metadata.
 */
export const metadata: Metadata = {
  title: 'Browse Fields | Chive',
  description: 'Explore the knowledge graph of academic fields and subjects on Chive.',
};

/**
 * Fields browse page component.
 *
 * @remarks
 * Server component that displays the top-level field hierarchy.
 * Allows browsing through the knowledge graph structure.
 *
 * @example
 * URL: /fields
 */
export default function FieldsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Fields</h1>
        <p className="mt-2 text-muted-foreground">
          Explore eprints by academic field and subject area
        </p>
      </header>

      <Suspense fallback={<FieldsPageSkeleton />}>
        <FieldsPageContent />
      </Suspense>
    </div>
  );
}
