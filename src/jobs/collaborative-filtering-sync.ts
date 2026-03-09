/**
 * Collaborative filtering sync job.
 *
 * @remarks
 * Scheduled job that aggregates user interactions from PostgreSQL,
 * syncs weighted interaction data to Neo4j via {@link CollaborativeFilteringStore},
 * and triggers CF_SIMILAR edge computation using GDS nodeSimilarity.
 *
 * Interaction weights:
 * - claim: 5.0
 * - endorse: 4.0
 * - save: 3.0
 * - view: 1.0 (capped at 3.0 total contribution per user-eprint pair)
 * - click: 0.5
 * - dismiss: -2.0
 *
 * Pairs with a net weight <= 0 are excluded.
 *
 * **ATProto Compliance:**
 * - READ-ONLY scans of local PostgreSQL indexes
 * - Writes only to AppView-specific Neo4j relationships
 * - All data rebuildable from source
 *
 * @packageDocumentation
 * @public
 */

import { jobMetrics } from '../observability/prometheus-registry.js';
import { withSpan, addSpanAttributes } from '../observability/tracer.js';
import type { CollaborativeFilteringStore } from '../storage/neo4j/collaborative-filtering.js';
import type { IDatabasePool } from '../types/interfaces/database.interface.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * Job name for BullMQ registration.
 */
export const CF_SYNC_JOB_NAME = 'collaborative-filtering-sync';

/**
 * Default repeat options: every 6 hours.
 */
export const CF_SYNC_DEFAULT_OPTIONS = {
  repeat: { every: 6 * 60 * 60 * 1000 },
};

/**
 * Aggregated interaction row from PostgreSQL.
 */
interface AggregatedInteractionRow {
  readonly user_did: string;
  readonly eprint_uri: string;
  readonly weight: number;
}

/**
 * Collaborative filtering sync job configuration.
 *
 * @public
 */
export interface CollaborativeFilteringSyncJobConfig {
  /**
   * PostgreSQL database pool for querying user interactions.
   */
  readonly db: IDatabasePool;

  /**
   * Collaborative filtering store for Neo4j operations.
   */
  readonly collaborativeFilteringStore: CollaborativeFilteringStore;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Interval between sync runs in milliseconds.
   *
   * @defaultValue 21600000 (6 hours)
   */
  readonly intervalMs?: number;

  /**
   * Whether to run an initial sync on startup.
   *
   * @defaultValue true
   */
  readonly runOnStartup?: boolean;
}

/**
 * Result of a collaborative filtering sync run.
 *
 * @public
 */
export interface CollaborativeFilteringSyncResult {
  /**
   * Number of user-eprint interaction pairs synced to Neo4j.
   */
  readonly interactionsSynced: number;

  /**
   * Number of CF_SIMILAR edges computed.
   */
  readonly similaritiesComputed: number;

  /**
   * Duration of the sync run in milliseconds.
   */
  readonly durationMs: number;
}

/**
 * Syncs user interactions from PostgreSQL to Neo4j and computes CF_SIMILAR edges.
 *
 * @remarks
 * Orchestrates three steps on each run:
 * 1. Aggregates interactions from the `user_interactions` table with
 *    confidence weighting per interaction type
 * 2. Delegates to {@link CollaborativeFilteringStore.syncInteractions} to
 *    upsert INTERACTED_WITH relationships in Neo4j
 * 3. Delegates to {@link CollaborativeFilteringStore.computeSimilarity} to
 *    recompute CF_SIMILAR edges via GDS nodeSimilarity
 *
 * @example
 * ```typescript
 * const job = new CollaborativeFilteringSyncJob({
 *   db: pgPool,
 *   collaborativeFilteringStore: cfStore,
 *   logger,
 * });
 *
 * await job.start();
 * // Later...
 * job.stop();
 * ```
 *
 * @public
 */
export class CollaborativeFilteringSyncJob {
  private readonly db: IDatabasePool;
  private readonly cfStore: CollaborativeFilteringStore;
  private readonly logger: ILogger;
  private readonly intervalMs: number;
  private readonly runOnStartup: boolean;

  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /**
   * Creates a new CollaborativeFilteringSyncJob.
   *
   * @param config - Job configuration
   */
  constructor(config: CollaborativeFilteringSyncJobConfig) {
    this.db = config.db;
    this.cfStore = config.collaborativeFilteringStore;
    this.logger = config.logger.child({ service: 'collaborative-filtering-sync' });
    this.intervalMs = config.intervalMs ?? 21_600_000; // 6 hours
    this.runOnStartup = config.runOnStartup ?? true;
  }

