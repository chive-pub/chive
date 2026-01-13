/**
 * Autocomplete service for Elasticsearch completion suggester.
 *
 * @remarks
 * Provides type-ahead completion suggestions using Elasticsearch's
 * completion suggester with:
 * - Fuzzy matching (1 character difference allowed)
 * - Prefix matching (requires 2 character minimum)
 * - Duplicate skipping
 * - Configurable result limits
 *
 * @packageDocumentation
 */

import type { Client, estypes } from '@elastic/elasticsearch';
import { errors } from '@elastic/elasticsearch';

/**
 * Autocomplete error.
 *
 * @public
 */
export class AutocompleteError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AutocompleteError';
  }
}

/**
 * Autocomplete service configuration.
 *
 * @public
 */
export interface AutocompleteServiceConfig {
  /**
   * Index name or alias.
   *
   * @defaultValue 'eprints'
   */
  readonly indexName?: string;

  /**
   * Completion suggester field.
   *
   * @remarks
   * Must be a field with type 'completion' in the index mapping.
   *
   * @defaultValue 'title.suggest'
   */
  readonly suggesterField?: string;

  /**
   * Fuzzy matching fuzziness level.
   *
   * @remarks
   * - 0: No fuzzy matching
   * - 1: Allow 1 character difference
   * - 2: Allow 2 character differences
   *
   * @defaultValue 1
   */
  readonly fuzziness?: 0 | 1 | 2;

  /**
   * Minimum prefix length for fuzzy matching.
   *
   * @remarks
   * First N characters must match exactly before fuzzy matching applies.
   * Higher values improve performance but reduce recall.
   *
   * @defaultValue 2
   */
  readonly prefixLength?: number;

  /**
   * Default result limit.
   *
   * @defaultValue 5
   */
  readonly defaultLimit?: number;

  /**
   * Maximum result limit.
   *
   * @defaultValue 20
   */
  readonly maxLimit?: number;

  /**
   * Skip duplicate suggestions.
   *
   * @defaultValue true
   */
  readonly skipDuplicates?: boolean;
}

/**
 * Default autocomplete configuration.
 *
 * @public
 */
export const DEFAULT_AUTOCOMPLETE_CONFIG: Required<AutocompleteServiceConfig> = {
  indexName: 'eprints',
  suggesterField: 'title.suggest',
  fuzziness: 1,
  prefixLength: 2,
  defaultLimit: 5,
  maxLimit: 20,
  skipDuplicates: true,
};

/**
 * Autocomplete suggestion result.
 *
 * @public
 */
export interface AutocompleteSuggestion {
  /**
   * Suggested text.
   */
  readonly text: string;

  /**
   * Suggestion score (relevance).
   */
  readonly score: number;
}

/**
 * Provides autocomplete suggestions using Elasticsearch completion suggester.
 *
 * @remarks
 * Uses Elasticsearch's highly optimized completion suggester for fast
 * type-ahead search. The suggester is built on FSTs (Finite State Transducers)
 * for extremely fast prefix matching.
 *
 * **Features:**
 * - Sub-millisecond response times
 * - Fuzzy matching for typo tolerance
 * - Prefix length enforcement for performance
 * - Duplicate removal
 * - Configurable result limits
 *
 * **Requirements:**
 * - Index must have a field with type 'completion'
 * - Field must be populated at index time
 *
 * @example
 * ```typescript
 * const service = new AutocompleteService(client);
 * const suggestions = await service.suggest('machine learn');
 * // Returns: ['machine learning', 'machine learning theory', ...]
 * ```
 *
 * @public
 */
export class AutocompleteService {
  private readonly client: Client;
  private readonly config: Required<AutocompleteServiceConfig>;

  constructor(client: Client, config: AutocompleteServiceConfig = {}) {
    this.client = client;
    this.config = {
      indexName: config.indexName ?? DEFAULT_AUTOCOMPLETE_CONFIG.indexName,
      suggesterField: config.suggesterField ?? DEFAULT_AUTOCOMPLETE_CONFIG.suggesterField,
      fuzziness: config.fuzziness ?? DEFAULT_AUTOCOMPLETE_CONFIG.fuzziness,
      prefixLength: config.prefixLength ?? DEFAULT_AUTOCOMPLETE_CONFIG.prefixLength,
      defaultLimit: config.defaultLimit ?? DEFAULT_AUTOCOMPLETE_CONFIG.defaultLimit,
      maxLimit: config.maxLimit ?? DEFAULT_AUTOCOMPLETE_CONFIG.maxLimit,
      skipDuplicates: config.skipDuplicates ?? DEFAULT_AUTOCOMPLETE_CONFIG.skipDuplicates,
    };
  }

