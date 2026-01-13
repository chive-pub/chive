/**
 * Ranking service for personalized search results.
 *
 * @remarks
 * This module provides a generic ranking service that personalizes search
 * results based on the user's research fields and query relevance. It is
 * designed to be shared across all search types:
 * - Eprint search (browsing)
 * - Claiming search (finding papers to claim)
 * - Autocomplete suggestions
 *
 * Ranking is computed using:
 * - Field relevance (60%): How well the item's categories match user's fields
 * - Text relevance (40%): How well the item matches the query
 *
 * User fields are determined from:
 * 1. Explicit profile fields (if set)
 * 2. Categories of previously claimed papers (inferred)
 *
 * **Architecture:**
 * Uses dependency-injected ITextScorer and ICategoryMatcher for scoring,
 * enabling easy swapping of algorithms or future LTR model integration.
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { injectable, inject } from 'tsyringe';

import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  ICategoryMatcher,
  IRankingService,
  ITextScorer,
  RankableItem,
  RankedItem,
  RankingContext,
  RankingMode,
} from '../../types/interfaces/ranking.interface.js';

import type { LTRFeatureVector } from './relevance-logger.js';

// Re-export types from ranking interface
export type {
  RankableItem,
  RankedItem,
  RankingContext,
} from '../../types/interfaces/ranking.interface.js';

/**
 * Database row for user profile fields.
 */
interface UserProfileRow {
  readonly fields: string[] | null;
}

/**
 * Database row for category extraction.
 */
interface CategoryRow {
  readonly category: string;
}

/**
 * Database pool interface for queries.
 */
interface DatabasePool {
  query<T>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * Configuration for RankingService.
 *
 * @public
 */
export interface RankingServiceConfig {
  /**
   * Weight for field match score (default: 0.6).
   */
  readonly fieldWeight?: number;

  /**
   * Weight for text relevance score (default: 0.4).
   */
  readonly textWeight?: number;

  /**
   * Maximum number of user fields to consider.
   *
   * @remarks
   * Limits the number of fields used for scoring to prevent
   * dilution with users who have many fields.
   *
   * @defaultValue 10
   */
  readonly maxUserFields?: number;

  /**
   * Ranking mode: 'heuristic' or 'ltr'.
   *
   * @defaultValue 'heuristic'
   */
  readonly mode?: RankingMode;

  /**
   * Weight for title matching in multi-field scoring.
   *
   * @defaultValue 1.0
   */
  readonly titleWeight?: number;

  /**
   * Weight for abstract matching in multi-field scoring.
   *
   * @defaultValue 0.5
   */
  readonly abstractWeight?: number;

  /**
   * Discovery signal weights for enhanced personalization.
   *
   * @remarks
   * These weights control the contribution of external API signals
   * (Semantic Scholar, OpenAlex) and citation graph data.
   */
  readonly discoveryWeights?: DiscoverySignalWeights;
}

/**
 * Weights for discovery signals in ranking.
 *
 * @remarks
 * These weights are applied when discovery signals are provided.
 * All weights should sum to approximately 1.0 for balanced scoring.
 *
 * @public
 */
export interface DiscoverySignalWeights {
  /**
   * Weight for SPECTER2 semantic similarity (default: 0.30).
   */
  readonly specter2?: number;

  /**
   * Weight for co-citation score (default: 0.25).
   */
  readonly coCitation?: number;

  /**
   * Weight for concept overlap (default: 0.20).
   */
  readonly conceptOverlap?: number;

  /**
   * Weight for author network proximity (default: 0.15).
   */
  readonly authorNetwork?: number;

  /**
   * Weight for collaborative filtering (default: 0.10).
   */
  readonly collaborative?: number;
}

/**
 * Pre-computed discovery signals for ranking.
 *
 * @remarks
 * Maps item URIs to their discovery signal scores.
 * Computed by DiscoveryService before ranking.
 *
 * @public
 */
export interface DiscoverySignalSources {
  /**
   * SPECTER2 similarity scores by URI.
   */
  readonly s2Scores?: ReadonlyMap<string, number>;

  /**
   * Co-citation scores by URI.
   */
  readonly citationScores?: ReadonlyMap<string, number>;

