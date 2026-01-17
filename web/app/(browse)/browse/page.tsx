import { Suspense } from 'react';
import type { Metadata } from 'next';

import { BrowsePageContent } from './browse-content';
import { BrowsePageSkeleton } from './loading';
import type { DynamicFacetFilters } from '@/lib/hooks/use-faceted-search';

/**
 * Browse page metadata.
 */
export const metadata: Metadata = {
  title: 'Browse Eprints',
  description: 'Browse eprints using faceted classification from the knowledge graph.',
};

/**
 * Browse page route parameters.
 */
interface BrowsePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Browse page component.
 *
 * @remarks
 * Server component that renders the faceted browse page.
 * Supports URL-based filter state for shareable links.
 * Facets are dynamic and fetched from the knowledge graph.
 *
 * @example
 * URL: /browse?methodology=meta-analysis&time-period=21st-century
 */
export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams;

  // Extract query and build dynamic facet filters
  const q = typeof params.q === 'string' ? params.q : undefined;

  // Build facet filters from all other params
  const facets: DynamicFacetFilters = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === 'q' || !value) continue;
    const values = Array.isArray(value) ? value : [value];
    if (values.length > 0) {
      facets[key] = values;
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Browse</h1>
        <p className="mt-2 text-muted-foreground">Explore eprints using faceted classification</p>
      </header>

      <Suspense fallback={<BrowsePageSkeleton />}>
        <BrowsePageContent
          initialParams={{
            q,
            facets: Object.keys(facets).length > 0 ? facets : undefined,
          }}
        />
      </Suspense>
    </div>
  );
}
