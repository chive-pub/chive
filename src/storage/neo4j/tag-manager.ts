import neo4j from 'neo4j-driver';
import { singleton } from 'tsyringe';

import type { AtUri } from '../../types/atproto.js';
import { ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  FacetUsageHistoryRepository,
  TrendingTimeWindow,
} from '../postgresql/facet-usage-history-repository.js';

import { Neo4jConnection } from './connection.js';
import { TagSpamDetector, type TagSpamDetectorConfig } from './tag-spam-detector.js';
import type { UserTag } from './types.js';

/**
 * Tag search results
 */
export interface TagSearchResult {
  tags: UserTag[];
  total: number;
}

/**
 * Tag suggestion for a normalized form
 */
export interface TagSuggestion {
  normalizedForm: string;
  suggestedRawForms: string[];
  confidence: number;
  fieldMapping?: AtUri;
  facetMapping?: AtUri;
  qualityScore: number;
}

/**
 * Tag normalization result
 */
export interface TagNormalizationResult {
  rawForm: string;
  normalizedForm: string;
  existed: boolean;
}

/**
 * Facet mapping suggestion.
 */
export interface FacetMappingSuggestion {
  /** Facet AT-URI */
  facetUri: AtUri;
  /** Facet value */
  facetValue: string;
  /** Facet dimension slug */
  dimension: string;
  /** Display label */
  displayLabel: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Match type */
  matchType: 'exact' | 'prefix' | 'partial';
}

/**
 * Tag promotion to field candidate
 */
export interface FieldCandidate {
  tag: UserTag;
  evidence: {
    usageCount: number;
    uniqueUsers: number;
    paperCount: number;
    growthRate: number;
    qualityScore: number;
  };
  suggestedFieldName: string;
  confidence: number;
}

/**
 * Tag manager for hybrid taxonomy-folksonomy approach (TaxoFolk).
 *
 * Combines formal field taxonomy with user-generated tags:
 * - Tags are user-created, informal labels
 * - Popular tags can be promoted to formal fields
 * - System tracks usage, quality, and spam scores
 * - Normalization reduces variant forms
 *
 * Quality scoring factors:
 * - Usage count (more is better)
 * - Unique users (diversity is better)
 * - Growth rate (trending is better)
 * - Spam detection (ML-based)
 *
 * @example
 * ```typescript
 * const tagManager = container.resolve(TagManager);
 *
 * // Add a tag to a record
 * await tagManager.addTag(
 *   'at://did:plc:user/pub.chive.eprint/123',
 *   'neural networks',
 *   'did:plc:user'
 * );
 *
 * // Get trending tags
 * const trending = await tagManager.getTrendingTags(20);
 *
 * // Find field promotion candidates
 * const candidates = await tagManager.findFieldCandidates(0.7);
 * ```
 */
/**
 * Configuration options for TagManager.
 *
 * @public
 */
export interface TagManagerOptions {
  /**
   * Neo4j connection.
   */
  connection: Neo4jConnection;

  /**
   * Logger instance (optional, but required for spam detection).
   */
  logger?: ILogger;

  /**
   * Spam detector configuration.
   */
  spamDetectorConfig?: TagSpamDetectorConfig;
}

@singleton()
export class TagManager {
  /**
   * Minimum usage count for field promotion
   */
  private static readonly MIN_USAGE_FOR_PROMOTION = 10;

  /**
   * Minimum unique users for field promotion
   */
  private static readonly MIN_USERS_FOR_PROMOTION = 5;

  private readonly connection: Neo4jConnection;
  private readonly spamDetector: TagSpamDetector | null;
  private readonly logger: ILogger | null;

  /**
   * Creates a TagManager instance.
   *
   * @param options - Configuration options or Neo4jConnection instance
   */
  constructor(options: TagManagerOptions | Neo4jConnection) {
    if ('executeQuery' in options) {
      // Direct Neo4jConnection passed
      this.connection = options;
      this.spamDetector = null;
      this.logger = null;
    } else {
      this.connection = options.connection;
      this.logger = options.logger ?? null;

      // Initialize spam detector if logger is provided
      if (options.logger) {
        this.spamDetector = new TagSpamDetector({
          connection: options.connection,
          logger: options.logger,
          config: options.spamDetectorConfig,
        });
      } else {
        this.spamDetector = null;
      }
    }
  }