  /**
   * Concept overlap scores by URI.
   */
  readonly conceptScores?: ReadonlyMap<string, number>;

  /**
   * Author network scores by URI.
   */
  readonly authorScores?: ReadonlyMap<string, number>;

  /**
   * Collaborative filtering scores by URI.
   */
  readonly collaborativeScores?: ReadonlyMap<string, number>;
}

/**
 * Ranking service for personalized search results.
 *
 * @remarks
 * Provides personalized ranking for search results based on:
 * - User's research fields (from profile or claimed papers)
 * - Query text relevance
 *
 * This service is designed to be shared across all search types
 * in the application to provide consistent personalization.
 *
 * **LTR Preparation:**
 * Extracts feature vectors for each ranked item to enable future
 * Learning to Rank model training and integration.
 *
 * @example
 * Basic usage with eprint search:
 * ```typescript
 * const rankingService = container.resolve(RankingService);
 *
 * const searchResults = await searchEngine.search({ query: 'neural networks' });
 * const ranked = await rankingService.rank(searchResults.hits, {
 *   userDid: user?.did,
 *   query: 'neural networks',
 * });
 *
 * // Results are now sorted by personalized relevance
 * const topResults = ranked.slice(0, 10).map(r => r.item);
 * ```
 *
 * @example
 * Usage in claiming autocomplete:
 * ```typescript
 * const results = await claimingService.searchExternal({ source: 'arxiv', query });
 * const ranked = await rankingService.rank(results, {
 *   userDid: user.did,
 *   query,
 * });
 *
 * return ranked.slice(0, 8).map(r => ({
 *   title: r.item.title,
 *   source: r.item.source,
 *   fieldMatch: r.fieldMatchScore,
 * }));
 * ```
 *
 * @public
 * @since 0.1.0
 */
@injectable()
export class RankingService implements IRankingService {
  /**
   * Cache for user fields to avoid repeated database queries.
   *
   * @remarks
   * Maps user DID to their research fields.
   * Cache entries expire after 5 minutes.
   */
  private readonly userFieldsCache = new Map<string, { fields: string[]; timestamp: number }>();

  /**
   * Cache TTL in milliseconds.
   */
  private readonly cacheTtlMs = 5 * 60 * 1000;

  /**
   * Weight for field match score.
   */
  private readonly fieldWeight: number;

  /**
   * Weight for text relevance score.
   */
  private readonly textWeight: number;

  /**
   * Maximum user fields to consider.
   */
  private readonly maxUserFields: number;

  /**
   * Ranking mode (heuristic or ltr).
   * Reserved for future LTR model integration.
   * @internal
   */
  readonly mode: RankingMode;

  /**
   * Weight for title matching.
   */
  private readonly titleWeight: number;

  /**
   * Weight for abstract matching.
   */
  private readonly abstractWeight: number;

  /**
   * Discovery signal weights.
   */
  private readonly discoveryWeights: Required<DiscoverySignalWeights>;

  /**
   * Default discovery weights following the plan.
   */
  private static readonly DEFAULT_DISCOVERY_WEIGHTS: Required<DiscoverySignalWeights> = {
    specter2: 0.3,
    coCitation: 0.25,
    conceptOverlap: 0.2,
    authorNetwork: 0.15,
    collaborative: 0.1,
  };

  /**
   * Creates a new RankingService.
   *
   * @param db - Database pool for user field lookup
   * @param logger - Logger instance
   * @param textScorer - Text similarity scorer
   * @param categoryMatcher - Category matching service
   * @param config - Optional configuration
   */
  constructor(
    @inject('DatabasePool') private readonly db: DatabasePool,
    @inject('ILogger') private readonly logger: ILogger,
    @inject('ITextScorer') private readonly textScorer: ITextScorer,
    @inject('ICategoryMatcher') private readonly categoryMatcher: ICategoryMatcher,
    config?: RankingServiceConfig
  ) {
    this.fieldWeight = config?.fieldWeight ?? 0.6;
    this.textWeight = config?.textWeight ?? 0.4;
    this.maxUserFields = config?.maxUserFields ?? 10;
    this.mode = config?.mode ?? 'heuristic';
    this.titleWeight = config?.titleWeight ?? 1.0;
    this.abstractWeight = config?.abstractWeight ?? 0.5;
    this.discoveryWeights = {
      ...RankingService.DEFAULT_DISCOVERY_WEIGHTS,
      ...config?.discoveryWeights,
    };
  }

