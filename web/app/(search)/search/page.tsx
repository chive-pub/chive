import { Suspense } from 'react';
import type { Metadata } from 'next';

import { SearchPageContent } from './search-content';
import { SearchPageSkeleton } from './loading';

/**
 * Search page metadata.
 */
export const metadata: Metadata = {
  title: 'Search Eprints | Chive',
  description: 'Search across all eprints on Chive, the decentralized eprint server.',
};

/**
 * Search page route parameters.
 */
interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    field?: string;
    author?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: 'relevance' | 'date' | 'views';
  }>;
}

/**
 * Search page component.
 *
 * @remarks
 * Server component that renders the search page with URL-based query params.
 * Delegates interactive functionality to client components.
 *
 * @example
 * URL: /search?q=quantum+computing&field=physics
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        <p className="mt-2 text-muted-foreground">Discover eprints across all fields of study</p>
      </header>

      <Suspense fallback={<SearchPageSkeleton />}>
        <SearchPageContent
          initialQuery={params.q}
          initialFilters={{
            field: params.field,
            author: params.author,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
          }}
          initialSort={params.sort}
        />
      </Suspense>
    </div>
  );
}
