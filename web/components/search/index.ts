/**
 * Search components barrel export.
 *
 * @remarks
 * This module exports all search-related components for building
 * the search interface including input, filters, results, and pagination.
 *
 * @example
 * ```tsx
 * import {
 *   SearchInput,
 *   SearchResults,
 *   SearchFiltersPanel,
 *   SearchPagination,
 * } from '@/components/search';
 * ```
 */

// Search input
export { SearchInput, SearchInputWithParams, InlineSearch } from './search-input';
export type {
  SearchInputProps,
  SearchInputWithParamsProps,
  InlineSearchProps,
} from './search-input';

// Autocomplete
export { SearchAutocomplete, RecentSearches } from './search-autocomplete';
export type {
  SearchAutocompleteProps,
  RecentSearchesProps,
  AutocompleteSuggestion,
  SuggestionType,
} from './search-autocomplete';

// Filters
export { SearchFiltersPanel, ActiveFilters } from './search-filters';
export type { SearchFiltersPanelProps, ActiveFiltersProps, SearchFilters } from './search-filters';

// Results
export {
  SearchResults,
  SearchResultsHeader,
  SearchResultsSkeleton,
  SearchResultsWithSort,
} from './search-results';
export type {
  SearchResultsProps,
  SearchResultsHeaderProps,
  SearchResultsSkeletonProps,
  SearchResultsWithSortProps,
} from './search-results';

// Highlights
export { SearchHighlight, HighlightedSnippet } from './search-highlight';
export type { SearchHighlightProps, HighlightedSnippetProps } from './search-highlight';

// Empty/error states
export { SearchEmpty, SearchError, SearchInitial } from './search-empty';
export type { SearchEmptyProps, SearchErrorProps, SearchInitialProps } from './search-empty';

// Pagination
export { SearchPagination, InfiniteScrollTrigger, PageNumbers } from './search-pagination';
export type {
  SearchPaginationProps,
  InfiniteScrollTriggerProps,
  PageNumbersProps,
} from './search-pagination';

// Facets
export { FacetChip, FacetChipList } from './facet-chip';
export type { FacetChipProps, FacetChipListProps } from './facet-chip';

export { FacetPanel, FacetPanelSkeleton } from './facet-panel';
export type { FacetPanelProps, FacetPanelSkeletonProps } from './facet-panel';

export { FacetSelector } from './facet-selector';
export type { FacetSelectorProps } from './facet-selector';

// Eprint search autocomplete (for claiming workflow)
export { EprintSearchAutocomplete } from './eprint-search-autocomplete';
export type { EprintSearchAutocompleteProps } from './eprint-search-autocomplete';
