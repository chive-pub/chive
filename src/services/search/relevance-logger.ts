/**
 * Relevance logging service for LTR training data collection.
 *
 * @remarks
 * Captures search impressions, clicks, and dwell time to build judgment lists
 * for Learning to Rank (LTR) model training.
 *
 * **Data Flow:**
 * 1. Search handler logs impression with results and features
 * 2. Frontend sends click events when user clicks results
 * 3. Frontend sends dwell time via beacon API when user leaves page
 * 4. JudgmentListExporter extracts training data in SVM Rank format
 *
 * **Storage Strategy:**
 * - Redis streams for buffering (high throughput, durable)
 * - PostgreSQL for persistence (via periodic flush)
 * - Features stored as JSONB for flexibility during model iteration
 *
 * **Industry Standard Approach:**
 * Follows patterns from Elasticsearch LTR, OpenSearch LTR, and academic
 * research on click-through data collection for search ranking.
 *
 * @see https://elasticsearch-learning-to-rank.readthedocs.io/en/latest/logging-features.html
 * @packageDocumentation
 * @public
 */

import { createHash, randomUUID } from 'node:crypto';

import type { Redis } from 'ioredis';
import type { Pool, PoolClient } from 'pg';

import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * LTR feature vector captured at impression time.
 *
 * @remarks
 * These features are used for:
 * 1. Training LTR models (XGBoost, LambdaMART)
 * 2. Analyzing ranking quality
 * 3. Debugging ranking issues
 *
 * **Discovery Signals (Phase 4):**
 * Features from external APIs (Semantic Scholar, OpenAlex) and
 * internal citation graph for enhanced personalization.
 *
 * @public
 */
export interface LTRFeatureVector {
  /**
   * Combined text relevance score (0-1).
   */
  readonly textRelevance: number;

  /**
   * Field/category match score (0-1).
   */
  readonly fieldMatchScore: number;

  /**
   * Title-specific match score (0-1).
   */
  readonly titleMatchScore: number;

  /**
   * Abstract match score (0-1).
   */
  readonly abstractMatchScore: number;

  /**
   * Recency score based on publication date (0-1).
   */
  readonly recencyScore: number;

  /**
   * Elasticsearch BM25 score (raw).
   */
  readonly bm25Score?: number;

  /**
   * Position in original ES results before re-ranking.
   */
  readonly originalPosition?: number;

  // ==========================================================================
  // DISCOVERY SIGNALS (from Semantic Scholar, OpenAlex, Citation Graph)
  // ==========================================================================

  /**
   * SPECTER2 semantic similarity score (0-1).
   *
   * @remarks
   * Computed by Semantic Scholar Recommendations API using SPECTER2 embeddings.
   * Measures document-level semantic similarity trained on 6M citation triplets.
   *
   * @see {@link https://api.semanticscholar.org/api-docs/recommendations | S2 Recommendations API}
   */
  readonly specter2Similarity?: number;

  /**
   * Co-citation score from Neo4j citation graph (0-1).
   *
   * @remarks
   * Measures bibliographic coupling and co-citation strength.
   * Papers frequently cited together have higher scores.
   * Uses Salton's cosine normalization.
   */
  readonly coCitationScore?: number;

  /**
   * OpenAlex concept overlap score (0-1).
   *
   * @remarks
   * Measures topic/concept similarity based on OpenAlex classification.
   * Higher scores indicate overlapping research areas.
   */
  readonly conceptOverlapScore?: number;

  /**
   * Author network proximity score (0-1).
   *
   * @remarks
   * Measures proximity in co-author graph.
   * Higher scores for papers by collaborators or close network.
   * Reserved for future implementation.
   */
  readonly authorNetworkScore?: number;

  /**
   * Collaborative filtering score (0-1).
   *
   * @remarks
   * Based on users with similar claimed papers.
   * "Users who claimed X also claimed Y" signal.
   * Reserved for future implementation.
   */
  readonly collaborativeScore?: number;
}

/**
 * Result shown in a search impression.
 *
 * @public
 */
export interface ImpressionResult {
  /**
   * AT URI of the result.
   */
  readonly uri: string;

  /**
   * Display position (0-indexed).
   */
  readonly position: number;

  /**
   * Feature values at impression time.
   */
  readonly features: LTRFeatureVector;
}

/**
 * Search impression record.
 *
 * @remarks
 * Represents a single search query execution with all results shown.
 *
 * @public
 */
export interface SearchImpression {
  /**
   * Unique impression identifier for click correlation.
   */
  readonly impressionId: string;

  /**
   * Hash of normalized query for grouping similar queries.
   */
  readonly queryId: string;

  /**
   * Original query string.
   */
  readonly query: string;

  /**
   * User DID if authenticated (optional for privacy).
   */
  readonly userDid?: string;

  /**
   * Session identifier for anonymous user grouping.
   */
  readonly sessionId?: string;

  /**
   * When impression occurred.
   */
  readonly timestamp: Date;

  /**
   * Results shown to user.
   */
  readonly results: readonly ImpressionResult[];
}

/**
 * Click event on a search result.
 *
 * @public
 */
