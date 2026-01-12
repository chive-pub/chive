/**
 * Search service orchestrating Elasticsearch operations.
 *
 * @remarks
 * Application service coordinating full-text search via Elasticsearch.
 * Indexes eprint metadata and provides search/autocomplete capabilities.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  ISearchEngine,
  IndexableEprintDocument,
  SearchQuery,
  SearchResults,
} from '../../types/interfaces/search.interface.js';
import type { Result } from '../../types/result.js';

/**
 * Search service configuration.
 *
 * @public
 */
export interface SearchServiceOptions {
  readonly search: ISearchEngine;
  readonly logger: ILogger;
}

/**
 * Search service implementation.
 *
 * @example
 * ```typescript
 * const service = new SearchService({ search, logger });
 *
 * // Index eprint for search
 * await service.indexEprintForSearch(eprintDoc);
 *
 * // Search
 * const results = await service.search({
 *   query: 'quantum computing',
 *   limit: 20
 * });
 * ```
 *
 * @public
 */
export class SearchService {
  private readonly searchEngine: ISearchEngine;
  private readonly logger: ILogger;

  constructor(options: SearchServiceOptions) {
    this.searchEngine = options.search;
    this.logger = options.logger;
  }

  /**
   * Indexes eprint for full-text search.
   *
   * @param eprint - Indexable eprint document
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexEprintForSearch(
    eprint: IndexableEprintDocument
  ): Promise<Result<void, DatabaseError>> {
    try {
      await this.searchEngine.indexEprint(eprint);
      this.logger.debug('Indexed eprint for search', { uri: eprint.uri });
      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError('INDEX', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Searches eprints.
   *
   * @param query - Search query
   * @returns Search results
   *
   * @public
   */
  async search(query: SearchQuery): Promise<SearchResults> {
    return this.searchEngine.search(query);
  }

  /**
   * Autocomplete suggestions.
   *
   * @param prefix - Query prefix
   * @param limit - Max suggestions
   * @returns Suggestion strings
   *
   * @remarks
   * Uses Elasticsearch completion suggester for fast, prefix-based suggestions.
   * Suggestions are derived from indexed titles and keywords.
   *
   * @example
   * ```typescript
   * const suggestions = await service.autocomplete('neura', 5);
   * // ['neural', 'neural networks', 'neuromorphic', ...]
   * ```
   *
   * @public
   */
  async autocomplete(prefix: string, limit = 10): Promise<readonly string[]> {
    return this.searchEngine.autocomplete(prefix, limit);
  }

  /**
   * Removes eprint from search index.
   *
   * @param uri - Eprint URI
   * @returns Result indicating success or failure
   *
   * @public
   */
  async removeFromSearch(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      await this.searchEngine.deleteDocument(uri);
      this.logger.debug('Removed eprint from search', { uri });
      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError('INDEX', error instanceof Error ? error.message : String(error)),
      };
    }
  }
}
