'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import {
  SearchInput,
  SearchResultsWithSort,
  SearchFiltersPanel,
  SearchPagination,
  ActiveFilters,
  SearchInitial,
  type SearchFilters,
} from '@/components/search';
import { useSearch } from '@/lib/hooks/use-search';

/** Sort options for search results */
type SortOption = 'relevance' | 'date' | 'views';

/**
 * Props for the SearchPageContent component.
 */
export interface SearchPageContentProps {
  /** Initial search query from URL */
  initialQuery?: string;
  /** Initial filters from URL */
  initialFilters?: SearchFilters;
  /** Initial sort option from URL */
  initialSort?: SortOption;
}

/**
 * Client-side search page content with interactive state.
 *
 * @remarks
 * Manages search query, filters, and results with URL synchronization.
 * Uses TanStack Query for data fetching with caching.
 *
 * @param props - Component props
 * @returns React element with search interface
 */
export function SearchPageContent({
  initialQuery = '',
  initialFilters = {},
  initialSort = 'relevance',
}: SearchPageContentProps) {
  const router = useRouter();

  // Local state for immediate UI feedback
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [sortBy, setSortBy] = useState<SortOption>(initialSort);

  // Fetch search results
  const {
    data: searchResults,
    isLoading,
    error,
    refetch,
  } = useSearch(query, {
    ...filters,
    limit: 20,
  });

  // Update URL when search changes
  const updateUrl = useCallback(
    (newQuery: string, newFilters: SearchFilters, newSort: SortOption = sortBy) => {
      const params = new URLSearchParams();
      if (newQuery) params.set('q', newQuery);
      if (newFilters.field) params.set('field', newFilters.field);
      if (newFilters.author) params.set('author', newFilters.author);
      if (newFilters.dateFrom) params.set('dateFrom', newFilters.dateFrom);
      if (newFilters.dateTo) params.set('dateTo', newFilters.dateTo);
      if (newSort !== 'relevance') params.set('sort', newSort);

      router.push(`/search?${params.toString()}`, { scroll: false });
    },
    [router, sortBy]
  );

  // Handle search submission
  const handleSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      updateUrl(newQuery, filters);
    },
    [filters, updateUrl]
  );

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (newFilters: SearchFilters) => {
      setFilters(newFilters);
      updateUrl(query, newFilters);
    },
    [query, updateUrl]
  );

  // Handle removing a single filter
  const handleRemoveFilter = useCallback(
    (key: keyof SearchFilters) => {
      const newFilters = { ...filters };
      delete newFilters[key];
      handleFiltersChange(newFilters);
    },
    [filters, handleFiltersChange]
  );

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    handleFiltersChange({});
  }, [handleFiltersChange]);

  // Handle sort changes
  const handleSortChange = useCallback(
    (newSort: SortOption) => {
      setSortBy(newSort);
      updateUrl(query, filters, newSort);
    },
    [query, filters, updateUrl]
  );

  // Check if any filters are active
  const hasActiveFilters = useMemo(
    () =>
      Object.values(filters).some(
        (v) => v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true)
      ),
    [filters]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Sidebar with filters */}
      <aside className="hidden lg:block">
        <SearchFiltersPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          collapsible={false}
        />
      </aside>

      {/* Main content */}
      <div className="space-y-6">
        {/* Search input */}
        <SearchInput
          defaultValue={query}
          onSearch={handleSearch}
          placeholder="Search by title, abstract, author, or keywords..."
          size="lg"
        />

        {/* Active filters (mobile) */}
        <div className="lg:hidden">
          <SearchFiltersPanel
            filters={filters}
            onFiltersChange={handleFiltersChange}
            collapsible
            defaultCollapsed
          />
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <ActiveFilters
            filters={filters}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearFilters}
          />
        )}

        {/* Results or initial state */}
        {query ? (
          <>
            <SearchResultsWithSort
              query={query}
              data={searchResults}
              isLoading={isLoading}
              error={error}
              onRetry={refetch}
              onClearFilters={handleClearFilters}
              hasFilters={hasActiveFilters}
              sortBy={sortBy}
              onSortChange={handleSortChange}
            />

            {/* Pagination */}
            {searchResults && (
              <SearchPagination
                hasMore={searchResults.hasMore}
                cursor={searchResults.cursor}
                total={searchResults.total}
                isLoading={isLoading}
              />
            )}
          </>
        ) : (
          <SearchInitial
            suggestions={['machine learning', 'climate change', 'quantum computing', 'CRISPR']}
            onSuggestionClick={handleSearch}
          />
        )}
      </div>
    </div>
  );
}
