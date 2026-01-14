/**
 * Search engine interface for Elasticsearch.
 *
 * @remarks
 * This interface provides full-text search capabilities across indexed eprints.
 * It complements IStorageBackend by enabling complex queries, faceted search,
 * and autocomplete.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, DID } from '../atproto.js';

/**
 * Indexable eprint document for Elasticsearch.
 *
 * @remarks
 * This is the document structure stored in Elasticsearch for searching.
 * It includes both structured metadata and extracted full-text content.
 *
 * @public
 */
export interface IndexableEprintDocument {
  /**
   * AT URI of the eprint.
   */
  readonly uri: AtUri;

  /**
   * Author's DID.
   */
  readonly author: DID;

  /**
   * Author's display name.
   *
   * @remarks
   * Denormalized for efficient searching by author name.
   */
  readonly authorName: string;

  /**
   * Eprint title.
   *
   * @remarks
   * Analyzed with standard analyzer for full-text search.
   */
  readonly title: string;

  /**
   * Eprint abstract.
   *
   * @remarks
   * Analyzed with standard analyzer for full-text search.
   */
  readonly abstract: string;

  /**
   * Full text extracted from PDF.
   *
   * @remarks
   * Optional. Extracted using Apache Tika via Elasticsearch ingest pipeline.
   * Large field, stored separately from primary document.
   */
  readonly fullText?: string;

  /**
   * Keywords (author-provided).
   *
   * @remarks
   * Indexed as keyword field for exact matching and aggregations.
   */
  readonly keywords: readonly string[];

  /**
   * Subject classifications (e.g., field nodes).
   *
   * @remarks
   * Indexed as keyword field for faceted filtering.
   */
  readonly subjects: readonly string[];

  /**
   * Eprint creation timestamp.
   */
  readonly createdAt: Date;

  /**
   * Indexing timestamp.
   */
  readonly indexedAt: Date;
}

/**
 * Search query parameters.
 *
 * @public
 */
export interface SearchQuery {
  /**
   * Query string.
   *
   * @remarks
   * Supports Elasticsearch query string syntax:
   * - Simple: "neural networks"
   * - Field-specific: "title:neural AND abstract:biology"
   * - Wildcards: "neuro*"
   * - Phrases: "\"neural networks\""
   */
  readonly q: string;

  /**
   * Filters to apply.
   *
   * @remarks
   * Filters are applied as boolean filters (not affecting scoring).
   */
  readonly filters?: {
    /**
     * Filter by author DID.
     */
    readonly author?: DID;

    /**
     * Filter by subject classifications.
     */
    readonly subjects?: readonly string[];

    /**
     * Filter by creation date range (from).
     */
    readonly dateFrom?: Date;

    /**
     * Filter by creation date range (to).
     */
    readonly dateTo?: Date;
  };

  /**
   * Maximum number of results to return.
   *
   * @remarks
   * Default: 10. Maximum: 100.
   */
  readonly limit?: number;

  /**
   * Offset for pagination.
   *
   * @remarks
   * For deep pagination, use search_after instead.
   */
  readonly offset?: number;
}

/**
 * Search results.
 *
 * @public
 */
export interface SearchResults {
  /**
   * Search hits (matching documents).
   */
  readonly hits: readonly {
    /**
     * AT URI of the eprint.
     */
    readonly uri: AtUri;

    /**
     * Relevance score (higher is more relevant).
     */
    readonly score: number;

    /**
     * Highlighted snippets (if requested).
     */
    readonly highlight?: {
      /**
       * Highlighted title snippets.
       */
      readonly title?: readonly string[];

      /**
       * Highlighted abstract snippets.
       */
      readonly abstract?: readonly string[];
    };
  }[];

  /**
   * Total number of matching documents.
   */
  readonly total: number;

  /**
   * Query execution time in milliseconds.
   */
  readonly took: number;
}

/**
 * Faceted search query with aggregations.
 *
 * @public
 */
export interface FacetedSearchQuery extends SearchQuery {
  /**
   * Facet dimensions to aggregate.
   *
   * @remarks
   * Common facets:
   * - "subjects" - Count by subject classification
   * - "author" - Count by author
   * - "year" - Count by publication year
   */
  readonly facets: readonly string[];
}

/**
 * Faceted search results with aggregations.
 *
 * @public
 */
