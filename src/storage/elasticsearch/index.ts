/**
 * Elasticsearch storage adapter for Chive.
 *
 * @remarks
 * Complete Elasticsearch integration with:
 * - Full-text search with BM25 ranking
 * - 10-dimensional faceted search (PMEST + FAST entities)
 * - Autocomplete with completion suggester
 * - Bulk indexing with automatic chunking
 * - Query result caching
 * - Connection management with retry logic
 * - ATProto compliance (BlobRef metadata only, PDS tracking)
 *
 * @packageDocumentation
 */

// Core adapter
export {
  ElasticsearchAdapter,
  SearchError,
  IndexError,
  type ElasticsearchAdapterConfig,
} from './adapter.js';

// Document mapping
export {
  mapEprintToDocument,
  type IndexableEprintDocument,
  type AuthorDocument,
  type FacetDocument,
  type DocumentMetadata,
  type BlobRefDocument,
  type EnrichmentData,
} from './document-mapper.js';

// Connection management
export {
  ElasticsearchConnectionPool,
  ElasticsearchConnectionError,
  ElasticsearchTimeoutError,
  ElasticsearchClusterError,
  getElasticsearchConfigFromEnv,
  createElasticsearchConnectionPool,
  type ElasticsearchConnectionConfig,
  type ClusterHealthStatus,
  type HealthCheckResult,
  type RetryOptions,
} from './connection.js';

// Search query building
export {
  SearchQueryBuilder,
  DEFAULT_FIELD_BOOSTS,
  type FieldBoostConfig,
  type SearchQueryBuilderConfig,
} from './search-query-builder.js';

// Faceted aggregations
export {
  FacetedAggregationsBuilder,
  DEFAULT_AGGREGATION_CONFIG,
  type FacetAggregationConfig,
} from './aggregations-builder.js';

// Autocomplete
export {
  AutocompleteService,
  AutocompleteError,
  DEFAULT_AUTOCOMPLETE_CONFIG,
  type AutocompleteServiceConfig,
  type AutocompleteSuggestion,
} from './autocomplete-service.js';

// Index management
export {
  IndexManager,
  IndexOperationError,
  BulkOperationError,
  DEFAULT_INDEX_MANAGER_CONFIG,
  type IndexManagerConfig,
  type BulkIndexResult,
  type BulkOperationFailure,
} from './index-manager.js';

// Query caching
export {
  QueryCache,
  DEFAULT_CACHE_CONFIG,
  type QueryCacheConfig,
  type CacheStatistics,
} from './query-cache.js';

// Index setup and lifecycle
export {
  setupElasticsearch,
  setupILMPolicy,
  setupIndexTemplate,
  setupIngestPipeline,
  bootstrapIndex,
  checkHealth,
  createElasticsearchClient,
  getElasticsearchConfig,
  type ElasticsearchConfig,
} from './setup.js';
