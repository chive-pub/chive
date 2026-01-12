/**
 * Ranking service interfaces for personalized search.
 *
 * @remarks
 * Defines abstractions for text scoring, category matching, and ranking
 * to enable dependency injection and future LTR model integration.
 *
 * @packageDocumentation
 * @public
 */

import type { LTRFeatureVector } from '../../services/search/relevance-logger.js';

// =============================================================================
// TEXT SCORER INTERFACE
// =============================================================================

/**
 * Text similarity scorer interface.
 *
 * @remarks
 * Abstracts text similarity computation to allow swapping algorithms
 * or using LTR models for relevance scoring.
 *
 * @public
 */
export interface ITextScorer {
  /**
   * Computes text similarity between query and target.
   *
   * @param query - User's search query
   * @param target - Text to compare against (title, abstract, etc.)
   * @returns Similarity score from 0 (no match) to 1 (exact match)
   */
  score(query: string, target: string): number;

  /**
   * Computes relevance across multiple fields with weights.
   *
   * @param query - User's search query
   * @param fields - Map of field names to text content
   * @param weights - Map of field names to boost weights
   * @returns Combined relevance score (0-1)
   */
  scoreMultiField(
    query: string,
    fields: Record<string, string | undefined>,
    weights: Record<string, number>
  ): number;
}

// =============================================================================
// CATEGORY MATCHER INTERFACE
// =============================================================================

/**
 * Category/field matching strategy interface.
 *
 * @remarks
 * Abstracts category matching to support different taxonomies
 * and cross-source category mappings.
 *
 * @public
 */
export interface ICategoryMatcher {
  /**
   * Computes overlap between item categories and user fields.
   *
   * @param itemCategories - Categories from the eprint
   * @param userFields - User's research fields/interests
   * @returns Match score from 0 (no overlap) to 1 (full match)
   */
  computeFieldScore(itemCategories: readonly string[], userFields: readonly string[]): number;

  /**
   * Normalizes a category to canonical form.
   *
   * @param category - Raw category string
   * @returns Normalized category identifier
   */
  normalizeCategory(category: string): string;

  /**
   * Gets related categories for query expansion.
   *
   * @param category - Source category
   * @returns Related categories (parent, siblings, aliases)
   */
  getRelatedCategories(category: string): readonly string[];

  /**
   * Checks if two categories are related.
   *
   * @param cat1 - First category
   * @param cat2 - Second category
   * @returns True if categories overlap or are related
   */
  categoriesOverlap(cat1: string, cat2: string): boolean;
}

// =============================================================================
// RANKABLE ITEM INTERFACE
// =============================================================================

/**
 * Base interface for items that can be ranked.
 *
 * @remarks
 * All items to be ranked must have at least a title.
 * Categories, authors, source, and publication date are optional
 * but improve ranking accuracy.
 *
 * @public
 */
export interface RankableItem {
  /**
   * Item title (required for text matching).
   */
  readonly title: string;

  /**
   * Categories or fields associated with the item.
   *
   * @remarks
   * Used for field relevance scoring. Can be:
   * - arXiv categories (e.g., "cs.AI", "physics.hep-th")
   * - Field names (e.g., "Computer Science", "Physics")
   * - Subject headings
   */
  readonly categories?: readonly string[];

  /**
   * Authors of the item.
   */
  readonly authors?: readonly { readonly name: string }[];

  /**
   * Abstract text for extended matching.
   */
  readonly abstract?: string;

  /**
   * Source identifier (e.g., "arxiv", "lingbuzz").
   */
  readonly source?: string;

  /**
   * Publication date.
   */
  readonly publicationDate?: Date;
}

/**
 * Result of ranking an item.
 *
 * @typeParam T - Type of the ranked item
 *
 * @public
 */
export interface RankedItem<T extends RankableItem> {
  /**
   * The original item.
   */
  readonly item: T;