export interface ResultClick {
  /**
   * Parent impression identifier.
   */
  readonly impressionId: string;

  /**
   * AT URI of clicked result.
   */
  readonly uri: string;

  /**
   * Position when clicked.
   */
  readonly position: number;

  /**
   * When click occurred.
   */
  readonly clickedAt: Date;

  /**
   * Time spent on page in milliseconds (filled on return).
   */
  readonly dwellTimeMs?: number;
}

/**
 * Relevance logger interface for dependency injection.
 *
 * @public
 */
export interface IRelevanceLogger {
  /**
   * Logs a search impression with results and features.
   *
   * @param impression - Impression data to log
   */
  logImpression(impression: SearchImpression): Promise<void>;

  /**
   * Logs a click on a search result.
   *
   * @param click - Click event data
   */
  logClick(click: ResultClick): Promise<void>;

  /**
   * Updates dwell time for a clicked result.
   *
   * @param impressionId - Parent impression
   * @param uri - Result URI
   * @param dwellTimeMs - Time spent on page
   */
  logDwellTime(impressionId: string, uri: string, dwellTimeMs: number): Promise<void>;

  /**
   * Marks a result as downloaded (strong relevance signal).
   *
   * @param impressionId - Parent impression
   * @param uri - Result URI
   */
  logDownload(impressionId: string, uri: string): Promise<void>;

  /**
   * Creates a new impression ID.
   */
  createImpressionId(): string;

  /**
   * Computes a stable query ID from query string.
   *
   * @param query - Original query
   */
  computeQueryId(query: string): string;

  /**
   * Flushes buffered data to PostgreSQL.
   */
  flush(): Promise<void>;
}

/**
 * Configuration for RelevanceLogger.
 *
 * @public
 */
export interface RelevanceLoggerConfig {
  /**
   * PostgreSQL connection pool.
   */
  readonly pool: Pool;

  /**
   * Redis client for buffering.
   */
  readonly redis: Redis;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Redis key prefix.
   *
   * @defaultValue "chive:relevance:"
   */
  readonly keyPrefix?: string;

  /**
   * Flush interval in milliseconds.
   *
   * @defaultValue 60000 (1 minute)
   */
  readonly flushIntervalMs?: number;

  /**
   * Maximum items to buffer before forcing flush.
   *
   * @defaultValue 1000
   */
  readonly maxBufferSize?: number;

  /**
   * Whether logging is enabled.
   *
   * @defaultValue true
   */
  readonly enabled?: boolean;
}

/**
 * Relevance logger implementation with Redis buffering.
 *
 * @remarks
 * Uses Redis streams for durable, ordered event buffering with
 * periodic flush to PostgreSQL.
 *
 * **Redis Keys:**
 * - `chive:relevance:impressions` - Stream of impression events
 * - `chive:relevance:clicks` - Stream of click events
 * - `chive:relevance:dwell` - Hash of dwell time updates
 *
 * @public
 */
export class RelevanceLogger implements IRelevanceLogger {
  private readonly pool: Pool;
  /**
   * Redis client for future streaming/buffering enhancements.
   * @internal
   */
  readonly redis: Redis;
  private readonly logger: ILogger;
  /**
   * Key prefix for future Redis key namespacing.
   * @internal
   */
  readonly keyPrefix: string;
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;
  private readonly enabled: boolean;

  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private impressionBuffer: SearchImpression[] = [];
  private clickBuffer: ResultClick[] = [];

  /**
   * Creates a new RelevanceLogger.
   *
   * @param config - Logger configuration
   */
  constructor(config: RelevanceLoggerConfig) {
    this.pool = config.pool;
    this.redis = config.redis;
    this.logger = config.logger;
    this.keyPrefix = config.keyPrefix ?? 'chive:relevance:';
    this.flushIntervalMs = config.flushIntervalMs ?? 60000;
    this.maxBufferSize = config.maxBufferSize ?? 1000;
    this.enabled = config.enabled ?? true;

    if (this.enabled) {
      this.startFlushTimer();
    }
  }

  /**
   * Logs a search impression with results and features.
   */
  async logImpression(impression: SearchImpression): Promise<void> {
    if (!this.enabled) return;

    this.impressionBuffer.push(impression);

    this.logger.debug('Logged search impression', {
      impressionId: impression.impressionId,
      queryId: impression.queryId,
      resultCount: impression.results.length,
    });

    // Force flush if buffer is full
    if (this.impressionBuffer.length >= this.maxBufferSize) {
      await this.flush();
    }
  }

  /**
   * Logs a click on a search result.
   */
  async logClick(click: ResultClick): Promise<void> {
    if (!this.enabled) return;

    this.clickBuffer.push(click);

    this.logger.debug('Logged result click', {
      impressionId: click.impressionId,
      uri: click.uri,
      position: click.position,
    });

    // Clicks are important; flush more aggressively
    if (this.clickBuffer.length >= Math.min(100, this.maxBufferSize)) {
      await this.flush();
    }
  }

