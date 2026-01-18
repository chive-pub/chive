/**
 * Freshness scan job.
 *
 * @remarks
 * Scheduled job that scans for stale records and queues freshness jobs.
 * Runs periodically to ensure all indexed records are fresh.
 *
 * **Staleness Tiers:**
 * - URGENT: Records failing recent checks (< 6 hours)
 * - RECENT: Records synced < 24 hours ago
 * - NORMAL: Records synced 1-7 days ago
 * - BACKGROUND: Records synced > 7 days ago
 *
 * Each tier gets different priority in the job queue, ensuring
 * more recently-synced records are checked more often.
 *
 * **ATProto Compliance:**
 * - READ-ONLY scans of local indexes
 * - Does not write to user PDSes
 * - All data rebuildable from source
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { AtUri } from '../types/atproto.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';
import {
  FreshnessWorker,
  FreshnessPriority,
  type FreshnessJobData,
} from '../workers/freshness-worker.js';

/**
 * Staleness thresholds.
 *
 * @public
 */
export interface StalenessThresholds {
  /**
   * Urgent threshold (records needing immediate recheck).
   *
   * @defaultValue 21600000 (6 hours)
   */
  readonly urgentMs: number;

  /**
   * Recent threshold (records synced within this window).
   *
   * @defaultValue 86400000 (24 hours)
   */
  readonly recentMs: number;

  /**
   * Normal threshold (moderately stale records).
   *
   * @defaultValue 604800000 (7 days)
   */
  readonly normalMs: number;
}

/**
 * Freshness scan job configuration.
 *
 * @public
 */
export interface FreshnessScanJobConfig {
  /**
   * PostgreSQL connection pool.
   */
  readonly pool: Pool;

  /**
   * Freshness worker for job enqueueing.
   */
  readonly freshnessWorker: FreshnessWorker;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Scan interval in milliseconds.
   *
   * @defaultValue 3600000 (1 hour)
   */
  readonly scanIntervalMs?: number;

  /**
   * Maximum records to scan per tier per run.
   *
   * @defaultValue 500
   */
  readonly batchSize?: number;

  /**
   * Staleness thresholds.
   */
  readonly thresholds?: Partial<StalenessThresholds>;
}

/**
 * Stale record from database scan.
 */
interface StaleRecord {
  uri: string;
  pds_url: string;
  last_synced_at: Date;
}

/**
 * Scan run result.
 *
 * @public
 */
export interface ScanRunResult {
  /**
   * Whether scan completed successfully.
   */
  readonly success: boolean;

  /**
   * Number of urgent records queued.
   */
  readonly urgentQueued: number;

  /**
   * Number of recent records queued.
   */
  readonly recentQueued: number;

  /**
   * Number of normal records queued.
   */
  readonly normalQueued: number;

  /**
   * Number of background records queued.
   */
  readonly backgroundQueued: number;

  /**
   * Total records queued.
   */
  readonly totalQueued: number;

  /**
   * Duration in milliseconds.
   */
  readonly durationMs: number;

  /**
   * Error message (if failed).
   */
  readonly error?: string;
}

/**
 * Freshness scan job.
 *
 * @remarks
 * Scans database for stale records and queues freshness jobs.
 * Uses tiered approach to prioritize recently-synced records.
 *
 * @example
 * ```typescript
 * const scanJob = new FreshnessScanJob({
 *   pool,
 *   freshnessWorker,
 *   logger,
 *   scanIntervalMs: 3600000, // 1 hour
 *   batchSize: 500,
 * });
 *
 * await scanJob.start();
 *
 * // Later...
 * scanJob.stop();
 * ```
 *
 * @public
 */
export class FreshnessScanJob {
  private readonly pool: Pool;
  private readonly freshnessWorker: FreshnessWorker;
  private readonly logger: ILogger;
  private readonly scanIntervalMs: number;
  private readonly batchSize: number;
  private readonly thresholds: StalenessThresholds;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastRunResult: ScanRunResult | null = null;

  constructor(config: FreshnessScanJobConfig) {
    this.pool = config.pool;
    this.freshnessWorker = config.freshnessWorker;
    this.logger = config.logger.child({ service: 'freshness-scan-job' });
    this.scanIntervalMs = config.scanIntervalMs ?? 3_600_000; // 1 hour
    this.batchSize = config.batchSize ?? 500;

    this.thresholds = {
      urgentMs: config.thresholds?.urgentMs ?? 6 * 60 * 60 * 1000, // 6 hours
      recentMs: config.thresholds?.recentMs ?? 24 * 60 * 60 * 1000, // 24 hours
      normalMs: config.thresholds?.normalMs ?? 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  /**
   * Starts the scan job with periodic execution.
   */
  async start(): Promise<void> {
    this.logger.info('Starting freshness scan job', {
      scanIntervalMs: this.scanIntervalMs,
      batchSize: this.batchSize,
      thresholds: this.thresholds,
    });

    // Run immediately on start
    await this.run();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.run().catch((err) => {
        this.logger.error('Freshness scan job failed', err instanceof Error ? err : undefined);
      });
    }, this.scanIntervalMs);
  }

