/**
 * Repository for facet usage history operations.
 *
 * @remarks
 * Provides operations for tracking and querying facet/tag usage
 * over time. Used for calculating trending scores with time windows.
 *
 * Time windows: day (today vs yesterday), week (last 7 days vs prior 7 days),
 * month (last 30 days vs prior 30 days).
 *
 * ATProto compliance: all data is AppView-specific (ephemeral); historical data
 * is derived from indexed tag applications; data can be rebuilt from
 * user_tags_index if needed.
 *
 * @example
 * ```typescript
 * const repo = new FacetUsageHistoryRepository(pool, logger);
 *
 * // Record daily snapshot
 * await repo.recordDailySnapshot('tag:machine-learning', 42, 15);
 *
 * // Calculate trending for a tag
 * const trending = await repo.calculateTrending('tag:machine-learning', 'week');
 * ```
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { Pool } from 'pg';

import { DatabaseError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Time window for trending calculation.
 *
 * @public
 */
export type TrendingTimeWindow = 'day' | 'week' | 'month';

/**
 * Usage snapshot for a facet on a specific date.
 *
 * @public
 */
export interface FacetUsageSnapshot {
  /** Facet/tag URI or identifier */
  facetUri: string;
  /** Date of the snapshot (UTC) */
  date: Date;
  /** Total usage count on this date */
  usageCount: number;
  /** Number of unique records using this facet */
  uniqueRecords: number;
}

/**
 * Result of trending calculation.
 *
 * @public
 */
export interface TrendingCalculation {
  /** Whether the facet is considered trending */
  trending: boolean;
  /** Growth rate between windows (0.2 = 20% growth) */
  growthRate: number;
  /** Average usage in recent window */
  recentAverage: number;
  /** Average usage in prior window */
  priorAverage: number;
}

/**
 * Options for batch recording snapshots.
 *
 * @public
 */
export interface BatchSnapshotOptions {
  /** Whether to use a transaction (default: true) */
  useTransaction?: boolean;
}

/**
 * Repository for facet usage history operations.
 *
 * @public
 */
export class FacetUsageHistoryRepository {
  private readonly pool: Pool;
  private readonly logger: ILogger;

  /**
   * Creates a new FacetUsageHistoryRepository.
   *
   * @param pool - PostgreSQL connection pool
   * @param logger - Logger instance
   */
  constructor(pool: Pool, logger: ILogger) {
    this.pool = pool;
    this.logger = logger;
  }