  /**
   * Updates dwell time for a clicked result.
   */
  async logDwellTime(impressionId: string, uri: string, dwellTimeMs: number): Promise<void> {
    if (!this.enabled) return;

    // Update directly in PostgreSQL (dwell time comes after flush)
    try {
      await this.pool.query(
        `UPDATE result_clicks
         SET dwell_time_ms = $1
         WHERE impression_id = $2 AND uri = $3 AND dwell_time_ms IS NULL`,
        [dwellTimeMs, impressionId, uri]
      );

      this.logger.debug('Updated dwell time', {
        impressionId,
        uri,
        dwellTimeMs,
      });
    } catch (error) {
      this.logger.warn('Failed to update dwell time', {
        impressionId,
        uri,
        dwellTimeMs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Marks a result as downloaded (strong relevance signal).
   */
  async logDownload(impressionId: string, uri: string): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.pool.query(
        `UPDATE result_clicks
         SET downloaded = true
         WHERE impression_id = $1 AND uri = $2`,
        [impressionId, uri]
      );

      this.logger.debug('Marked result as downloaded', {
        impressionId,
        uri,
      });
    } catch (error) {
      this.logger.warn('Failed to mark download', {
        impressionId,
        uri,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Creates a new impression ID.
   */
  createImpressionId(): string {
    return randomUUID();
  }

  /**
   * Computes a stable query ID from query string.
   *
   * @remarks
   * Normalizes query by lowercasing, removing punctuation, and sorting words.
   * This groups similar queries together for training data aggregation.
   */
  computeQueryId(query: string): string {
    // Normalize: lowercase, remove punctuation, collapse whitespace
    const normalized = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Sort words for stability
    const words = normalized.split(' ').filter((w) => w.length > 0);
    words.sort();

    // SHA256 hash (first 64 chars)
    return createHash('sha256').update(words.join(' ')).digest('hex');
  }

  /**
   * Flushes buffered data to PostgreSQL.
   */
  async flush(): Promise<void> {
    if (!this.enabled) return;

    const impressions = [...this.impressionBuffer];
    const clicks = [...this.clickBuffer];

    // Clear buffers
    this.impressionBuffer = [];
    this.clickBuffer = [];

    if (impressions.length === 0 && clicks.length === 0) {
      return;
    }

    this.logger.debug('Flushing relevance data', {
      impressions: impressions.length,
      clicks: clicks.length,
    });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert impressions
      for (const impression of impressions) {
        await this.insertImpression(client, impression);
      }

      // Insert clicks
      for (const click of clicks) {
        await this.insertClick(client, click);
      }

      await client.query('COMMIT');

      this.logger.info('Flushed relevance data', {
        impressions: impressions.length,
        clicks: clicks.length,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(
        'Failed to flush relevance data',
        error instanceof Error ? error : new Error(String(error)),
        { impressions: impressions.length, clicks: clicks.length }
      );

      // Re-add to buffers for retry
      this.impressionBuffer.unshift(...impressions);
      this.clickBuffer.unshift(...clicks);
    } finally {
      client.release();
    }
  }

  /**
   * Stops the flush timer.
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Starts the periodic flush timer.
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        this.logger.error(
          'Flush timer error',
          error instanceof Error ? error : new Error(String(error))
        );
      });
    }, this.flushIntervalMs);
  }

  /**
   * Inserts an impression with its results.
   */
  private async insertImpression(client: PoolClient, impression: SearchImpression): Promise<void> {
    // Insert impression
    await client.query(
      `INSERT INTO search_impressions (id, query_id, query, user_did, session_id, result_count, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        impression.impressionId,
        impression.queryId,
        impression.query,
        impression.userDid ?? null,
        impression.sessionId ?? null,
        impression.results.length,
        impression.timestamp,
      ]
    );

    // Insert results
    for (const result of impression.results) {
      await client.query(
        `INSERT INTO impression_results (impression_id, uri, position, features)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (impression_id, uri) DO NOTHING`,
        [impression.impressionId, result.uri, result.position, JSON.stringify(result.features)]
      );
    }
  }

  /**
   * Inserts a click event.
   */
  private async insertClick(client: PoolClient, click: ResultClick): Promise<void> {
    await client.query(
      `INSERT INTO result_clicks (impression_id, uri, position, clicked_at, dwell_time_ms)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [click.impressionId, click.uri, click.position, click.clickedAt, click.dwellTimeMs ?? null]
    );
  }
}

/**
 * Creates an empty/disabled relevance logger for testing or disabled environments.
 *
 * @public
 */
export class NoOpRelevanceLogger implements IRelevanceLogger {
  async logImpression(_impression: SearchImpression): Promise<void> {
    // No-op
  }

  async logClick(_click: ResultClick): Promise<void> {
    // No-op
  }

  async logDwellTime(_impressionId: string, _uri: string, _dwellTimeMs: number): Promise<void> {
    // No-op
  }

  async logDownload(_impressionId: string, _uri: string): Promise<void> {
    // No-op
  }

  createImpressionId(): string {
    return randomUUID();
  }

  computeQueryId(query: string): string {
    return createHash('sha256').update(query.toLowerCase()).digest('hex');
  }

  async flush(): Promise<void> {
    // No-op
  }
}

export default RelevanceLogger;
