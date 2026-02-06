/**
 * Tag spam detection using rule-based heuristics.
 *
 * @remarks
 * Provides spam detection for user-generated tags to maintain quality
 * in the knowledge graph. Uses multiple rule-based heuristics combined
 * into a final spam score.
 *
 * Heuristics include:
 * - Single user dominance (one user creating most uses)
 * - Nonsense characters or excessive length
 * - URL patterns or promotional language
 * - Low diversity (few papers, many uses)
 * - Burst creation (many tags in short time)
 *
 * ATProto Compliance:
 * - Only affects AppView quality scores (ephemeral indexes)
 * - Never modifies user PDS data
 * - Users retain full ownership of their tag records
 *
 * @packageDocumentation
 * @public
 */

import type { ILogger } from '../../types/interfaces/logger.interface.js';

import type { Neo4jConnection } from './connection.js';

/**
 * Tag usage statistics from the graph.
 *
 * @public
 */
export interface TagUsageStats {
  /**
   * Normalized form of the tag.
   */
  normalizedForm: string;

  /**
   * Display form (original casing).
   */
  displayForm: string;

  /**
   * Total number of times this tag was applied.
   */
  usageCount: number;

  /**
   * Number of unique users who used this tag.
   */
  uniqueUsers: number;

  /**
   * Number of unique eprints tagged.
   */
  uniqueEprints: number;

  /**
   * Timestamp of first use.
   */
  createdAt: Date;

  /**
   * Timestamp of last use.
   */
  lastUsedAt: Date;

  /**
   * List of DIDs that have used this tag.
   */
  userDids?: string[];

  /**
   * Usage count per user (for dominance detection).
   */
  usageByUser?: Map<string, number>;
}

/**
 * Spam detection result.
 *
 * @public
 */
export interface SpamDetectionResult {
  /**
   * Final spam score (0-1, higher = more likely spam).
   */
  spamScore: number;

  /**
   * Whether the tag is classified as spam (score >= threshold).
   */
  isSpam: boolean;

  /**
   * Individual rule scores.
   */
  ruleScores: {
    /**
     * Single user dominance score.
     */
    userDominance: number;

    /**
     * Nonsense/character pattern score.
     */
    nonsensePattern: number;

    /**
     * URL/promotional pattern score.
     */
    promotionalPattern: number;

    /**
     * Low diversity score.
     */
    lowDiversity: number;

    /**
     * Burst creation score.
     */
    burstCreation: number;
  };

  /**
   * Reasons why this tag was flagged.
   */
  reasons: string[];
}

/**
 * Configuration for the spam detector.
 *
 * @public
 */
export interface TagSpamDetectorConfig {
  /**
   * Threshold for classifying as spam (0-1).
   *
   * @defaultValue 0.7
   */
  spamThreshold?: number;

  /**
   * Minimum usage count before spam detection applies.
   *
   * @defaultValue 3
   */
  minUsageForDetection?: number;

  /**
   * User dominance threshold (percentage).
   *
   * @defaultValue 0.8
   */
  userDominanceThreshold?: number;

  /**
   * Maximum tag length before flagging.
   *
   * @defaultValue 50
   */
  maxTagLength?: number;

  /**
   * Burst detection window in hours.
   *
   * @defaultValue 1
   */
  burstWindowHours?: number;

  /**
   * Burst threshold (tags per window).
   *
   * @defaultValue 10
   */
  burstThreshold?: number;
}

/**
 * Options for creating a TagSpamDetector.
 *
 * @public
 */
export interface TagSpamDetectorOptions {
  /**
   * Neo4j connection.
   */
  connection: Neo4jConnection;

  /**
   * Logger instance.
   */
  logger: ILogger;

  /**
   * Configuration options.
   */
  config?: TagSpamDetectorConfig;
}

