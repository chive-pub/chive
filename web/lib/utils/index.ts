/**
 * Utility functions for Chive frontend.
 *
 * @remarks
 * Re-exports all utility modules for convenient imports.
 *
 * @packageDocumentation
 */

// Date formatting utilities
export { formatDate, formatDateRange, formatISODate, type FormatDateOptions } from './format-date';

// Number formatting utilities
export {
  formatCompactNumber,
  formatNumber,
  formatPercentage,
  formatMetric,
  formatFileSize,
  formatHIndex,
} from './format-number';

// AT Protocol utilities
export {
  parseAtUri,
  buildAtUri,
  isValidAtUri,
  extractDid,
  extractCollection,
  extractRkey,
  encodeAtUriForPath,
  decodeAtUriFromPath,
  buildBlobUrl,
  isValidDid,
  shortenDid,
  type ParsedAtUri,
} from './atproto';

// Facet utilities
export {
  PMEST_FACETS,
  FAST_FACETS,
  ALL_FACETS,
  PMEST_DIMENSIONS,
  FAST_DIMENSIONS,
  ALL_DIMENSIONS,
  isPMESTDimension,
  isFASTDimension,
  getFacetConfig,
  countActiveFilters,
  hasActiveFilters,
  filtersToSearchParams,
  searchParamsToFilters,
  type PMESTDimension,
  type FASTDimension,
  type FacetDimension,
  type FacetConfig,
  type FacetValue,
  type FacetCounts,
  type FacetFilters,
} from './facets';
