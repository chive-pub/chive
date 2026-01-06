'use client';

import { PreprintCard, PreprintCardSkeleton } from '@/components/preprints';
import { HighlightedSnippet } from './search-highlight';
import { SearchEmpty, SearchError } from './search-empty';
import { cn } from '@/lib/utils';
import { formatCompactNumber } from '@/lib/utils/format-number';
import type { SearchHit, SearchResultsResponse } from '@/lib/api/schema';

/**
 * Props for the SearchResults component.
 */
export interface SearchResultsProps {
  /** Search query */
  query: string;
  /** Search response data */
  data?: SearchResultsResponse;
  /** Whether results are loading */
  isLoading?: boolean;
  /** Error if search failed */
  error?: Error | null;
  /** Callback to retry the search */
  onRetry?: () => void;
  /** Callback to clear filters */
  onClearFilters?: () => void;
  /** Whether filters are active */
  hasFilters?: boolean;
  /** Callback for prefetching on hover */
  onPrefetch?: (uri: string) => void;
  /** Display layout */
  layout?: 'list' | 'grid';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays search results with loading, error, and empty states.
 *
 * @remarks
 * Client component that handles all search result display states.
 * Integrates with the preprint card component and shows highlights.
 *
 * @example
 * ```tsx
 * <SearchResults
 *   query={searchQuery}
 *   data={searchResponse}
 *   isLoading={isSearching}
 *   error={searchError}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying search results
 */
export function SearchResults({
  query,
  data,
  isLoading = false,
  error = null,
  onRetry,
  onClearFilters,
  hasFilters = false,
  onPrefetch,
  layout = 'list',
  className,
}: SearchResultsProps) {
  // Loading state
  if (isLoading) {
    return <SearchResultsSkeleton count={5} layout={layout} className={className} />;
  }

  // Error state
  if (error) {
    return <SearchError message={error.message} onRetry={onRetry} className={className} />;
  }

  // Empty/no query state
  if (!data || !data.hits || data.hits.length === 0) {
    return (
      <SearchEmpty
        query={query}
        hasFilters={hasFilters}
        onClearFilters={onClearFilters}
        className={className}
      />
    );
  }

  const layoutClasses =
    layout === 'grid'
      ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
      : 'flex flex-col gap-4';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Results header */}
      <SearchResultsHeader total={data.total} query={query} />

      {/* Results list */}
      <div className={layoutClasses}>
        {data.hits.map((preprint) => (
          <SearchResultCard
            key={preprint.uri}
            preprint={preprint}
            onPrefetch={onPrefetch}
            layout={layout}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Props for the SearchResultsHeader component.
 */
export interface SearchResultsHeaderProps {
  /** Total number of results */
  total: number;
  /** Search query */
  query: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Header showing result count.
 */
export function SearchResultsHeader({ total, query, className }: SearchResultsHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <p className="text-sm text-muted-foreground">
        Found <span className="font-medium text-foreground">{formatCompactNumber(total)}</span>{' '}
        {total === 1 ? 'result' : 'results'} for &ldquo;{query}&rdquo;
      </p>
    </div>
  );
}

/**
 * Props for the SearchResultCard component.
 */
interface SearchResultCardProps {
  preprint: SearchHit;
  onPrefetch?: (uri: string) => void;
  layout?: 'list' | 'grid';
}

/**
 * Individual search result card with highlights.
 */
function SearchResultCard({ preprint, onPrefetch, layout }: SearchResultCardProps) {
  // API returns highlights as { [field: string]: string[] }
  const highlightEntries = preprint.highlights ? Object.entries(preprint.highlights) : [];
  const hasHighlights = highlightEntries.length > 0;

  // In grid layout or if no highlights, use standard card
  if (layout === 'grid' || !hasHighlights) {
    return <PreprintCard preprint={preprint} onPrefetch={onPrefetch} variant="default" />;
  }

  // In list layout with highlights, show expanded card with snippets
  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
      <PreprintCard preprint={preprint} onPrefetch={onPrefetch} variant="compact" />

      {/* Highlighted snippets */}
      {hasHighlights && (
        <div className="mt-3 border-t pt-3">
          {highlightEntries.map(([field, snippets]) => (
            <div key={field} className="mb-2 last:mb-0">
              <span className="text-xs font-medium uppercase text-muted-foreground">{field}:</span>
              <HighlightedSnippet snippets={snippets} max={2} className="mt-1" />
            </div>
          ))}
        </div>
      )}

      {/* Relevance score (if available) */}
      {preprint.score !== undefined && (
        <div className="mt-2 text-xs text-muted-foreground">
          Relevance: {(preprint.score * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}

/**
 * Props for the SearchResultsSkeleton component.
 */
export interface SearchResultsSkeletonProps {
  /** Number of skeleton cards to show */
  count?: number;
  /** Display layout */
  layout?: 'list' | 'grid';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading skeleton for search results.
 */
export function SearchResultsSkeleton({
  count = 5,
  layout = 'list',
  className,
}: SearchResultsSkeletonProps) {
  const layoutClasses =
    layout === 'grid'
      ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
      : 'flex flex-col gap-4';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header skeleton */}
      <div className="h-5 w-48 animate-pulse rounded bg-muted" />

      {/* Results skeleton */}
      <div className={layoutClasses}>
        {Array.from({ length: count }).map((_, index) => (
          <PreprintCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

/**
 * Props for the SearchResultsWithSort component.
 */
export interface SearchResultsWithSortProps extends SearchResultsProps {
  /** Current sort option */
  sortBy?: 'relevance' | 'date' | 'views';
  /** Called when sort changes */
  onSortChange?: (sort: 'relevance' | 'date' | 'views') => void;
}

/**
 * Search results with sort controls.
 *
 * @example
 * ```tsx
 * <SearchResultsWithSort
 *   query={query}
 *   data={results}
 *   sortBy={currentSort}
 *   onSortChange={(s) => setSort(s)}
 * />
 * ```
 */
export function SearchResultsWithSort({
  sortBy = 'relevance',
  onSortChange,
  ...props
}: SearchResultsWithSortProps) {
  return (
    <div className="space-y-4">
      {/* Sort controls */}
      {props.data && props.data.hits.length > 0 && (
        <div className="flex items-center justify-between">
          <SearchResultsHeader total={props.data.total} query={props.query} />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange?.(e.target.value as typeof sortBy)}
              className="rounded-md border bg-background px-2 py-1 text-sm"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Date (newest)</option>
              <option value="views">Most viewed</option>
            </select>
          </div>
        </div>
      )}

      <SearchResults {...props} />
    </div>
  );
}