/**
 * Rule-based tag spam detector.
 *
 * @remarks
 * Analyzes tag usage patterns to detect potential spam or abuse.
 * Combines multiple heuristic rules into a final spam score.
 *
 * @example
 * ```typescript
 * const detector = new TagSpamDetector({
 *   connection,
 *   logger,
 *   config: { spamThreshold: 0.7 },
 * });
 *
 * const result = await detector.detectSpam('free-money-now');
 * if (result.isSpam) {
 *   console.log('Spam detected:', result.reasons);
 * }
 * ```
 *
 * @public
 */
export class TagSpamDetector {
  private readonly connection: Neo4jConnection;
  private readonly logger: ILogger;
  private readonly config: Required<TagSpamDetectorConfig>;

  /**
   * Promotional/spam keywords to check for.
   */
  private static readonly PROMOTIONAL_KEYWORDS = [
    'buy',
    'free',
    'discount',
    'sale',
    'offer',
    'deal',
    'cheap',
    'price',
    'money',
    'earn',
    'win',
    'click',
    'subscribe',
    'follow',
    'promo',
    'limited',
    'exclusive',
    'download',
  ];

  /**
   * Patterns indicating URLs or links.
   */
  private static readonly URL_PATTERNS = [
    /https?:\/\//i,
    /www\./i,
    /\.com$/i,
    /\.net$/i,
    /\.org$/i,
    /\.io$/i,
    /bit\.ly/i,
    /t\.co/i,
    /goo\.gl/i,
  ];

  /**
   * Patterns indicating nonsense tags.
   */
  private static readonly NONSENSE_PATTERNS = [
    /^[^a-z]*$/i, // No letters at all
    /(.)\1{4,}/, // Same character repeated 5+ times
    /^[0-9]+$/, // Only numbers
    /[^\w\s-]/g, // Many special characters
  ];

  /**
   * Creates a new TagSpamDetector.
   *
   * @param options - Detector options
   */
  constructor(options: TagSpamDetectorOptions) {
    this.connection = options.connection;
    this.logger = options.logger.child({ service: 'TagSpamDetector' });
    this.config = {
      spamThreshold: options.config?.spamThreshold ?? 0.7,
      minUsageForDetection: options.config?.minUsageForDetection ?? 3,
      userDominanceThreshold: options.config?.userDominanceThreshold ?? 0.8,
      maxTagLength: options.config?.maxTagLength ?? 50,
      burstWindowHours: options.config?.burstWindowHours ?? 1,
      burstThreshold: options.config?.burstThreshold ?? 10,
    };
  }

  /**
   * Detects spam for a tag.
   *
   * @param normalizedTag - Normalized tag form
   * @returns Spam detection result
   */
  async detectSpam(normalizedTag: string): Promise<SpamDetectionResult> {
    const stats = await this.getTagStats(normalizedTag);

    if (!stats) {
      return this.createDefaultResult();
    }

    // Skip detection for tags with low usage
    if (stats.usageCount < this.config.minUsageForDetection) {
      return this.createDefaultResult();
    }

    const reasons: string[] = [];
    const ruleScores = {
      userDominance: this.checkUserDominance(stats, reasons),
      nonsensePattern: this.checkNonsensePattern(stats.displayForm, reasons),
      promotionalPattern: this.checkPromotionalPattern(stats.displayForm, reasons),
      lowDiversity: this.checkLowDiversity(stats, reasons),
      burstCreation: await this.checkBurstCreation(normalizedTag, reasons),
    };

    // Weighted combination of scores
    const spamScore =
      ruleScores.userDominance * 0.3 +
      ruleScores.nonsensePattern * 0.2 +
      ruleScores.promotionalPattern * 0.25 +
      ruleScores.lowDiversity * 0.15 +
      ruleScores.burstCreation * 0.1;

    const isSpam = spamScore >= this.config.spamThreshold;

    if (isSpam) {
      this.logger.info('Spam tag detected', {
        tag: normalizedTag,
        spamScore,
        reasons,
      });
    }

    return {
      spamScore,
      isSpam,
      ruleScores,
      reasons,
    };
  }

