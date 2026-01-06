/**
 * Paper search interface for importing plugins.
 *
 * @remarks
 * Provides a unified search interface for plugins that import papers from
 * external archives (LingBuzz, Semantics Archive, arXiv, etc.).
 *
 * Papers are indexed in Elasticsearch and searchable across all sources.
 *
 * @packageDocumentation
 * @public
 */

/**
 * External paper document for Elasticsearch indexing.
 *
 * @remarks
 * This structure represents a paper from an external archive in the search index.
 * Unlike ATProto preprints (which are user-owned), these are cached metadata
 * from external sources.
 *
 * @public
 */
export interface ExternalPaperDocument {
  /**
   * Unique identifier combining source and external ID.
   *
   * @remarks
   * Format: `{source}:{externalId}` (e.g., `lingbuzz:007123`)
   */
  readonly id: string;

  /**
   * Source archive identifier.
   *
   * @example 'lingbuzz', 'semantics-archive', 'arxiv'
   */
  readonly source: string;

  /**
   * External ID within the source archive.
   */
  readonly externalId: string;

  /**
   * Paper title.
   *
   * @remarks
   * Analyzed with standard analyzer for full-text search.
   */
  readonly title: string;

  /**
   * Author names.
   */
  readonly authors: readonly string[];

  /**
   * Paper abstract.
   *
   * @remarks
   * Analyzed with standard analyzer for full-text search.
   */
  readonly abstract?: string;

  /**
   * URL to the paper page.
   */
  readonly url: string;

  /**
   * URL to the PDF (if available).
   */
  readonly pdfUrl?: string;

  /**
   * Publication/posting date.
   */
  readonly publicationDate?: Date;

  /**
   * Categories or keywords.
   *
   * @remarks
   * Indexed as keyword field for faceted filtering.
   */
  readonly categories?: readonly string[];

  /**
   * DOI (if available).
   */
  readonly doi?: string;

  /**
   * When the paper was last indexed.
   */
  readonly indexedAt: Date;
}

/**
 * Search query for external papers.
 *
 * @public
 */
export interface ExternalPaperSearchQuery {
  /**
   * Query string for full-text search.
   *
   * @remarks
   * Searches across title, authors, and abstract.
   */
  readonly q: string;

  /**
   * Filter by source archives.
   */
  readonly sources?: readonly string[];

  /**
   * Filter by categories.
   */
  readonly categories?: readonly string[];

  /**
   * Filter by date range (from).
   */
  readonly dateFrom?: Date;

  /**
   * Filter by date range (to).
   */
  readonly dateTo?: Date;

  /**
   * Maximum number of results.
   *
   * @defaultValue 10
   */
  readonly limit?: number;

  /**
   * Offset for pagination.
   */
  readonly offset?: number;
}

/**
 * Search result for an external paper.
 *
 * @public
 */
export interface ExternalPaperSearchResult {
  /**
   * Paper document.
   */
  readonly paper: ExternalPaperDocument;

  /**
   * Relevance score (higher is better).
   */
  readonly score: number;

  /**
   * Highlighted snippets.
   */
  readonly highlight?: {
    readonly title?: readonly string[];
    readonly abstract?: readonly string[];
  };
}

/**
 * Search results for external papers.
 *
 * @public
 */
export interface ExternalPaperSearchResults {
  /**
   * Matching papers.
   */
  readonly hits: readonly ExternalPaperSearchResult[];

  /**
   * Total number of matches.
   */
  readonly total: number;

  /**
   * Query execution time in milliseconds.
   */
  readonly took: number;
}

/**
 * Interface for indexing and searching external papers.
 *
 * @remarks
 * Implemented by an Elasticsearch-backed service that indexes papers
 * from various external archives.
 *
 * @public
 */
export interface IExternalPaperSearch {
  /**
   * Indexes an external paper.
   *
   * @param paper - Paper document to index
   * @returns Promise resolving when indexed
   *
   * @example
   * ```typescript
   * await paperSearch.indexPaper({
   *   id: 'lingbuzz:007123',
   *   source: 'lingbuzz',
   *   externalId: '007123',
   *   title: 'A Study of Syntax',
   *   authors: ['Jane Doe'],
   *   abstract: 'This paper explores...',
   *   url: 'https://lingbuzz.net/lingbuzz/007123',
   *   indexedAt: new Date(),
   * });
   * ```
   */
  indexPaper(paper: ExternalPaperDocument): Promise<void>;

  /**
   * Indexes multiple papers in bulk.
   *
   * @param papers - Papers to index
   * @returns Promise resolving when all indexed
   *
   * @remarks
   * More efficient than indexing papers individually.
   */
  bulkIndexPapers(papers: readonly ExternalPaperDocument[]): Promise<void>;

  /**
   * Searches for papers.
   *
   * @param query - Search query
   * @returns Search results
   */
  search(query: ExternalPaperSearchQuery): Promise<ExternalPaperSearchResults>;

  /**
   * Gets a paper by ID.
   *
   * @param id - Paper ID (format: `{source}:{externalId}`)
   * @returns Paper document or null if not found
   */
  getPaper(id: string): Promise<ExternalPaperDocument | null>;

  /**
   * Deletes a paper from the index.
   *
   * @param id - Paper ID
   * @returns Promise resolving when deleted
   */
  deletePaper(id: string): Promise<void>;

  /**
   * Deletes all papers from a specific source.
   *
   * @param source - Source archive identifier
   * @returns Number of papers deleted
   */
  deleteBySource(source: string): Promise<number>;
}

/**
 * Creates a paper document ID from source and external ID.
 *
 * @param source - Source archive identifier
 * @param externalId - External ID within the source
 * @returns Combined document ID
 *
 * @example
 * ```typescript
 * const id = createPaperId('lingbuzz', '007123');
 * // Returns: 'lingbuzz:007123'
 * ```
 *
 * @public
 */
export function createPaperId(source: string, externalId: string): string {
  return `${source}:${externalId}`;
}

/**
 * Parses a paper document ID into source and external ID.
 *
 * @param id - Combined document ID
 * @returns Object with source and externalId, or null if invalid
 *
 * @example
 * ```typescript
 * const parsed = parsePaperId('lingbuzz:007123');
 * // Returns: { source: 'lingbuzz', externalId: '007123' }
 * ```
 *
 * @public
 */
export function parsePaperId(id: string): { source: string; externalId: string } | null {
  const colonIndex = id.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }
  return {
    source: id.substring(0, colonIndex),
    externalId: id.substring(colonIndex + 1),
  };
}