  /**
   * Generates autocomplete suggestions.
   *
   * @param prefix - Partial query string
   * @param limit - Maximum number of suggestions
   * @returns Array of suggestions
   *
   * @throws {AutocompleteError} On request failure
   *
   * @remarks
   * Returns empty array if:
   * - Prefix is shorter than configured prefix length
   * - No matching documents found
   * - Elasticsearch request fails (error thrown)
   *
   * @example
   * ```typescript
   * const suggestions = await service.suggest('neural net', 10);
   * // Returns up to 10 suggestions starting with 'neural net'
   * ```
   *
   * @public
   */
  async suggest(prefix: string, limit?: number): Promise<readonly string[]> {
    try {
      const normalizedLimit = this.normalizeLimit(limit);

      if (!this.isValidPrefix(prefix)) {
        return [];
      }

      const response = await this.client.search({
        index: this.config.indexName,
        suggest: {
          title_suggest: {
            text: prefix,
            completion: {
              field: this.config.suggesterField,
              size: normalizedLimit,
              skip_duplicates: this.config.skipDuplicates,
              fuzzy: {
                fuzziness: this.config.fuzziness,
                prefix_length: this.config.prefixLength,
              },
            },
          },
        },
        size: 0,
      });

      return this.parseSuggestions(response);
    } catch (error) {
      if (error instanceof errors.ResponseError) {
        throw new AutocompleteError(`Autocomplete request failed: ${error.message}`, error);
      }

      throw new AutocompleteError(
        'Unexpected error during autocomplete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generates detailed autocomplete suggestions with scores.
   *
   * @param prefix - Partial query string
   * @param limit - Maximum number of suggestions
   * @returns Array of suggestions with scores
   *
   * @throws {AutocompleteError} On request failure
   *
   * @remarks
   * Returns empty array if prefix is invalid or no matches found.
   * Scores represent relevance (higher is better).
   *
   * @public
   */
  async suggestWithScores(
    prefix: string,
    limit?: number
  ): Promise<readonly AutocompleteSuggestion[]> {
    try {
      const normalizedLimit = this.normalizeLimit(limit);

      if (!this.isValidPrefix(prefix)) {
        return [];
      }

      const response = await this.client.search({
        index: this.config.indexName,
        suggest: {
          title_suggest: {
            text: prefix,
            completion: {
              field: this.config.suggesterField,
              size: normalizedLimit,
              skip_duplicates: this.config.skipDuplicates,
              fuzzy: {
                fuzziness: this.config.fuzziness,
                prefix_length: this.config.prefixLength,
              },
            },
          },
        },
        size: 0,
      });

      return this.parseSuggestionsWithScores(response);
    } catch (error) {
      if (error instanceof errors.ResponseError) {
        throw new AutocompleteError(`Autocomplete request failed: ${error.message}`, error);
      }

      throw new AutocompleteError(
        'Unexpected error during autocomplete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validates prefix meets minimum length requirement.
   *
   * @param prefix - Query prefix
   * @returns True if valid
   */
  private isValidPrefix(prefix: string): boolean {
    const trimmed = prefix.trim();
    return trimmed.length >= this.config.prefixLength;
  }

  /**
   * Normalizes limit to valid range.
   *
   * @param limit - Requested limit
   * @returns Normalized limit
   */
  private normalizeLimit(limit: number | undefined): number {
    const requestedLimit = limit ?? this.config.defaultLimit;
    return Math.min(Math.max(1, requestedLimit), this.config.maxLimit);
  }

  /**
   * Parses suggestion text from Elasticsearch response.
   *
   * @param response - Elasticsearch response
   * @returns Array of suggestion texts
   */
  private parseSuggestions(response: estypes.SearchResponse): readonly string[] {
    const suggestions = response.suggest?.title_suggest;
    if (!suggestions || suggestions.length === 0) {
      return [];
    }

    const results: string[] = [];

    for (const suggestion of suggestions) {
      if ('options' in suggestion && Array.isArray(suggestion.options)) {
        for (const option of suggestion.options) {
          if ('text' in option && typeof option.text === 'string') {
            results.push(option.text);
          }
        }
      }
    }

    return results;
  }

  /**
   * Parses suggestions with scores from Elasticsearch response.
   *
   * @param response - Elasticsearch response
   * @returns Array of suggestions with scores
   */
  private parseSuggestionsWithScores(
    response: estypes.SearchResponse
  ): readonly AutocompleteSuggestion[] {
    const suggestions = response.suggest?.title_suggest;
    if (!suggestions || suggestions.length === 0) {
      return [];
    }

    const results: AutocompleteSuggestion[] = [];

    for (const suggestion of suggestions) {
      if ('options' in suggestion && Array.isArray(suggestion.options)) {
        for (const option of suggestion.options) {
          if ('text' in option && '_score' in option) {
            results.push({
              text: String(option.text),
              score: typeof option._score === 'number' ? option._score : 0,
            });
          }
        }
      }
    }

    return results;
  }
}