  /**
   * Batch detect spam for multiple tags.
   *
   * @param tags - Array of normalized tags
   * @returns Map of tag to detection result
   */
  async batchDetectSpam(tags: string[]): Promise<Map<string, SpamDetectionResult>> {
    const results = new Map<string, SpamDetectionResult>();

    // Process in parallel with limited concurrency
    const batchSize = 10;
    for (let i = 0; i < tags.length; i += batchSize) {
      const batch = tags.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((tag) => this.detectSpam(tag)));

      for (let j = 0; j < batch.length; j++) {
        const tag = batch[j];
        const result = batchResults[j];
        if (tag && result) {
          results.set(tag, result);
        }
      }
    }

    return results;
  }

  /**
   * Gets tag usage statistics from Neo4j.
   *
   * @param normalizedTag - Normalized tag form
   * @returns Tag statistics or null if not found
   */
  private async getTagStats(normalizedTag: string): Promise<TagUsageStats | null> {
    const query = `
      MATCH (tag:UserTag {normalizedForm: $normalizedTag})
      OPTIONAL MATCH (tag)<-[:TAGGED_WITH]-(p:Node:Object:Eprint)
      WHERE p.subkind = 'eprint'
      OPTIONAL MATCH (u:User)-[:CREATED_TAG]->(tag)
      WITH tag,
           count(DISTINCT p) as uniqueEprints,
           collect(DISTINCT u.did) as userDids
      RETURN tag.normalizedForm as normalizedForm,
             tag.displayForm as displayForm,
             tag.usageCount as usageCount,
             tag.uniqueUsers as uniqueUsers,
             uniqueEprints,
             tag.createdAt as createdAt,
             tag.lastUsedAt as lastUsedAt,
             userDids
    `;

    try {
      const result = await this.connection.executeQuery<{
        normalizedForm: string;
        displayForm: string;
        usageCount: number;
        uniqueUsers: number;
        uniqueEprints: number;
        createdAt: Date;
        lastUsedAt: Date;
        userDids: string[];
      }>(query, { normalizedTag });

      const record = result.records[0];
      if (!record) {
        return null;
      }

      // Neo4j may return Date objects or ISO strings depending on driver version
      const createdAtRaw = record.get('createdAt');
      const lastUsedAtRaw = record.get('lastUsedAt');

      return {
        normalizedForm: record.get('normalizedForm'),
        displayForm: record.get('displayForm'),
        usageCount: record.get('usageCount'),
        uniqueUsers: record.get('uniqueUsers'),
        uniqueEprints: record.get('uniqueEprints'),
        createdAt: createdAtRaw instanceof Date ? createdAtRaw : new Date(String(createdAtRaw)),
        lastUsedAt: lastUsedAtRaw instanceof Date ? lastUsedAtRaw : new Date(String(lastUsedAtRaw)),
        userDids: record.get('userDids'),
      };
    } catch (error) {
      this.logger.warn('Failed to get tag stats', {
        tag: normalizedTag,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Checks for single user dominance.
   *
   * @param stats - Tag usage statistics
   * @param reasons - Array to add reasons to
   * @returns Dominance score (0-1)
   */
  private checkUserDominance(stats: TagUsageStats, reasons: string[]): number {
    if (stats.uniqueUsers === 0 || stats.usageCount === 0) {
      return 0;
    }

    // Calculate dominance ratio
    const dominanceRatio = 1 - stats.uniqueUsers / stats.usageCount;

    // If one user created > threshold of all uses
    if (dominanceRatio >= this.config.userDominanceThreshold) {
      reasons.push(`Single user dominance: ${(dominanceRatio * 100).toFixed(0)}% of uses`);
      return dominanceRatio;
    }

    return dominanceRatio * 0.5; // Partial score
  }

  /**
   * Checks for nonsense patterns.
   *
   * @param displayForm - Tag display form
   * @param reasons - Array to add reasons to
   * @returns Nonsense score (0-1)
   */
  private checkNonsensePattern(displayForm: string, reasons: string[]): number {
    let score = 0;

    // Check length
    if (displayForm.length > this.config.maxTagLength) {
      score += 0.4;
      reasons.push(`Excessive length: ${displayForm.length} characters`);
    }

    // Check for nonsense patterns
    for (const pattern of TagSpamDetector.NONSENSE_PATTERNS) {
      if (pattern.test(displayForm)) {
        score += 0.3;
        reasons.push('Nonsense character pattern detected');
        break;
      }
    }

    // Check for excessive non-alphabetic characters
    const nonAlphaRatio = displayForm.replace(/[a-z]/gi, '').length / displayForm.length;
    if (nonAlphaRatio > 0.5) {
      score += 0.3;
      reasons.push('High non-alphabetic character ratio');
    }

    return Math.min(score, 1);
  }

  /**
   * Checks for promotional/URL patterns.
   *
   * @param displayForm - Tag display form
   * @param reasons - Array to add reasons to
   * @returns Promotional score (0-1)
   */
  private checkPromotionalPattern(displayForm: string, reasons: string[]): number {
    let score = 0;
    const lowerForm = displayForm.toLowerCase();

    // Check for URL patterns
    for (const pattern of TagSpamDetector.URL_PATTERNS) {
      if (pattern.test(displayForm)) {
        score += 0.6;
        reasons.push('URL pattern detected');
        break;
      }
    }

    // Check for promotional keywords
    const matchedKeywords = TagSpamDetector.PROMOTIONAL_KEYWORDS.filter((keyword) =>
      lowerForm.includes(keyword)
    );

    if (matchedKeywords.length > 0) {
      score += Math.min(matchedKeywords.length * 0.2, 0.6);
      reasons.push(`Promotional keywords: ${matchedKeywords.join(', ')}`);
    }

    return Math.min(score, 1);
  }

  /**
   * Checks for low diversity (many uses, few targets).
   *
   * @param stats - Tag usage statistics
   * @param reasons - Array to add reasons to
   * @returns Low diversity score (0-1)
   */
  private checkLowDiversity(stats: TagUsageStats, reasons: string[]): number {
    if (stats.usageCount < 5) {
      return 0; // Not enough data
    }

    // Ratio of unique eprints to total uses
    const diversityRatio = stats.uniqueEprints / stats.usageCount;

    if (diversityRatio < 0.2) {
      reasons.push(`Low diversity: ${stats.uniqueEprints} eprints for ${stats.usageCount} uses`);
      return 1 - diversityRatio;
    }

    return (1 - diversityRatio) * 0.5;
  }

  /**
   * Checks for burst creation (many tags in short time).
   *
   * @param normalizedTag - Normalized tag form
   * @param reasons - Array to add reasons to
   * @returns Burst score (0-1)
   */
  private async checkBurstCreation(normalizedTag: string, reasons: string[]): Promise<number> {
    const windowMs = this.config.burstWindowHours * 60 * 60 * 1000;
    const windowStart = new Date(Date.now() - windowMs);

    const query = `
      MATCH (tag:UserTag {normalizedForm: $normalizedTag})<-[r:TAGGED_WITH]-()
      WHERE r.createdAt >= datetime($windowStart)
      RETURN count(r) as recentCount
    `;

    try {
      const result = await this.connection.executeQuery<{ recentCount: number }>(query, {
        normalizedTag,
        windowStart: windowStart.toISOString(),
      });

      const record = result.records[0];
      const recentCount = record ? record.get('recentCount') : 0;

      if (recentCount >= this.config.burstThreshold) {
        reasons.push(
          `Burst creation: ${recentCount} uses in ${this.config.burstWindowHours} hour(s)`
        );
        return Math.min(recentCount / this.config.burstThreshold, 1);
      }

      return 0;
    } catch (error) {
      this.logger.warn('Failed to check burst creation', {
        tag: normalizedTag,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Creates a default (non-spam) result.
   *
   * @returns Default detection result
   */
  private createDefaultResult(): SpamDetectionResult {
    return {
      spamScore: 0,
      isSpam: false,
      ruleScores: {
        userDominance: 0,
        nonsensePattern: 0,
        promotionalPattern: 0,
        lowDiversity: 0,
        burstCreation: 0,
      },
      reasons: [],
    };
  }
}
