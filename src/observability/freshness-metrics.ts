/**
 * Freshness metrics collection.
 *
 * @remarks
 * Tracks metrics for the freshness system including:
 * - Record staleness distribution
 * - Freshness checks performed
 * - Refreshes triggered
 * - Deletions detected
 * - PDS errors
 *
 * **Metrics Categories:**
 * - Staleness: How fresh are indexed records
 * - Operations: What the freshness system is doing
 * - Errors: Problems encountered
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * Freshness metrics snapshot.
 *
 * @public
 */
export interface FreshnessMetricsSnapshot {
  /**
   * Timestamp of metrics collection.
   */
  readonly timestamp: Date;

  /**
   * Record staleness distribution.
   */
  readonly staleness: {
    /** Records synced within 24 hours */
    readonly under24h: number;
    /** Records synced within 7 days */
    readonly under7d: number;
    /** Records synced over 7 days ago */
    readonly over7d: number;
    /** Total active records */
    readonly total: number;
  };

  /**
   * Operation counts.
   */
  readonly operations: {
    /** Total freshness checks performed */
    readonly checksPerformed: number;
    /** Records refreshed (content changed) */
    readonly refreshesTriggered: number;
    /** Records confirmed unchanged */
    readonly recordsUnchanged: number;
    /** Deletions detected from PDS */
    readonly deletionsDetected: number;
  };

  /**
   * Error counts.
   */
  readonly errors: {
    /** PDS connection/fetch errors */
    readonly pdsErrors: number;
    /** Rate limit hits */
    readonly rateLimitHits: number;
    /** Other errors */
    readonly otherErrors: number;
  };

  /**
   * PDS health summary.
   */
  readonly pdsHealth: {
    /** Number of healthy PDSes */
    readonly healthy: number;
    /** Number of unhealthy PDSes */
    readonly unhealthy: number;
    /** Average error rate across PDSes */
    readonly avgErrorRate: number;
  };
}

/**
 * Freshness metrics collector configuration.
 *
 * @public
 */
export interface FreshnessMetricsConfig {
  /**
   * PostgreSQL connection pool.
   */
  readonly pool: Pool;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Staleness thresholds.
   */
  readonly thresholds?: {
    /** 24-hour threshold in ms */
    readonly recent: number;
    /** 7-day threshold in ms */
    readonly normal: number;
  };
}

/**
 * Freshness metrics collector.
 *
 * @remarks
 * Collects and aggregates metrics about the freshness system.
 * Can be called periodically or on-demand.
 *
 * @example
 * ```typescript
 * const collector = new FreshnessMetricsCollector({
 *   pool,
 *   logger,
 * });
 *
 * const metrics = await collector.collect();
 * console.log(`${metrics.staleness.under24h} records fresh`);
 * ```
 *
 * @public
 */
export class FreshnessMetricsCollector {
  private readonly pool: Pool;
  private readonly logger: ILogger;
  private readonly thresholds: { recent: number; normal: number };

  // Operation counters (in-memory, reset periodically)
  private checksPerformed = 0;
  private refreshesTriggered = 0;
  private recordsUnchanged = 0;
  private deletionsDetected = 0;
  private pdsErrors = 0;
  private rateLimitHits = 0;
  private otherErrors = 0;

  constructor(config: FreshnessMetricsConfig) {
    this.pool = config.pool;
    this.logger = config.logger.child({ service: 'freshness-metrics' });
    this.thresholds = {
      recent: config.thresholds?.recent ?? 24 * 60 * 60 * 1000,
      normal: config.thresholds?.normal ?? 7 * 24 * 60 * 60 * 1000,
    };
  }

  /**
   * Collects current freshness metrics.
   *
   * @returns Metrics snapshot
   */
  async collect(): Promise<FreshnessMetricsSnapshot> {
    const now = new Date();

    try {
      const [stalenessStats, pdsHealthStats] = await Promise.all([
        this.collectStalenessStats(),
        this.collectPDSHealthStats(),
      ]);

      return {
        timestamp: now,
        staleness: stalenessStats,
        operations: {
          checksPerformed: this.checksPerformed,
          refreshesTriggered: this.refreshesTriggered,
          recordsUnchanged: this.recordsUnchanged,
          deletionsDetected: this.deletionsDetected,
        },
        errors: {
          pdsErrors: this.pdsErrors,
          rateLimitHits: this.rateLimitHits,
          otherErrors: this.otherErrors,
        },
        pdsHealth: pdsHealthStats,
      };
    } catch (error) {
      this.logger.error(
        'Error collecting freshness metrics',
        error instanceof Error ? error : undefined
      );

      // Return empty metrics on error
      return {
        timestamp: now,
        staleness: { under24h: 0, under7d: 0, over7d: 0, total: 0 },
        operations: {
          checksPerformed: this.checksPerformed,
          refreshesTriggered: this.refreshesTriggered,
          recordsUnchanged: this.recordsUnchanged,
          deletionsDetected: this.deletionsDetected,
        },
        errors: {
          pdsErrors: this.pdsErrors,
          rateLimitHits: this.rateLimitHits,
          otherErrors: this.otherErrors,
        },
        pdsHealth: { healthy: 0, unhealthy: 0, avgErrorRate: 0 },
      };
    }
  }

