import { Suspense } from 'react';
import type { Metadata } from 'next';

import { TagsPageContent } from './tags-content';
import { TagsPageSkeleton } from './loading';

/**
 * Tags browse page metadata.
 */
export const metadata: Metadata = {
  title: 'Browse Tags',
  description: 'Explore user-contributed tags and discover eprints by topic.',
};

/**
 * Tags browse page.
 *
 * @remarks
 * Displays trending tags, tag cloud, and allows searching tags.
 *
 * @example
 * URL: /tags
 */
export default function TagsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Tags</h1>
        <p className="mt-2 text-muted-foreground">Explore eprints by community-contributed tags</p>
      </header>

      <Suspense fallback={<TagsPageSkeleton />}>
        <TagsPageContent />
      </Suspense>
    </div>
  );
}