  /**
   * Stops the scan job.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.info('Freshness scan job stopped');
  }

  /**
   * Runs a single scan cycle.
   *
   * @returns Scan run result
   */
  async run(): Promise<ScanRunResult> {
    if (this.isRunning) {
      this.logger.debug('Scan already in progress, skipping');
      return {
        success: false,
        urgentQueued: 0,
        recentQueued: 0,
        normalQueued: 0,
        backgroundQueued: 0,
        totalQueued: 0,
        durationMs: 0,
        error: 'Scan already in progress',
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.debug('Starting freshness scan');

      const now = Date.now();
      const urgentCutoff = new Date(now - this.thresholds.urgentMs);
      const recentCutoff = new Date(now - this.thresholds.recentMs);
      const normalCutoff = new Date(now - this.thresholds.normalMs);

      // Scan each tier
      const [urgentRecords, recentRecords, normalRecords, backgroundRecords] = await Promise.all([
        // Urgent: records that haven't been synced in 6+ hours and may have issues
        this.scanTier('urgent', urgentCutoff, null, FreshnessPriority.URGENT),
        // Recent: records synced 6-24 hours ago
        this.scanTier('recent', recentCutoff, urgentCutoff, FreshnessPriority.RECENT),
        // Normal: records synced 1-7 days ago
        this.scanTier('normal', normalCutoff, recentCutoff, FreshnessPriority.NORMAL),
        // Background: records synced 7+ days ago
        this.scanTier('background', null, normalCutoff, FreshnessPriority.BACKGROUND),
      ]);

      // Queue jobs for each tier
      const [urgentQueued, recentQueued, normalQueued, backgroundQueued] = await Promise.all([
        this.queueJobs(urgentRecords, FreshnessPriority.URGENT, 'scan'),
        this.queueJobs(recentRecords, FreshnessPriority.RECENT, 'scan'),
        this.queueJobs(normalRecords, FreshnessPriority.NORMAL, 'scan'),
        this.queueJobs(backgroundRecords, FreshnessPriority.BACKGROUND, 'scan'),
      ]);

      const totalQueued = urgentQueued + recentQueued + normalQueued + backgroundQueued;
      const durationMs = Date.now() - startTime;

      const result: ScanRunResult = {
        success: true,
        urgentQueued,
        recentQueued,
        normalQueued,
        backgroundQueued,
        totalQueued,
        durationMs,
      };

      this.lastRunResult = result;

      this.logger.info('Freshness scan completed', {
        urgentQueued,
        recentQueued,
        normalQueued,
        backgroundQueued,
        totalQueued,
        durationMs,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Freshness scan failed', error instanceof Error ? error : undefined);

      const result: ScanRunResult = {
        success: false,
        urgentQueued: 0,
        recentQueued: 0,
        normalQueued: 0,
        backgroundQueued: 0,
        totalQueued: 0,
        durationMs,
        error: errorMessage,
      };

      this.lastRunResult = result;
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Scans a staleness tier for records.
   *
   * @param tier - Tier name for logging
   * @param olderThan - Records synced before this date (or null for no upper bound)
   * @param newerThan - Records synced after this date (or null for no lower bound)
   * @param priority - Priority for logging
   * @returns Array of stale records
   */
  private async scanTier(
    tier: string,
    olderThan: Date | null,
    newerThan: Date | null,
    priority: number
  ): Promise<StaleRecord[]> {
    try {
      let query: string;
      let params: (Date | number)[];

      if (olderThan && newerThan) {
        // Between two dates
        query = `
          SELECT uri, pds_url, last_synced_at
          FROM eprints_index
          WHERE last_synced_at < $1
            AND last_synced_at >= $2
            AND deleted_at IS NULL
          ORDER BY last_synced_at ASC
          LIMIT $3
        `;
        params = [olderThan, newerThan, this.batchSize];
      } else if (olderThan) {
        // Older than cutoff
        query = `
          SELECT uri, pds_url, last_synced_at
          FROM eprints_index
          WHERE last_synced_at < $1
            AND deleted_at IS NULL
          ORDER BY last_synced_at ASC
          LIMIT $2
        `;
        params = [olderThan, this.batchSize];
      } else if (newerThan) {
        // Newer than cutoff (background tier)
        query = `
          SELECT uri, pds_url, last_synced_at
          FROM eprints_index
          WHERE last_synced_at < $1
            AND deleted_at IS NULL
          ORDER BY last_synced_at ASC
          LIMIT $2
        `;
        params = [newerThan, this.batchSize];
      } else {
        // No bounds (shouldn't happen)
        return [];
      }

      const result = await this.pool.query<StaleRecord>(query, params);

      this.logger.debug('Scanned staleness tier', {
        tier,
        count: result.rows.length,
        priority,
      });

      return result.rows;
    } catch (error) {
      this.logger.error(`Error scanning ${tier} tier`, error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Queues freshness jobs for scanned records.
   *
   * @param records - Stale records to queue
   * @param priority - Job priority
   * @param source - Job source
   * @returns Number of jobs queued
   */
  private async queueJobs(
    records: StaleRecord[],
    priority: number,
    source: 'scan' | 'admin' | 'user' | 'recheck'
  ): Promise<number> {
    if (records.length === 0) return 0;

    const jobs: FreshnessJobData[] = records.map((record) => ({
      uri: record.uri as AtUri,
      pdsUrl: record.pds_url,
      lastSyncedAt: record.last_synced_at.toISOString(),
      priority,
      checkType: 'staleness' as const,
      source,
    }));

    return this.freshnessWorker.enqueueBatch(jobs);
  }

  /**
   * Gets the last run result.
   *
   * @returns Last scan run result or null if never run
   */
  getLastRunResult(): ScanRunResult | null {
    return this.lastRunResult;
  }

  /**
   * Checks if the job is currently running.
   */
  isJobRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Triggers an immediate scan (if not already running).
   *
   * @returns Scan run result
   */
  async triggerScan(): Promise<ScanRunResult> {
    return this.run();
  }
}