  /**
   * Collects staleness distribution stats from database.
   */
  private async collectStalenessStats(): Promise<FreshnessMetricsSnapshot['staleness']> {
    const now = Date.now();
    const recentCutoff = new Date(now - this.thresholds.recent);
    const normalCutoff = new Date(now - this.thresholds.normal);

    const query = `
      SELECT
        COUNT(*) FILTER (WHERE last_synced_at >= $1) AS under_24h,
        COUNT(*) FILTER (WHERE last_synced_at >= $2 AND last_synced_at < $1) AS under_7d,
        COUNT(*) FILTER (WHERE last_synced_at < $2) AS over_7d,
        COUNT(*) AS total
      FROM eprints_index
      WHERE deleted_at IS NULL
    `;

    const result = await this.pool.query<{
      under_24h: string;
      under_7d: string;
      over_7d: string;
      total: string;
    }>(query, [recentCutoff, normalCutoff]);

    const row = result.rows[0];

    return {
      under24h: parseInt(row?.under_24h ?? '0', 10),
      under7d: parseInt(row?.under_7d ?? '0', 10),
      over7d: parseInt(row?.over_7d ?? '0', 10),
      total: parseInt(row?.total ?? '0', 10),
    };
  }

  /**
   * Collects PDS health stats from database.
   */
  private async collectPDSHealthStats(): Promise<FreshnessMetricsSnapshot['pdsHealth']> {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE is_healthy = true) AS healthy,
        COUNT(*) FILTER (WHERE is_healthy = false) AS unhealthy,
        AVG(error_count::float) AS avg_error_count
      FROM pds_sync_status
    `;

    const result = await this.pool.query<{
      healthy: string;
      unhealthy: string;
      avg_error_count: string | null;
    }>(query);

    const row = result.rows[0];

    return {
      healthy: parseInt(row?.healthy ?? '0', 10),
      unhealthy: parseInt(row?.unhealthy ?? '0', 10),
      avgErrorRate: parseFloat(row?.avg_error_count ?? '0') / 10, // Normalize to 0-1 range
    };
  }

  /**
   * Records a freshness check.
   */
  recordCheck(): void {
    this.checksPerformed++;
  }

  /**
   * Records a refresh (content changed).
   */
  recordRefresh(): void {
    this.refreshesTriggered++;
  }

  /**
   * Records an unchanged record.
   */
  recordUnchanged(): void {
    this.recordsUnchanged++;
  }

  /**
   * Records a deletion detected.
   */
  recordDeletion(): void {
    this.deletionsDetected++;
  }

  /**
   * Records a PDS error.
   */
  recordPDSError(): void {
    this.pdsErrors++;
  }

  /**
   * Records a rate limit hit.
   */
  recordRateLimitHit(): void {
    this.rateLimitHits++;
  }

  /**
   * Records another error.
   */
  recordOtherError(): void {
    this.otherErrors++;
  }

  /**
   * Resets operation counters.
   */
  resetCounters(): void {
    this.checksPerformed = 0;
    this.refreshesTriggered = 0;
    this.recordsUnchanged = 0;
    this.deletionsDetected = 0;
    this.pdsErrors = 0;
    this.rateLimitHits = 0;
    this.otherErrors = 0;
  }

  /**
   * Gets current counter values (without database queries).
   */
  getCounters(): Pick<FreshnessMetricsSnapshot, 'operations' | 'errors'> {
    return {
      operations: {
        checksPerformed: this.checksPerformed,
        refreshesTriggered: this.refreshesTriggered,
        recordsUnchanged: this.recordsUnchanged,
        deletionsDetected: this.deletionsDetected,
      },
      errors: {
        pdsErrors: this.pdsErrors,
        rateLimitHits: this.rateLimitHits,
        otherErrors: this.otherErrors,
      },
    };
  }
}