  /**
   * Starts the collaborative filtering sync job.
   *
   * @remarks
   * If runOnStartup is true, performs an immediate sync before starting
   * the periodic schedule. Startup failures are logged but do not
   * prevent the periodic schedule from starting.
   */
  async start(): Promise<void> {
    this.logger.info('Starting collaborative filtering sync job', {
      intervalMs: this.intervalMs,
      runOnStartup: this.runOnStartup,
    });

    if (this.runOnStartup) {
      try {
        await this.run();
      } catch (error) {
        this.logger.error(
          'Initial collaborative filtering sync failed',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    this.intervalHandle = setInterval(() => {
      void this.run().catch((error) => {
        this.logger.error(
          'Periodic collaborative filtering sync failed',
          error instanceof Error ? error : new Error(String(error))
        );
      });
    }, this.intervalMs);
  }

  /**
   * Stops the collaborative filtering sync job.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.info('Collaborative filtering sync job stopped');
  }

  /**
   * Runs a single sync cycle: aggregate interactions, sync to Neo4j, compute similarities.
   *
   * @returns Sync result with counts of interactions synced and similarities computed
   */
  async run(): Promise<CollaborativeFilteringSyncResult> {
    if (this.isRunning) {
      this.logger.debug('Collaborative filtering sync already running, skipping');
      return { interactionsSynced: 0, similaritiesComputed: 0, durationMs: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const endTimer = jobMetrics.duration.startTimer({ job: CF_SYNC_JOB_NAME });

    try {
      const result = await withSpan('CollaborativeFilteringSyncJob.run', async () => {
        addSpanAttributes({
          'chive.operation': 'collaborative_filtering_sync',
        });

        // Step 1: Aggregate interactions from PostgreSQL
        const rows = await this.aggregateInteractions();

        this.logger.info('Aggregated user interactions from PostgreSQL', {
          count: rows.length,
        });

        // Step 2: Map to store format and sync to Neo4j
        const interactions = rows.map((row) => ({
          userDid: row.user_did,
          eprintUri: row.eprint_uri,
          weight: row.weight,
        }));

        await this.cfStore.syncInteractions(interactions);
        const interactionsSynced = interactions.length;

        // Step 3: Clear stale CF_SIMILAR edges before recomputing
        await this.cfStore.clearSimilarityEdges();

        // Step 4: Compute CF_SIMILAR edges via GDS nodeSimilarity
        const { relationshipsCreated } = await this.cfStore.computeSimilarity();

        const durationMs = Date.now() - startTime;

        addSpanAttributes({
          'collaborative_filtering_sync.interactions_synced': interactionsSynced,
          'collaborative_filtering_sync.similarities_computed': relationshipsCreated,
          'collaborative_filtering_sync.duration_ms': durationMs,
        });

        return {
          interactionsSynced,
          similaritiesComputed: relationshipsCreated,
          durationMs,
        };
      });

      this.logger.info('Collaborative filtering sync completed', {
        interactionsSynced: result.interactionsSynced,
        similaritiesComputed: result.similaritiesComputed,
        durationMs: result.durationMs,
      });

      jobMetrics.executionsTotal.inc({ job: CF_SYNC_JOB_NAME, status: 'success' });
      jobMetrics.lastRunTimestamp.set({ job: CF_SYNC_JOB_NAME }, Date.now() / 1000);
      jobMetrics.itemsProcessed.inc(
        { job: CF_SYNC_JOB_NAME, status: 'success' },
        result.interactionsSynced
      );
      endTimer({ status: 'success' });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      this.logger.error(
        'Collaborative filtering sync failed',
        error instanceof Error ? error : undefined,
        { durationMs }
      );

      jobMetrics.executionsTotal.inc({ job: CF_SYNC_JOB_NAME, status: 'error' });
      endTimer({ status: 'error' });

      throw error;
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

  /**
   * Aggregates user interactions from PostgreSQL with confidence weighting.
   *
   * @remarks
   * Each interaction type has a specific weight. View contributions are
   * capped at 3.0 total per (user, eprint) pair. Only pairs with a
   * positive net weight are returned.
   *
   * @returns Aggregated interaction rows
   */
  private async aggregateInteractions(): Promise<AggregatedInteractionRow[]> {
    const result = await this.db.query<AggregatedInteractionRow>(
      `WITH interaction_weights AS (
        SELECT
          user_did,
          eprint_uri,
          COALESCE(SUM(CASE WHEN interaction_type = 'claim' THEN 5.0 ELSE 0 END), 0) +
          COALESCE(SUM(CASE WHEN interaction_type = 'endorse' THEN 4.0 ELSE 0 END), 0) +
          COALESCE(SUM(CASE WHEN interaction_type = 'save' THEN 3.0 ELSE 0 END), 0) +
          LEAST(3.0, COALESCE(SUM(CASE WHEN interaction_type = 'view' THEN 1.0 ELSE 0 END), 0)) +
          COALESCE(SUM(CASE WHEN interaction_type = 'click' THEN 0.5 ELSE 0 END), 0) +
          COALESCE(SUM(CASE WHEN interaction_type = 'dismiss' THEN -2.0 ELSE 0 END), 0) AS weight
        FROM user_interactions
        GROUP BY user_did, eprint_uri
      )
      SELECT user_did, eprint_uri, weight
      FROM interaction_weights
      WHERE weight > 0`
    );

    return result.rows;
  }
}
