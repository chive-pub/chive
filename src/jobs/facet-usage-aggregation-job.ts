/**
 * Facet usage aggregation job.
 *
 * @remarks
 * Runs periodically (typically nightly) to query Neo4j for all facets/tags
 * with their current usage counts, record daily snapshots to PostgreSQL
 * facet_usage_history table, and optionally update Neo4j facet nodes with
 * trending/growthRate.
 *
 * Scheduling: this job should be scheduled via cron or similar. Suggested
 * schedule is daily at 00:00 UTC in production or every 4 hours in staging.
 *
 * ATProto compliance: all operations are on AppView-specific data; no writes
 * to user PDSes; data is rebuildable from indexed records.
 *
 * @example
 * ```typescript
 * const job = new FacetUsageAggregationJob({
 *   facetRepository,
 *   tagManager,
 *   logger,
 * });
 *
 * // Run the job manually
 * await job.run();
 *
 * // Or schedule it
 * job.schedule('0 0 * * *'); // Daily at midnight
 * ```
 *
 * @packageDocumentation
 * @public
 */

import type {
  FacetUsageHistoryRepository,
  FacetUsageSnapshot,
  TrendingCalculation,
  TrendingTimeWindow,
} from '../storage/postgresql/facet-usage-history-repository.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * Interface for tag/facet source (Neo4j TagManager or FacetManager).
 *
 * @public
 */
export interface IFacetSource {
  /**
   * Gets all facets/tags with their current usage counts.
   */
  getAllWithUsageCounts(): Promise<
    {
      uri: string;
      usageCount: number;
      uniqueRecords: number;
    }[]
  >;

  /**
   * Updates trending status for a facet/tag.
   */
  updateTrendingStatus?(uri: string, trending: boolean, growthRate: number): Promise<void>;
}

/**
 * Job configuration.
 *
 * @public
 */
export interface FacetUsageAggregationJobConfig {
  /** Repository for storing usage history */
  facetRepository: FacetUsageHistoryRepository;
  /** Source for facet/tag data */
  facetSource: IFacetSource;
  /** Logger instance */
  logger: ILogger;
  /** Whether to update Neo4j with trending status (default: false) */
  updateNeo4jTrending?: boolean;
  /** Time window for trending calculation (default: 'week') */
  trendingWindow?: TrendingTimeWindow;
  /** Batch size for processing (default: 100) */
  batchSize?: number;
}

/**
 * Job execution result.
 *
 * @public
 */
export interface JobExecutionResult {
  /** Whether the job succeeded */
  success: boolean;
  /** Number of facets processed */
  facetsProcessed: number;
  /** Number of snapshots recorded */
  snapshotsRecorded: number;
  /** Number of facets updated with trending status */
  trendingUpdated: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Job for aggregating facet usage data.
 *
 * @public
 */
export class FacetUsageAggregationJob {
  private readonly facetRepository: FacetUsageHistoryRepository;
  private readonly facetSource: IFacetSource;
  private readonly logger: ILogger;
  private readonly updateNeo4jTrending: boolean;
  private readonly trendingWindow: TrendingTimeWindow;
  private readonly batchSize: number;

  private isRunning = false;

  /**
   * Creates a new FacetUsageAggregationJob.
   *
   * @param config - Job configuration
   */
  constructor(config: FacetUsageAggregationJobConfig) {
    this.facetRepository = config.facetRepository;
    this.facetSource = config.facetSource;
    this.logger = config.logger;
    this.updateNeo4jTrending = config.updateNeo4jTrending ?? false;
    this.trendingWindow = config.trendingWindow ?? 'week';
    this.batchSize = config.batchSize ?? 100;
  }

  /**
   * Runs the aggregation job.
   *
   * @returns Execution result
   */
  async run(): Promise<JobExecutionResult> {
    if (this.isRunning) {
      this.logger.warn('FacetUsageAggregationJob already running, skipping');
      return {
        success: false,
        facetsProcessed: 0,
        snapshotsRecorded: 0,
        trendingUpdated: 0,
        durationMs: 0,
        error: 'Job already running',
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let facetsProcessed = 0;
    let snapshotsRecorded = 0;
    let trendingUpdated = 0;

    try {
      this.logger.info('Starting FacetUsageAggregationJob', {
        date: today.toISOString(),
        updateNeo4jTrending: this.updateNeo4jTrending,
      });

      // Step 1: Get all facets with usage counts
      const facets = await this.facetSource.getAllWithUsageCounts();
      facetsProcessed = facets.length;

      this.logger.info('Retrieved facets for aggregation', {
        count: facets.length,
      });

      // Step 2: Record snapshots in batches
      for (let i = 0; i < facets.length; i += this.batchSize) {
        const batch = facets.slice(i, i + this.batchSize);
        const snapshots: FacetUsageSnapshot[] = batch.map((facet) => ({
          facetUri: facet.uri,
          date: today,
          usageCount: facet.usageCount,
          uniqueRecords: facet.uniqueRecords,
        }));

        await this.facetRepository.batchRecordSnapshots(snapshots);
        snapshotsRecorded += snapshots.length;

        this.logger.debug('Recorded snapshot batch', {
          batchNumber: Math.floor(i / this.batchSize) + 1,
          batchSize: snapshots.length,
        });
      }

      // Step 3: Optionally update Neo4j with trending status
      if (this.updateNeo4jTrending && this.facetSource.updateTrendingStatus) {
        const trendingResults = await this.facetRepository.batchCalculateTrending(
          facets.map((f) => f.uri),
          this.trendingWindow
        );

        const updateTrendingStatus = this.facetSource.updateTrendingStatus.bind(this.facetSource);
        const processEntry = async (calc: TrendingCalculation, uri: string): Promise<void> => {
          try {
            await updateTrendingStatus(uri, calc.trending, calc.growthRate);
            trendingUpdated++;
          } catch (error) {
            this.logger.warn('Failed to update trending status', {
              uri,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        };

        const promises: Promise<void>[] = [];
        trendingResults.forEach((calc, uri) => {
          promises.push(processEntry(calc, uri));
        });
        await Promise.all(promises);
      }

      const durationMs = Date.now() - startTime;

      this.logger.info('FacetUsageAggregationJob completed', {
        facetsProcessed,
        snapshotsRecorded,
        trendingUpdated,
        durationMs,
      });

      return {
        success: true,
        facetsProcessed,
        snapshotsRecorded,
        trendingUpdated,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(
        'FacetUsageAggregationJob failed',
        error instanceof Error ? error : undefined,
        {
          facetsProcessed,
          snapshotsRecorded,
          durationMs,
        }
      );

      return {
        success: false,
        facetsProcessed,
        snapshotsRecorded,
        trendingUpdated,
        durationMs,
        error: errorMessage,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Checks if the job is currently running.
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Creates a simple interval-based scheduler for the job.
 *
 * @param job - The job to schedule
 * @param intervalMs - Interval between runs in milliseconds
 * @returns Object with start/stop methods
 *
 * @example
 * ```typescript
 * const scheduler = createJobScheduler(job, 24 * 60 * 60 * 1000); // Daily
 * scheduler.start();
 * // Later...
 * scheduler.stop();
 * ```
 */
export function createJobScheduler(
  job: FacetUsageAggregationJob,
  intervalMs: number
): { start: () => void; stop: () => void } {
  let intervalId: NodeJS.Timeout | null = null;

  return {
    start: () => {
      if (intervalId) return;
      // Run immediately, then on interval
      void job.run();
      intervalId = setInterval(() => void job.run(), intervalMs);
    },
    stop: () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