  /**
   * Combined ranking score (0-1).
   *
   * @remarks
   * Higher scores indicate more relevant results.
   * Score is computed as: (fieldMatchScore * fieldWeight) + (textRelevanceScore * textWeight)
   */
  readonly score: number;

  /**
   * Field match score (0-1).
   *
   * @remarks
   * Measures how well the item's categories match the user's research fields.
   * 0 = no overlap, 1 = perfect match
   */
  readonly fieldMatchScore: number;

  /**
   * Text relevance score (0-1).
   *
   * @remarks
   * Measures how well the item matches the search query.
   * 0 = no match, 1 = exact title match
   */
  readonly textRelevanceScore: number;

  /**
   * LTR feature vector (for training data).
   */
  readonly features?: LTRFeatureVector;
}

// =============================================================================
// RANKING CONTEXT
// =============================================================================

/**
 * Context for ranking operations.
 *
 * @remarks
 * Provides user context and query for personalized ranking.
 * Either userDid or userFields should be provided for personalization.
 *
 * @public
 */
export interface RankingContext {
  /**
   * User DID for looking up fields from profile/claims.
   *
   * @remarks
   * If provided without userFields, the service will look up the user's
   * research fields from their profile or claimed papers.
   */
  readonly userDid?: string;

  /**
   * Explicit user fields override.
   *
   * @remarks
   * If provided, these fields are used instead of looking up from the database.
   * Useful for testing or when fields are already known.
   */
  readonly userFields?: readonly string[];

  /**
   * Search query for text relevance scoring.
   */
  readonly query?: string;

  /**
   * Session ID for relevance logging.
   */
  readonly sessionId?: string;
}

// =============================================================================
// RANKING SERVICE INTERFACE
// =============================================================================

/**
 * Ranking mode for score computation.
 *
 * @public
 */
export type RankingMode = 'heuristic' | 'ltr';

/**
 * Ranking service interface for dependency injection.
 *
 * @public
 */
export interface IRankingService {
  /**
   * Ranks items by relevance to user's research fields and query.
   *
   * @typeParam T - Type of items being ranked
   * @param items - Items to rank
   * @param context - Ranking context with user and query info
   * @returns Items with ranking scores, sorted by score descending
   */
  rank<T extends RankableItem>(
    items: readonly T[],
    context: RankingContext
  ): Promise<readonly RankedItem<T>[]>;

  /**
   * Gets user's research fields from profile or claimed papers.
   *
   * @param did - User DID
   * @returns Array of field/category strings
   */
  getUserFields(did: string): Promise<readonly string[]>;

  /**
   * Clears the user fields cache.
   */
  clearCache(): void;

  /**
   * Clears cache entry for a specific user.
   *
   * @param did - User DID
   */
  clearUserCache(did: string): void;
}

// =============================================================================
// LTR MODEL INTERFACE (FUTURE)
// =============================================================================

/**
 * LTR model interface for future ML-based ranking.
 *
 * @remarks
 * Placeholder for integrating trained ranking models.
 * Will be implemented when sufficient training data is collected.
 *
 * @public
 */
export interface ILTRModel {
  /**
   * Computes ranking score using learned model.
   *
   * @param features - Feature vector for the item
   * @returns Predicted relevance score
   */
  predict(features: LTRFeatureVector): number;

  /**
   * Batch prediction for efficiency.
   *
   * @param featureVectors - Array of feature vectors
   * @returns Array of predicted scores
   */
  predictBatch(featureVectors: readonly LTRFeatureVector[]): readonly number[];

  /**
   * Model metadata.
   */
  readonly metadata: LTRModelMetadata;
}

/**
 * LTR model metadata.
 *
 * @public
 */
export interface LTRModelMetadata {
  /**
   * Model name/identifier.
   */
  readonly name: string;

  /**
   * Model version.
   */
  readonly version: string;

  /**
   * Training date.
   */
  readonly trainedAt: Date;

  /**
   * Features used by the model in order.
   */
  readonly features: readonly string[];

  /**
   * Model algorithm (e.g., "xgboost-lambdamart").
   */
  readonly algorithm: string;
}