  /**
   * Records a daily usage snapshot for a facet.
   *
   * @param facetUri - Facet/tag URI or identifier
   * @param usageCount - Total usage count
   * @param uniqueRecords - Number of unique records
   * @param date - Date of snapshot (defaults to today)
   */
  async recordDailySnapshot(
    facetUri: string,
    usageCount: number,
    uniqueRecords: number,
    date: Date = new Date()
  ): Promise<void> {
    try {
      await this.pool.query(`SELECT upsert_facet_usage_snapshot($1, $2, $3, $4)`, [
        facetUri,
        date,
        usageCount,
        uniqueRecords,
      ]);

      this.logger.debug('Recorded facet usage snapshot', {
        facetUri,
        date: date.toISOString(),
        usageCount,
        uniqueRecords,
      });
    } catch (error) {
      throw new DatabaseError(
        'WRITE',
        `Failed to record facet usage snapshot: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Records multiple snapshots in a batch.
   *
   * @param snapshots - Array of snapshots to record
   * @param options - Batch options
   */
  async batchRecordSnapshots(
    snapshots: FacetUsageSnapshot[],
    options: BatchSnapshotOptions = {}
  ): Promise<void> {
    const { useTransaction = true } = options;

    if (snapshots.length === 0) {
      return;
    }

    const client = await this.pool.connect();
    try {
      if (useTransaction) {
        await client.query('BEGIN');
      }

      for (const snapshot of snapshots) {
        await client.query(`SELECT upsert_facet_usage_snapshot($1, $2, $3, $4)`, [
          snapshot.facetUri,
          snapshot.date,
          snapshot.usageCount,
          snapshot.uniqueRecords,
        ]);
      }

      if (useTransaction) {
        await client.query('COMMIT');
      }

      this.logger.info('Batch recorded facet usage snapshots', {
        count: snapshots.length,
      });
    } catch (error) {
      if (useTransaction) {
        await client.query('ROLLBACK');
      }
      throw new DatabaseError(
        'WRITE',
        `Failed to batch record facet snapshots: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    } finally {
      client.release();
    }
  }

  /**
   * Gets usage history for a facet.
   *
   * @param facetUri - Facet/tag URI or identifier
   * @param days - Number of days of history to retrieve
   * @returns Array of usage snapshots
   */
  async getUsageHistory(facetUri: string, days: number): Promise<FacetUsageSnapshot[]> {
    try {
      const result = await this.pool.query<{
        facet_uri: string;
        date: Date;
        usage_count: number;
        unique_records: number;
      }>(
        `SELECT facet_uri, date, usage_count, unique_records
         FROM facet_usage_history
         WHERE facet_uri = $1
           AND date > CURRENT_DATE - ($2 * INTERVAL '1 day')
         ORDER BY date DESC`,
        [facetUri, days]
      );

      return result.rows.map((row) => ({
        facetUri: row.facet_uri,
        date: row.date,
        usageCount: row.usage_count,
        uniqueRecords: row.unique_records,
      }));
    } catch (error) {
      throw new DatabaseError(
        'READ',
        `Failed to get facet usage history: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Calculates trending score for a facet.
   *
   * @param facetUri - Facet/tag URI or identifier
   * @param timeWindow - Time window for comparison
   * @returns Trending calculation result
   */
  async calculateTrending(
    facetUri: string,
    timeWindow: TrendingTimeWindow = 'week'
  ): Promise<TrendingCalculation> {
    const windowDays = this.getWindowDays(timeWindow);

    try {
      const result = await this.pool.query<{
        trending: boolean;
        growth_rate: string;
        recent_avg: string;
        prior_avg: string;
      }>(`SELECT * FROM calculate_facet_trending($1, $2)`, [facetUri, windowDays]);

      const row = result.rows[0];
      if (!row) {
        return {
          trending: false,
          growthRate: 0,
          recentAverage: 0,
          priorAverage: 0,
        };
      }

      return {
        trending: row.trending,
        growthRate: parseFloat(row.growth_rate) || 0,
        recentAverage: parseFloat(row.recent_avg) || 0,
        priorAverage: parseFloat(row.prior_avg) || 0,
      };
    } catch (error) {
      throw new DatabaseError(
        'READ',
        `Failed to calculate facet trending: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Calculates trending for multiple facets.
   *
   * @param facetUris - Array of facet URIs
   * @param timeWindow - Time window for comparison
   * @returns Map of facet URI to trending calculation
   */
  async batchCalculateTrending(
    facetUris: string[],
    timeWindow: TrendingTimeWindow = 'week'
  ): Promise<Map<string, TrendingCalculation>> {
    const results = new Map<string, TrendingCalculation>();

    // Process in parallel batches
    const batchSize = 50;
    for (let i = 0; i < facetUris.length; i += batchSize) {
      const batch = facetUris.slice(i, i + batchSize);
      const promises = batch.map(async (uri) => {
        const result = await this.calculateTrending(uri, timeWindow);
        return { uri, result };
      });

      const batchResults = await Promise.all(promises);
      for (const { uri, result } of batchResults) {
        results.set(uri, result);
      }
    }

    return results;
  }

  /**
   * Gets top trending facets.
   *
   * @param timeWindow - Time window for comparison
   * @param limit - Maximum number of results
   * @param minUsage - Minimum usage count to consider
   * @returns Array of facet URIs with trending calculations
   */
  async getTopTrending(
    timeWindow: TrendingTimeWindow = 'week',
    limit = 20,
    minUsage = 5
  ): Promise<{ facetUri: string; trending: TrendingCalculation }[]> {
    const windowDays = this.getWindowDays(timeWindow);

    try {
      // Get facets with recent activity
      const facetsResult = await this.pool.query<{ facet_uri: string }>(
        `SELECT DISTINCT facet_uri
         FROM facet_usage_history
         WHERE date > CURRENT_DATE - ($1 * INTERVAL '1 day')
         GROUP BY facet_uri
         HAVING SUM(usage_count) >= $2`,
        [windowDays, minUsage]
      );

      const facetUris = facetsResult.rows.map((r) => r.facet_uri);

      // Calculate trending for each
      const trendingMap = await this.batchCalculateTrending(facetUris, timeWindow);

      // Sort by growth rate and filter to trending only
      const trending = Array.from(trendingMap.entries())
        .filter(([, calc]) => calc.trending)
        .sort((a, b) => b[1].growthRate - a[1].growthRate)
        .slice(0, limit)
        .map(([facetUri, calc]) => ({ facetUri, trending: calc }));

      return trending;
    } catch (error) {
      throw new DatabaseError(
        'READ',
        `Failed to get top trending facets: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Cleans up old history entries.
   *
   * @param retentionDays - Number of days to retain (default: 90)
   * @returns Number of deleted rows
   */
  async cleanupOldHistory(retentionDays = 90): Promise<number> {
    try {
      const result = await this.pool.query(
        `DELETE FROM facet_usage_history
         WHERE date < CURRENT_DATE - ($1 * INTERVAL '1 day')`,
        [retentionDays]
      );

      const deletedCount = result.rowCount ?? 0;

      this.logger.info('Cleaned up old facet usage history', {
        retentionDays,
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      throw new DatabaseError(
        'DELETE',
        `Failed to cleanup old history: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Converts time window to number of days.
   */
  private getWindowDays(timeWindow: TrendingTimeWindow): number {
    switch (timeWindow) {
      case 'day':
        return 1;
      case 'week':
        return 7;
      case 'month':
        return 30;
      default:
        return 7;
    }
  }
}
