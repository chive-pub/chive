/**
 * Search service orchestrating Elasticsearch operations.
 *
 * @remarks
 * Application service coordinating full-text search via Elasticsearch.
 * Indexes preprint metadata and provides search/autocomplete capabilities.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  ISearchEngine,
  IndexablePreprintDocument,
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
 * // Index preprint for search
 * await service.indexPreprintForSearch(preprintDoc);
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
   * Indexes preprint for full-text search.
   *
   * @param preprint - Indexable preprint document
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexPreprintForSearch(
    preprint: IndexablePreprintDocument
  ): Promise<Result<void, DatabaseError>> {
    try {
      await this.searchEngine.indexPreprint(preprint);
      this.logger.debug('Indexed preprint for search', { uri: preprint.uri });
      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError('INDEX', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Searches preprints.
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
   * Removes preprint from search index.
   *
   * @param uri - Preprint URI
   * @returns Result indicating success or failure
   *
   * @public
   */
  async removeFromSearch(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      await this.searchEngine.deleteDocument(uri);
      this.logger.debug('Removed preprint from search', { uri });
      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError('INDEX', error instanceof Error ? error.message : String(error)),
      };
    }
  }
}