  /**
   * Normalize a tag string.
   *
   * Converts to lowercase, removes special characters, and standardizes whitespace.
   *
   * @param tag - Raw tag string
   * @returns Normalized tag string
   *
   * @example
   * ```typescript
   * tagManager.normalizeTag('Neural-Networks!') // 'neural networks'
   * tagManager.normalizeTag('  Deep   Learning  ') // 'deep learning'
   * ```
   */
  normalizeTag(tag: string): string {
    return tag
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/-+/g, '-') // Normalize hyphens
      .trim();
  }

  /**
   * Add tag to a record.
   *
   * Creates or updates the tag node and creates TAGGED_WITH relationship.
   * Automatically normalizes the tag and updates usage statistics.
   *
   * @param recordUri - Record AT-URI (eprint, review, etc.)
   * @param rawTag - Raw tag string from user
   * @param userDid - DID of user adding the tag
   * @returns Normalization result
   *
   * @example
   * ```typescript
   * const result = await tagManager.addTag(
   *   'at://did:plc:user/pub.chive.eprint/123',
   *   'Machine Learning',
   *   'did:plc:user'
   * );
   * console.log(`Normalized to: ${result.normalizedForm}`);
   * ```
   */
  async addTag(recordUri: AtUri, rawTag: string, userDid: string): Promise<TagNormalizationResult> {
    const normalized = this.normalizeTag(rawTag);

    const query = `
      MERGE (tag:UserTag {normalizedForm: $normalized})
      ON CREATE SET
        tag.rawForm = $rawTag,
        tag.usageCount = 0,
        tag.uniqueUsers = 0,
        tag.paperCount = 0,
        tag.qualityScore = 0.5,
        tag.spamScore = 0.0,
        tag.growthRate = 0.0,
        tag.createdAt = datetime(),
        tag.updatedAt = datetime()
      ON MATCH SET
        tag.updatedAt = datetime()
      WITH tag
      MERGE (record {uri: $recordUri})
      // Check if relationship already exists before creating
      OPTIONAL MATCH (record)-[existing:TAGGED_WITH]->(tag)
      WITH tag, record, existing IS NULL as isNewRelationship
      FOREACH (_ IN CASE WHEN isNewRelationship THEN [1] ELSE [] END |
        MERGE (record)-[r:TAGGED_WITH]->(tag)
        ON CREATE SET
          r.addedBy = $userDid,
          r.addedAt = datetime()
      )
      // Only increment usageCount if this is a new relationship
      SET tag.usageCount = tag.usageCount + CASE WHEN isNewRelationship THEN 1 ELSE 0 END
      RETURN NOT isNewRelationship as existed, tag.usageCount as usageCount, tag.paperCount as paperCount
    `;

    const result = await this.connection.executeQuery<{
      existed: boolean;
      usageCount: number;
      paperCount: number;
    }>(query, {
      normalized,
      rawTag,
      recordUri,
      userDid,
    });

    const record = result.records[0];
    const existed = record?.get('existed') ?? false;
    const usageCount = Number(record?.get('usageCount')) || 1;
    const paperCount = Number(record?.get('paperCount')) || 0;

    // Update unique users and paper counts asynchronously
    void this.updateTagStatistics(normalized);

    // Record usage to facet history for trending calculation
    if (this.facetHistoryRepository) {
      void this.facetHistoryRepository
        .recordDailySnapshot(normalized, usageCount, paperCount)
        .catch((error) => {
          this.logger?.warn('Failed to record tag usage snapshot', {
            tag: normalized,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }

    return {
      rawForm: rawTag,
      normalizedForm: normalized,
      existed,
    };
  }

  /**
   * Remove tag from a record.
   *
   * @param recordUri - Record AT-URI
   * @param normalizedTag - Normalized tag form
   */
  async removeTag(recordUri: AtUri, normalizedTag: string): Promise<void> {
    const query = `
      MATCH (record {uri: $recordUri})-[r:TAGGED_WITH]->(tag:UserTag {normalizedForm: $normalizedTag})
      DELETE r
      WITH tag
      SET tag.usageCount = CASE WHEN tag.usageCount > 0 THEN tag.usageCount - 1 ELSE 0 END,
          tag.updatedAt = datetime()
      RETURN tag.usageCount as usageCount, tag.paperCount as paperCount
    `;

    const result = await this.connection.executeQuery<{
      usageCount: number;
      paperCount: number;
    }>(query, { recordUri, normalizedTag });

    const record = result.records[0];
    const usageCount = Number(record?.get('usageCount')) || 0;
    const paperCount = Number(record?.get('paperCount')) || 0;

    // Update statistics
    void this.updateTagStatistics(normalizedTag);

    // Record updated usage to facet history for trending calculation
    if (this.facetHistoryRepository) {
      void this.facetHistoryRepository
        .recordDailySnapshot(normalizedTag, usageCount, paperCount)
        .catch((error) => {
          this.logger?.warn('Failed to record tag usage snapshot after removal', {
            tag: normalizedTag,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }
  }

  /**
   * Get tag by normalized form.
   *
   * @param normalizedForm - Normalized tag string
   * @returns User tag or null if not found
   */
  async getTag(normalizedForm: string): Promise<UserTag | null> {
    const query = `
      MATCH (tag:UserTag {normalizedForm: $normalizedForm})
      RETURN tag
    `;

    const result = await this.connection.executeQuery<{
      tag: Record<string, string | number | Date>;
    }>(query, { normalizedForm });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapTag(record.get('tag'));
  }

  /**
   * Search tags by partial match.
   *
   * Uses fulltext index (tagTextIndex) for fast search, falling back to
   * CONTAINS if index is not available.
   *
   * @param searchText - Search query
   * @param limit - Maximum results (default: 50)
   * @returns Search results
   *
   * @example
   * ```typescript
   * const results = await tagManager.searchTags('learn');
   * // Returns: learning, machine learning, deep learning, etc.
   * ```
   */
  async searchTags(searchText: string, limit = 50): Promise<TagSearchResult> {
    const normalized = this.normalizeTag(searchText);

    // Use fulltext index for fast search
    const fullTextQuery = `
      CALL db.index.fulltext.queryNodes('tagTextIndex', $searchText)
      YIELD node AS tag, score
      WITH tag, score
      ORDER BY score DESC, tag.usageCount DESC, tag.qualityScore DESC
      LIMIT $limit
      RETURN tag
    `;

    // Fallback query if fulltext index not available
    const fallbackQuery = `
      MATCH (tag:UserTag)
      WHERE tag.normalizedForm CONTAINS $searchText
      WITH tag
      ORDER BY tag.usageCount DESC, tag.qualityScore DESC
      LIMIT $limit
      RETURN tag
    `;

    try {
      // Try fulltext search first (wildcards for prefix/suffix matching)
      const result = await this.connection.executeQuery<{
        tag: Record<string, string | number | Date>;
      }>(fullTextQuery, { searchText: `${normalized}*`, limit: neo4j.int(limit) });

      const tags = result.records.map((record) => this.mapTag(record.get('tag')));

      return {
        tags,
        total: tags.length,
      };
    } catch {
      // Fall back to CONTAINS if fulltext index not available
      const result = await this.connection.executeQuery<{
        tag: Record<string, string | number | Date>;
      }>(fallbackQuery, { searchText: normalized, limit: neo4j.int(limit) });

      const tags = result.records.map((record) => this.mapTag(record.get('tag')));

      return {
        tags,
        total: tags.length,
      };
    }
  }

  /**
   * Get tags for a record.
   *
   * @param recordUri - Record AT-URI
   * @returns Array of user tags
   */
  async getTagsForRecord(recordUri: AtUri): Promise<UserTag[]> {
    const query = `
      MATCH (record {uri: $recordUri})-[:TAGGED_WITH]->(tag:UserTag)
      RETURN tag
      ORDER BY tag.usageCount DESC
    `;

    const result = await this.connection.executeQuery<{
      tag: Record<string, string | number | Date>;
    }>(query, { recordUri });

    return result.records.map((record) => this.mapTag(record.get('tag')));
  }

  /**
   * Get records with a specific tag.
   *
   * @param normalizedTag - Normalized tag form
   * @param limit - Maximum results (default: 100)
   * @returns Array of record URIs
   */
  async getRecordsWithTag(normalizedTag: string, limit = 100): Promise<AtUri[]> {
    const query = `
      MATCH (record)-[:TAGGED_WITH]->(tag:UserTag {normalizedForm: $normalizedTag})
      RETURN record.uri as uri
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{ uri: AtUri }>(query, {
      normalizedTag,
      limit: neo4j.int(limit),
    });

    return result.records.map((record) => record.get('uri'));
  }

  /**
   * Get trending tags by usage.
   *
   * @param limit - Maximum results (default: 20)
   * @param options - Trending options including time window and minimum usage
   * @returns Top tags by usage and growth
   */
  async getTrendingTags(
    limit = 20,
    options?: { timeWindow?: TrendingTimeWindow; minUsage?: number }
  ): Promise<UserTag[]> {
    const minUsage = options?.minUsage ?? 5;
    const timeWindow = options?.timeWindow ?? 'week';

    // If we have a facet history repository, try time-windowed trending first
    if (this.facetHistoryRepository) {
      const trendingFacets = await this.facetHistoryRepository.getTopTrending(
        timeWindow,
        limit,
        minUsage
      );

      // If facet history has data, look up the corresponding UserTag nodes
      if (trendingFacets.length > 0) {
        const uris = trendingFacets.map((f) => f.facetUri);
        const query = `
          MATCH (tag:UserTag)
          WHERE tag.normalizedForm IN $uris
          RETURN tag
        `;

        const result = await this.connection.executeQuery<{
          tag: Record<string, string | number | Date>;
        }>(query, { uris });

        // Map results preserving trending order
        const tagMap = new Map<string, UserTag>();
        for (const record of result.records) {
          const tag = this.mapTag(record.get('tag'));
          tagMap.set(tag.normalizedForm, tag);
        }

        // Return in trending order
        return trendingFacets
          .map((f) => tagMap.get(f.facetUri))
          .filter((t): t is UserTag => t !== undefined);
      }
      // Fall through to Neo4j query if facet history is empty
    }

    // Fallback: Use Neo4j growthRate field directly
    const query = `
      MATCH (tag:UserTag)
      WHERE tag.usageCount >= $minUsage
      WITH tag
      ORDER BY tag.growthRate DESC, tag.usageCount DESC
      LIMIT $limit
      RETURN tag
    `;

    const result = await this.connection.executeQuery<{
      tag: Record<string, string | number | Date>;
    }>(query, { limit: neo4j.int(limit), minUsage: neo4j.int(minUsage) });

    return result.records.map((record) => this.mapTag(record.get('tag')));
  }

  /**
   * Sets the facet history repository for time-windowed trending.
   *
   * @param repository - The FacetUsageHistoryRepository instance
   */
  setFacetHistoryRepository(repository: FacetUsageHistoryRepository): void {
    this.facetHistoryRepository = repository;
  }

  /** Optional repository for time-windowed trending */
  private facetHistoryRepository?: FacetUsageHistoryRepository;

  /**
   * Get high-quality tags suitable for field promotion.
   *
   * @param minQuality - Minimum quality score (default: 0.7)
   * @returns Array of field candidates
   *
   * @example
   * ```typescript
   * const candidates = await tagManager.findFieldCandidates(0.7);
   * for (const candidate of candidates) {
   *   console.log(`${candidate.suggestedFieldName}: ${candidate.confidence}`);
   *   console.log(`  Used ${candidate.evidence.usageCount} times by ${candidate.evidence.uniqueUsers} users`);
   * }
   * ```
   */
  async findFieldCandidates(minQuality = 0.7): Promise<FieldCandidate[]> {
    const query = `
      MATCH (tag:UserTag)
      WHERE tag.usageCount >= $minUsage
        AND tag.uniqueUsers >= $minUsers
        AND tag.qualityScore >= $minQuality
        AND tag.spamScore < 0.3
      RETURN tag
      ORDER BY tag.qualityScore DESC, tag.usageCount DESC
      LIMIT 50
    `;

    const result = await this.connection.executeQuery<{
      tag: Record<string, string | number | Date>;
    }>(query, {
      minUsage: TagManager.MIN_USAGE_FOR_PROMOTION,
      minUsers: TagManager.MIN_USERS_FOR_PROMOTION,
      minQuality,
    });

    return result.records.map((record) => {
      const tag = this.mapTag(record.get('tag'));

      // Calculate confidence based on quality metrics
      const qualityScore = tag.qualityScore ?? 0.5;
      const usageCount = tag.usageCount ?? 0;
      const uniqueUsers = tag.uniqueUsers ?? 0;
      const paperCount = tag.paperCount ?? 0;
      const growthRate = tag.growthRate ?? 0;

      const confidence =
        qualityScore * 0.4 +
        Math.min(usageCount / 100, 1.0) * 0.3 +
        Math.min(uniqueUsers / 20, 1.0) * 0.2 +
        growthRate * 0.1;

      // Suggest field name (capitalize words)
      const suggestedFieldName = tag.normalizedForm
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return {
        tag,
        evidence: {
          usageCount,
          uniqueUsers,
          paperCount,
          growthRate,
          qualityScore,
        },
        suggestedFieldName,
        confidence,
      };
    });
  }

  /**
   * Update tag statistics (usage counts, growth rate, quality score).
   *
   * Called asynchronously after tag additions/removals.
   *
   * @param normalizedTag - Normalized tag form
   */
  private async updateTagStatistics(normalizedTag: string): Promise<void> {
    const query = `
      MATCH (tag:UserTag {normalizedForm: $normalizedTag})
      OPTIONAL MATCH (record)-[r:TAGGED_WITH]->(tag)
      WITH tag,
           count(DISTINCT record) as paperCount,
           count(DISTINCT r.addedBy) as uniqueUsers
      SET tag.paperCount = paperCount,
          tag.uniqueUsers = uniqueUsers,
          tag.updatedAt = datetime()
      WITH tag
      CALL {
        WITH tag
        MATCH (tag)
        WHERE tag.createdAt IS NOT NULL
        WITH tag,
             duration.between(tag.createdAt, datetime()).days as daysSinceCreation
        WHERE daysSinceCreation > 0
        SET tag.growthRate = toFloat(tag.usageCount) / daysSinceCreation
      }
      RETURN tag
    `;

    await this.connection.executeQuery(query, { normalizedTag });

    // Update quality score based on usage patterns
    void this.updateQualityScore(normalizedTag);
  }

  /**
   * Update quality score for a tag.
   *
   * Quality score is based on:
   * - Usage diversity (unique users / total usage)
   * - Growth sustainability (not just spam bursts)
   * - Spam detection via TagSpamDetector heuristics
   *
   * @param normalizedTag - Normalized tag form
   */
  private async updateQualityScore(normalizedTag: string): Promise<void> {
    // First, calculate base quality from diversity
    const diversityQuery = `
      MATCH (tag:UserTag {normalizedForm: $normalizedTag})
      WHERE tag.usageCount > 0
      WITH tag,
           toFloat(tag.uniqueUsers) / tag.usageCount as diversityScore
      RETURN diversityScore
    `;

    const diversityResult = await this.connection.executeQuery<{ diversityScore: number }>(
      diversityQuery,
      { normalizedTag }
    );

    const diversityRecord = diversityResult.records[0];
    if (!diversityRecord) {
      return; // Tag not found or no usage
    }

    const diversityScore = diversityRecord.get('diversityScore') ?? 0;

    // Run spam detection if detector is available
    let spamScore = 0;
    if (this.spamDetector) {
      try {
        const spamResult = await this.spamDetector.detectSpam(normalizedTag);
        spamScore = spamResult.spamScore;

        if (spamResult.isSpam && this.logger) {
          this.logger.info('Tag flagged as spam', {
            tag: normalizedTag,
            spamScore: spamResult.spamScore,
            reasons: spamResult.reasons,
          });
        }
      } catch (error) {
        // Log but don't fail quality update if spam detection fails
        this.logger?.warn('Spam detection failed for tag', {
          tag: normalizedTag,
          error: (error as Error).message,
        });
      }
    }

    // Calculate final quality score:
    // - Base quality from diversity (0.6 weight)
    // - Reduced by spam score (up to 0.4 penalty)
    const baseQuality = diversityScore * 0.6 + 0.4;
    const qualityScore = Math.max(0, baseQuality * (1 - spamScore));

    // Update tag with calculated scores
    const updateQuery = `
      MATCH (tag:UserTag {normalizedForm: $normalizedTag})
      SET tag.qualityScore = $qualityScore,
          tag.spamScore = $spamScore,
          tag.updatedAt = datetime()
      RETURN tag
    `;

    await this.connection.executeQuery(updateQuery, {
      normalizedTag,
      qualityScore,
      spamScore,
    });
  }

  /**
   * Mark tag as spam.
   *
   * @param normalizedTag - Normalized tag form
   * @param spamScore - Spam score (0-1)
   */
  async markAsSpam(normalizedTag: string, spamScore: number): Promise<void> {
    if (spamScore < 0 || spamScore > 1) {
      throw new ValidationError('Spam score must be between 0 and 1', 'spamScore', 'range');
    }

    const query = `
      MATCH (tag:UserTag {normalizedForm: $normalizedTag})
      SET tag.spamScore = $spamScore,
          tag.qualityScore = tag.qualityScore * (1.0 - $spamScore),
          tag.updatedAt = datetime()
      RETURN tag
    `;

    await this.connection.executeQuery(query, { normalizedTag, spamScore });
  }

  /**
   * Merge tag variant into canonical form.
   *
   * Merges all usages of variantTag into canonicalTag.
   *
   * @param variantTag - Variant tag to merge (removed after merge)
   * @param canonicalTag - Canonical tag to merge into
   *
   * @example
   * ```typescript
   * // Merge "ML" into "machine learning"
   * await tagManager.mergeTagVariants('ml', 'machine learning');
   * ```
   */
  async mergeTagVariants(variantTag: string, canonicalTag: string): Promise<void> {
    const variantNorm = this.normalizeTag(variantTag);
    const canonicalNorm = this.normalizeTag(canonicalTag);

    await this.connection.executeTransaction(async (tx) => {
      // Get all records tagged with variant
      const recordsResult = await tx.run(
        `
        MATCH (record)-[r:TAGGED_WITH]->(variant:UserTag {normalizedForm: $variantNorm})
        RETURN record.uri as uri, r.addedBy as addedBy, r.addedAt as addedAt
        `,
        { variantNorm }
      );

      // Re-tag with canonical form
      for (const record of recordsResult.records) {
        const uri = record.get('uri') as AtUri;
        const addedBy = record.get('addedBy') as string;
        const addedAt = record.get('addedAt') as string;

        await tx.run(
          `
          MATCH (record {uri: $uri})
          MERGE (canonical:UserTag {normalizedForm: $canonicalNorm})
          ON CREATE SET
            canonical.rawForm = $canonicalTag,
            canonical.usageCount = 0,
            canonical.uniqueUsers = 0,
            canonical.paperCount = 0,
            canonical.qualityScore = 0.5,
            canonical.spamScore = 0.0,
            canonical.growthRate = 0.0,
            canonical.createdAt = datetime(),
            canonical.updatedAt = datetime()
          MERGE (record)-[r:TAGGED_WITH]->(canonical)
          ON CREATE SET
            r.addedBy = $addedBy,
            r.addedAt = $addedAt
          SET canonical.usageCount = canonical.usageCount + 1,
              canonical.updatedAt = datetime()
          `,
          { uri, canonicalNorm, canonicalTag, addedBy, addedAt }
        );
      }

      // Delete variant tag
      await tx.run(
        `
        MATCH (variant:UserTag {normalizedForm: $variantNorm})
        DETACH DELETE variant
        `,
        { variantNorm }
      );
    });

    // Update canonical tag statistics
    void this.updateTagStatistics(canonicalNorm);
  }

  /**
   * Get tag co-occurrence suggestions.
   *
   * Finds tags frequently used together with the given tag.
   *
   * @param normalizedTag - Normalized tag form
   * @param limit - Maximum suggestions (default: 10)
   * @returns Array of suggested tags with co-occurrence counts
   */
  async getTagSuggestions(
    normalizedTag: string,
    limit = 10
  ): Promise<{ tag: UserTag; coOccurrenceCount: number }[]> {
    const query = `
      MATCH (tag:UserTag {normalizedForm: $normalizedTag})<-[:TAGGED_WITH]-(record)
      MATCH (record)-[:TAGGED_WITH]->(otherTag:UserTag)
      WHERE otherTag <> tag
      WITH otherTag, count(DISTINCT record) as coOccurrences
      ORDER BY coOccurrences DESC
      LIMIT $limit
      RETURN otherTag, coOccurrences
    `;

    const result = await this.connection.executeQuery<{
      otherTag: Record<string, string | number | Date>;
      coOccurrences: number;
    }>(query, { normalizedTag, limit: neo4j.int(limit) });

    return result.records.map((record) => ({
      tag: this.mapTag(record.get('otherTag')),
      coOccurrenceCount: Number(record.get('coOccurrences')),
    }));
  }

  /**
   * Facet mapping suggestion result.
   */
  async suggestFacetMapping(tag: string): Promise<FacetMappingSuggestion[]> {
    const normalized = this.normalizeTag(tag);

    // Query facets with similar labels using full-text search or CONTAINS fallback
    const fullTextQuery = `
      CALL db.index.fulltext.queryNodes('facetTextIndex', $searchText)
      YIELD node, score
      WHERE node:Facet
      WITH node AS facet, score
      ORDER BY score DESC
      LIMIT 10
      RETURN
        facet.uri AS uri,
        facet.value AS value,
        facet.facetType AS dimension,
        facet.label AS label,
        score AS searchScore
    `;

    const fallbackQuery = `
      MATCH (facet:Facet)
      WHERE toLower(facet.value) CONTAINS toLower($searchText)
         OR toLower(facet.label) CONTAINS toLower($searchText)
      WITH facet,
           CASE
             WHEN toLower(facet.value) = toLower($searchText) THEN 1.0
             WHEN toLower(facet.label) = toLower($searchText) THEN 0.95
             WHEN toLower(facet.value) STARTS WITH toLower($searchText) THEN 0.8
             ELSE 0.5
           END AS score
      ORDER BY score DESC
      LIMIT 10
      RETURN
        facet.uri AS uri,
        facet.value AS value,
        facet.facetType AS dimension,
        facet.label AS label,
        score AS searchScore
    `;

    try {
      // Try full-text search first
      const result = await this.connection.executeQuery<{
        uri: AtUri;
        value: string;
        dimension: string;
        label: string | null;
        searchScore: number;
      }>(fullTextQuery, { searchText: `${normalized}*` });

      return this.mapFacetSuggestions(result.records, normalized);
    } catch {
      // Fall back to CONTAINS if full-text index not available
      const result = await this.connection.executeQuery<{
        uri: AtUri;
        value: string;
        dimension: string;
        label: string | null;
        searchScore: number;
      }>(fallbackQuery, { searchText: normalized });

      return this.mapFacetSuggestions(result.records, normalized);
    }
  }

  /**
   * Map facet search results to suggestions.
   */
  private mapFacetSuggestions(
    records: {
      get: (key: string) => AtUri | string | number | null;
    }[],
    searchTerm: string
  ): FacetMappingSuggestion[] {
    return records.map((record) => {
      const value = record.get('value') as string;
      const searchScore = Number(record.get('searchScore'));

      // Calculate confidence based on search score and string similarity
      const exactMatch = value.toLowerCase() === searchTerm.toLowerCase();
      const startsWithMatch = value.toLowerCase().startsWith(searchTerm.toLowerCase());

      let confidence = searchScore;
      if (exactMatch) {
        confidence = Math.min(confidence + 0.3, 1.0);
      } else if (startsWithMatch) {
        confidence = Math.min(confidence + 0.1, 1.0);
      }

      return {
        facetUri: record.get('uri') as AtUri,
        facetValue: value,
        dimension: record.get('dimension') as string,
        displayLabel: (record.get('label') as string | null) ?? value,
        confidence: Math.round(confidence * 100) / 100,
        matchType: exactMatch ? 'exact' : startsWithMatch ? 'prefix' : 'partial',
      };
    });
  }

  /**
   * Map Neo4j node to UserTag type.
   */
  private mapTag(node: Record<string, unknown>): UserTag {
    // Neo4j Node objects have properties in a `properties` field
    // Handle both direct property access and Node.properties access
    const props =
      'properties' in node && typeof node.properties === 'object' && node.properties !== null
        ? (node.properties as Record<string, unknown>)
        : node;

    // Handle Neo4j DateTime object - it has toStandardDate() method
    let createdAt: Date;
    const rawCreatedAt = props.createdAt;
    if (rawCreatedAt && typeof rawCreatedAt === 'object' && 'toStandardDate' in rawCreatedAt) {
      createdAt = (rawCreatedAt as { toStandardDate: () => Date }).toStandardDate();
    } else if (rawCreatedAt instanceof Date) {
      createdAt = rawCreatedAt;
    } else if (typeof rawCreatedAt === 'string') {
      createdAt = new Date(rawCreatedAt);
    } else {
      createdAt = new Date(); // Fallback to now
    }

    return {
      normalizedForm: props.normalizedForm as string,
      rawForm: props.rawForm as string,
      usageCount: Number(props.usageCount) || 0,
      uniqueUsers: Number(props.uniqueUsers) || 0,
      paperCount: Number(props.paperCount) || 0,
      qualityScore: Number(props.qualityScore) || 0.5,
      spamScore: Number(props.spamScore) || 0,
      growthRate: Number(props.growthRate) || 0,
      createdAt,
    };
  }
}