  /**
   * Ranks items by relevance to user's research fields and query.
   *
   * @typeParam T - Type of items being ranked
   * @param items - Items to rank
   * @param context - Ranking context with user and query info
   * @returns Items with ranking scores, sorted by score descending
   *
   * @remarks
   * If no user context is provided, only text relevance is used.
   * If no query is provided, only field relevance is used.
   * If neither is provided, items retain their original order.
   *
   * @example
   * ```typescript
   * const ranked = await rankingService.rank(eprints, {
   *   userDid: 'did:plc:abc123',
   *   query: 'attention mechanism',
   * });
   *
   * for (const { item, score, fieldMatchScore, textRelevanceScore } of ranked) {
   *   console.log(`${item.title}: ${score} (field: ${fieldMatchScore}, text: ${textRelevanceScore})`);
   * }
   * ```
   */
  async rank<T extends RankableItem>(
    items: readonly T[],
    context: RankingContext
  ): Promise<readonly RankedItem<T>[]> {
    if (items.length === 0) {
      return [];
    }

    // Get user's fields (from explicit context, profile, or claimed papers)
    const userFields =
      context.userFields !== undefined
        ? [...context.userFields]
        : context.userDid
          ? await this.getUserFields(context.userDid)
          : [];

    // Rank each item
    const ranked = items.map((item, originalPosition) => {
      // Calculate field match score using category matcher
      const fieldMatchScore = this.categoryMatcher.computeFieldScore(
        item.categories ?? [],
        userFields
      );

      // Calculate text relevance score using text scorer
      let textRelevanceScore = 0;
      let titleMatchScore = 0;
      let abstractMatchScore = 0;

      if (context.query) {
        // Use multi-field scoring for more nuanced relevance
        const fields: Record<string, string | undefined> = {
          title: item.title,
          abstract: item.abstract,
        };
        const weights: Record<string, number> = {
          title: this.titleWeight,
          abstract: this.abstractWeight,
        };

        textRelevanceScore = this.textScorer.scoreMultiField(context.query, fields, weights);

        // Also compute individual scores for feature vector
        titleMatchScore = this.textScorer.score(context.query, item.title);
        if (item.abstract) {
          abstractMatchScore = this.textScorer.score(context.query, item.abstract);
        }
      }

      // Calculate recency score
      const recencyScore = this.calculateRecencyScore(item.publicationDate);

      // Combined score with configurable weights
      let score: number;
      if (userFields.length > 0 && context.query) {
        score = fieldMatchScore * this.fieldWeight + textRelevanceScore * this.textWeight;
      } else if (userFields.length > 0) {
        score = fieldMatchScore;
      } else if (context.query) {
        score = textRelevanceScore;
      } else {
        score = 0;
      }

      // Build LTR feature vector for training data
      const features: LTRFeatureVector = {
        textRelevance: textRelevanceScore,
        fieldMatchScore,
        titleMatchScore,
        abstractMatchScore,
        recencyScore,
        bm25Score: 0, // Would be populated from ES if available
        originalPosition,
      };

      return {
        item,
        score,
        fieldMatchScore,
        textRelevanceScore,
        features,
      };
    });

    // Sort by score descending
    return ranked.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculates recency score for an item.
   *
   * @param publicationDate - Publication date
   * @returns Score from 0 (old) to 1 (very recent)
   */
  private calculateRecencyScore(publicationDate?: Date): number {
    if (!publicationDate) {
      return 0.5; // Neutral score for unknown date
    }

    const now = Date.now();
    const publishedAt = publicationDate.getTime();
    const ageMs = now - publishedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Decay function: 1.0 for today, ~0.5 at 30 days, ~0.1 at 180 days
    // Using exponential decay with halflife of ~30 days
    const halfLifeDays = 30;
    return Math.exp((-Math.LN2 * ageDays) / halfLifeDays);
  }

  /**
   * Gets user's research fields from profile or claimed papers.
   *
   * @param did - User DID
   * @returns Array of field/category strings
   *
   * @remarks
   * Looks up fields in the following order:
   * 1. User profile fields (explicitly set)
   * 2. Categories from claimed papers (inferred)
   *
   * Results are cached for 5 minutes to reduce database load.
   *
   * @public
   */
  async getUserFields(did: string): Promise<readonly string[]> {
    // Check cache first
    const cached = this.userFieldsCache.get(did);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.fields;
    }

    try {
      // 1. Check explicit profile fields
      const profileResult = await this.db.query<UserProfileRow>(
        `SELECT fields FROM user_profiles WHERE did = $1`,
        [did]
      );

      const profileFields = profileResult.rows[0]?.fields;
      if (profileFields && profileFields.length > 0) {
        const fields = profileFields.slice(0, this.maxUserFields);
        this.userFieldsCache.set(did, { fields, timestamp: Date.now() });
        return fields;
      }

      // 2. Infer from claimed papers
      const claimsResult = await this.db.query<CategoryRow>(
        `SELECT DISTINCT unnest(i.categories) as category
         FROM claim_requests c
         JOIN imports i ON c.import_id = i.id
         WHERE c.claimant_did = $1 AND c.status = 'approved'
         LIMIT $2`,
        [did, this.maxUserFields]
      );

      const fields = claimsResult.rows.map((r) => r.category);
      this.userFieldsCache.set(did, { fields, timestamp: Date.now() });
      return fields;
    } catch (error) {
      this.logger.warn('Failed to get user fields', {
        did,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Ranks items with discovery signals for enhanced personalization.
   *
   * @typeParam T - Type of items being ranked (must have uri property)
   * @param items - Items to rank
   * @param context - Ranking context with user and query info
   * @param discoverySignals - Pre-computed discovery signal sources
   * @returns Items with ranking scores including discovery features
   *
   * @remarks
   * Extends the base `rank` method with discovery signals from external APIs
   * (Semantic Scholar, OpenAlex) and the citation graph.
   *
   * Discovery signals are combined with base signals using configurable weights:
   * - SPECTER2 similarity: 30% (semantic document similarity)
   * - Co-citation score: 25% (bibliographic coupling)
   * - Concept overlap: 20% (OpenAlex topic similarity)
   * - Author network: 15% (co-author proximity)
   * - Collaborative: 10% (user similarity)
   *
   * @example
   * ```typescript
   * // Compute discovery signals from DiscoveryService
   * const s2Scores = new Map([['at://...', 0.8], ['at://...', 0.6]]);
   * const citationScores = new Map([['at://...', 0.7]]);
   *
   * const ranked = await rankingService.rankWithDiscoverySignals(
   *   eprints,
   *   { userDid, query: 'neural networks' },
   *   { s2Scores, citationScores }
   * );
   * ```
   *
   * @public
   */
  async rankWithDiscoverySignals<T extends RankableItem & { uri?: string }>(
    items: readonly T[],
    context: RankingContext,
    discoverySignals?: DiscoverySignalSources
  ): Promise<readonly RankedItem<T>[]> {
    if (items.length === 0) {
      return [];
    }

    // Get user's fields
    const userFields =
      context.userFields !== undefined
        ? [...context.userFields]
        : context.userDid
          ? await this.getUserFields(context.userDid)
          : [];

    // Rank each item with discovery signals
    const ranked = items.map((item, originalPosition) => {
      // Base scores (same as rank method)
      const fieldMatchScore = this.categoryMatcher.computeFieldScore(
        item.categories ?? [],
        userFields
      );

      let textRelevanceScore = 0;
      let titleMatchScore = 0;
      let abstractMatchScore = 0;

      if (context.query) {
        const fields: Record<string, string | undefined> = {
          title: item.title,
          abstract: item.abstract,
        };
        const weights: Record<string, number> = {
          title: this.titleWeight,
          abstract: this.abstractWeight,
        };

        textRelevanceScore = this.textScorer.scoreMultiField(context.query, fields, weights);
        titleMatchScore = this.textScorer.score(context.query, item.title);
        if (item.abstract) {
          abstractMatchScore = this.textScorer.score(context.query, item.abstract);
        }
      }

      const recencyScore = this.calculateRecencyScore(item.publicationDate);

      // Discovery signals (lookup by URI if available)
      const itemUri = item.uri ?? '';
      const specter2Similarity = discoverySignals?.s2Scores?.get(itemUri) ?? 0;
      const coCitationScore = discoverySignals?.citationScores?.get(itemUri) ?? 0;
      const conceptOverlapScore = discoverySignals?.conceptScores?.get(itemUri) ?? 0;
      const authorNetworkScore = discoverySignals?.authorScores?.get(itemUri) ?? 0;
      const collaborativeScore = discoverySignals?.collaborativeScores?.get(itemUri) ?? 0;

      // Compute discovery score
      const discoveryScore = this.computeDiscoveryScore({
        specter2Similarity,
        coCitationScore,
        conceptOverlapScore,
        authorNetworkScore,
        collaborativeScore,
      });

      // Combined score: blend base score with discovery score
      // If discovery signals are provided, give them 40% weight
      const hasDiscoverySignals =
        specter2Similarity > 0 ||
        coCitationScore > 0 ||
        conceptOverlapScore > 0 ||
        authorNetworkScore > 0 ||
        collaborativeScore > 0;

      let score: number;
      if (hasDiscoverySignals) {
        // Base score (field + text)
        let baseScore: number;
        if (userFields.length > 0 && context.query) {
          baseScore = fieldMatchScore * this.fieldWeight + textRelevanceScore * this.textWeight;
        } else if (userFields.length > 0) {
          baseScore = fieldMatchScore;
        } else if (context.query) {
          baseScore = textRelevanceScore;
        } else {
          baseScore = 0;
        }

        // Blend: 60% base, 40% discovery
        score = baseScore * 0.6 + discoveryScore * 0.4;
      } else {
        // No discovery signals, use standard scoring
        if (userFields.length > 0 && context.query) {
          score = fieldMatchScore * this.fieldWeight + textRelevanceScore * this.textWeight;
        } else if (userFields.length > 0) {
          score = fieldMatchScore;
        } else if (context.query) {
          score = textRelevanceScore;
        } else {
          score = 0;
        }
      }

      // Build LTR feature vector with discovery signals
      const features: LTRFeatureVector = {
        textRelevance: textRelevanceScore,
        fieldMatchScore,
        titleMatchScore,
        abstractMatchScore,
        recencyScore,
        bm25Score: 0,
        originalPosition,
        // Discovery signals
        specter2Similarity,
        coCitationScore,
        conceptOverlapScore,
        authorNetworkScore,
        collaborativeScore,
      };

      return {
        item,
        score,
        fieldMatchScore,
        textRelevanceScore,
        features,
      };
    });

    // Sort by score descending
    return ranked.sort((a, b) => b.score - a.score);
  }

  /**
   * Computes weighted discovery score from individual signals.
   *
   * @param signals - Individual discovery signal scores
   * @returns Combined discovery score (0-1)
   */
  private computeDiscoveryScore(signals: {
    specter2Similarity: number;
    coCitationScore: number;
    conceptOverlapScore: number;
    authorNetworkScore: number;
    collaborativeScore: number;
  }): number {
    return (
      signals.specter2Similarity * this.discoveryWeights.specter2 +
      signals.coCitationScore * this.discoveryWeights.coCitation +
      signals.conceptOverlapScore * this.discoveryWeights.conceptOverlap +
      signals.authorNetworkScore * this.discoveryWeights.authorNetwork +
      signals.collaborativeScore * this.discoveryWeights.collaborative
    );
  }

  /**
   * Gets the current discovery weights.
   *
   * @returns Discovery signal weights
   *
   * @public
   */
  getDiscoveryWeights(): Readonly<Required<DiscoverySignalWeights>> {
    return this.discoveryWeights;
  }

  /**
   * Clears the user fields cache.
   *
   * @remarks
   * Useful for testing or when user profile changes.
   *
   * @public
   */
  clearCache(): void {
    this.userFieldsCache.clear();
  }

  /**
   * Clears cache entry for a specific user.
   *
   * @param did - User DID
   *
   * @public
   */
  clearUserCache(did: string): void {
    this.userFieldsCache.delete(did);
  }
}

export default RankingService;