export interface FacetedSearchResults extends SearchResults {
  /**
   * Facet aggregations.
   *
   * @remarks
   * Maps facet dimension to value counts.
   *
   * Example:
   * ```
   * {
   *   "subjects": [
   *     { value: "Computer Science", count: 150 },
   *     { value: "Biology", count: 120 }
   *   ]
   * }
   * ```
   */
  readonly facets: Record<string, readonly { readonly value: string; readonly count: number }[]>;
}

/**
 * Search engine interface for Elasticsearch.
 *
 * @remarks
 * Provides full-text search, faceted search, and autocomplete for eprints.
 *
 * Implementation notes:
 * - Uses Elasticsearch 8+
 * - Indices prefixed with `chive-eprints-`
 * - Ingest pipeline for PDF text extraction
 * - Custom analyzers for academic text
 *
 * @public
 */
export interface ISearchEngine {
  /**
   * Indexes an eprint document.
   *
   * @param eprint - Eprint to index
   * @returns Promise resolving when indexed
   *
   * @remarks
   * Indexes or updates the eprint in Elasticsearch. If full-text extraction
   * is enabled, triggers PDF processing via ingest pipeline.
   *
   * @example
   * ```typescript
   * await searchEngine.indexEprint({
   *   uri: toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!,
   *   author: toDID('did:plc:abc')!,
   *   authorName: 'Dr. Jane Smith',
   *   title: 'Neural Networks in Biology',
   *   abstract: 'This paper explores...',
   *   keywords: ['neural networks', 'biology'],
   *   subjects: ['Computer Science', 'Biology'],
   *   createdAt: new Date(),
   *   indexedAt: new Date()
   * });
   * ```
   *
   * @public
   */
  indexEprint(eprint: IndexableEprintDocument): Promise<void>;

  /**
   * Searches eprints.
   *
   * @param query - Search query
   * @returns Search results
   *
   * @remarks
   * Performs full-text search across title, abstract, and full-text (if available).
   * Returns results sorted by relevance score.
   *
   * @example
   * ```typescript
   * const results = await searchEngine.search({
   *   q: 'neural networks biology',
   *   filters: {
   *     subjects: ['Computer Science'],
   *     dateFrom: new Date('2024-01-01')
   *   },
   *   limit: 20
   * });
   *
   * results.hits.forEach(hit => {
   *   console.log(`${hit.uri} (score: ${hit.score})`);
   * });
   * ```
   *
   * @public
   */
  search(query: SearchQuery): Promise<SearchResults>;

  /**
   * Performs faceted search with aggregations.
   *
   * @param query - Faceted search query
   * @returns Results with facet counts
   *
   * @remarks
   * Extends regular search with aggregation results for each facet dimension.
   * Use for browse interfaces with faceted navigation.
   *
   * @example
   * ```typescript
   * const results = await searchEngine.facetedSearch({
   *   q: 'neural networks',
   *   facets: ['subjects', 'year'],
   *   limit: 20
   * });
   *
   * console.log('Subjects:', results.facets.subjects);
   * // [{ value: "Computer Science", count: 150 }, ...]
   * ```
   *
   * @public
   */
  facetedSearch(query: FacetedSearchQuery): Promise<FacetedSearchResults>;

  /**
   * Provides autocomplete suggestions.
   *
   * @param prefix - Partial query string
   * @param limit - Maximum number of suggestions
   * @returns Suggested completions
   *
   * @remarks
   * Uses Elasticsearch completion suggester for fast autocomplete.
   * Suggestions are based on indexed titles and keywords.
   *
   * @example
   * ```typescript
   * const suggestions = await searchEngine.autocomplete('neura', 5);
   * // ['neural', 'neural networks', 'neuromorphic', ...]
   * ```
   *
   * @public
   */
  autocomplete(prefix: string, limit?: number): Promise<readonly string[]>;

  /**
   * Removes a document from the index.
   *
   * @param uri - Document URI
   * @returns Promise resolving when deleted
   *
   * @remarks
   * Use when an eprint is deleted from the user's PDS.
   *
   * @example
   * ```typescript
   * await searchEngine.deleteDocument(
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!
   * );
   * ```
   *
   * @public
   */
  deleteDocument(uri: AtUri): Promise<void>;
}
