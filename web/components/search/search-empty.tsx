import { Search, FileQuestion, FilterX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for the SearchEmpty component.
 */
export interface SearchEmptyProps {
  /** The search query that returned no results */
  query?: string;
  /** Whether filters are applied */
  hasFilters?: boolean;
  /** Callback to clear filters */
  onClearFilters?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Empty state displayed when search returns no results.
 *
 * @remarks
 * Server component that displays contextual messages based on
 * whether a query was entered and if filters are applied.
 *
 * @example
 * ```tsx
 * <SearchEmpty
 *   query="nonexistent topic"
 *   hasFilters
 *   onClearFilters={() => clearFilters()}
 * />
 * ```
 *
 * @param props - Component props
 * @returns React element displaying the empty state
 */
export function SearchEmpty({
  query,
  hasFilters = false,
  onClearFilters,
  className,
}: SearchEmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center',
        className
      )}
    >
      <div className="mb-4 rounded-full bg-muted p-4">
        {query ? (
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        ) : (
          <Search className="h-8 w-8 text-muted-foreground" />
        )}
      </div>

      {query ? (
        <>
          <h3 className="mb-2 text-lg font-semibold">No results found</h3>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            We couldn&apos;t find any eprints matching &ldquo;{query}&rdquo;.
            {hasFilters && ' Try adjusting your filters or search terms.'}
          </p>
        </>
      ) : (
        <>
          <h3 className="mb-2 text-lg font-semibold">Start your search</h3>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            Enter keywords, author names, or DOIs to find eprints.
          </p>
        </>
      )}

      {hasFilters && onClearFilters && (
        <Button variant="outline" onClick={onClearFilters} className="gap-2">
          <FilterX className="h-4 w-4" />
          Clear filters
        </Button>
      )}

      {query && (
        <div className="mt-6 text-sm text-muted-foreground">
          <p className="font-medium">Search tips:</p>
          <ul className="mt-2 list-inside list-disc text-left">
            <li>Check your spelling</li>
            <li>Try more general keywords</li>
            <li>Use fewer filters</li>
            <li>Search by author name or field</li>
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Props for the SearchError component.
 */
export interface SearchErrorProps {
  /** Error message to display */
  message?: string;
  /** Callback to retry the search */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Error state displayed when search fails.
 *
 * @example
 * ```tsx
 * <SearchError
 *   message="Network error. Please try again."
 *   onRetry={() => refetch()}
 * />
 * ```
 */
export function SearchError({
  message = 'Something went wrong with your search.',
  onRetry,
  className,
}: SearchErrorProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 py-12 text-center',
        className
      )}
    >
      <div className="mb-4 rounded-full bg-destructive/10 p-3">
        <FileQuestion className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="mb-2 font-semibold text-destructive">Search failed</h3>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Props for the SearchInitial component.
 */
export interface SearchInitialProps {
  /** Suggested searches to display */
  suggestions?: string[];
  /** Callback when a suggestion is clicked */
  onSuggestionClick?: (suggestion: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Initial state before user enters a search query.
 *
 * @example
 * ```tsx
 * <SearchInitial
 *   suggestions={['machine learning', 'climate change', 'CRISPR']}
 *   onSuggestionClick={(s) => setQuery(s)}
 * />
 * ```
 */
export function SearchInitial({
  suggestions = [],
  onSuggestionClick,
  className,
}: SearchInitialProps) {
  return (
    <div className={cn('flex flex-col items-center py-12 text-center', className)}>
      <div className="mb-4 rounded-full bg-primary/10 p-4">
        <Search className="h-8 w-8 text-primary" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">Search eprints</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Discover research across all fields of study. Search by title, abstract, author, or
        keywords.
      </p>

      {suggestions.length > 0 && (
        <div className="text-sm">
          <p className="mb-2 text-muted-foreground">Popular searches:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => onSuggestionClick?.(suggestion)}
                className="text-xs"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
