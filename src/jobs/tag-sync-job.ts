/**
 * Tag sync job.
 *
 * @remarks
 * Scheduled job that syncs Neo4j UserTag statistics to PostgreSQL
 * facet_usage_history table. This enables time-windowed trending calculations.
 *
 * **Purpose:**
 * - Backfills facet_usage_history on startup for existing tags
 * - Runs periodically to ensure data consistency
 * - Handles tags that may have been added without PostgreSQL sync
 *
 * **ATProto Compliance:**
 * - READ-ONLY scans of local Neo4j indexes
 * - Writes only to AppView-specific PostgreSQL tables
 * - All data rebuildable from source
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { Neo4jConnection } from '../storage/neo4j/connection.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * Tag sync job configuration.
 *
 * @public
 */
export interface TagSyncJobConfig {
  /**
   * Neo4j connection.
   */
  readonly neo4jConnection: Neo4jConnection;

  /**
   * PostgreSQL connection pool.
   */
  readonly pool: Pool;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Sync interval in milliseconds.
   *
   * @defaultValue 3600000 (1 hour)
   */
  readonly syncIntervalMs?: number;

  /**
   * Whether to run initial sync on startup.
   *
   * @defaultValue true
   */
  readonly runOnStartup?: boolean;
}

/**
 * Result of a tag sync operation.
 *
 * @public
 */
export interface TagSyncResult {
  /**
   * Number of tags synced.
   */
  readonly tagsProcessed: number;

  /**
   * Number of tags that failed to sync.
   */
  readonly tagsFailed: number;

  /**
   * Duration in milliseconds.
   */
  readonly durationMs: number;
}

/**
 * Tag sync job.
 *
 * Syncs Neo4j UserTag statistics to PostgreSQL facet_usage_history.
 *
 * @public
 */
export class TagSyncJob {
  private readonly neo4jConnection: Neo4jConnection;
  private readonly pool: Pool;
  private readonly logger: ILogger;
  private readonly syncIntervalMs: number;
  private readonly runOnStartup: boolean;

  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /**
   * Creates a new TagSyncJob.
   *
   * @param config - Job configuration
   */
  constructor(config: TagSyncJobConfig) {
    this.neo4jConnection = config.neo4jConnection;
    this.pool = config.pool;
    this.logger = config.logger;
    this.syncIntervalMs = config.syncIntervalMs ?? 3600000; // 1 hour default
    this.runOnStartup = config.runOnStartup ?? true;
  }

  /**
   * Starts the tag sync job.
   *
   * If runOnStartup is true, performs an immediate sync before starting
   * the periodic schedule.
   */
  async start(): Promise<void> {
    this.logger.info('Starting tag sync job', {
      syncIntervalMs: this.syncIntervalMs,
      runOnStartup: this.runOnStartup,
    });

    // Run initial sync if configured
    if (this.runOnStartup) {
      try {
        await this.syncTags();
      } catch (error) {
        this.logger.error(
          'Initial tag sync failed',
          error instanceof Error ? error : new Error(String(error))
        );
        // Don't fail startup, just log the error
      }
    }

    // Start periodic sync
    this.intervalHandle = setInterval(() => {
      void this.syncTags().catch((error) => {
        this.logger.error(
          'Periodic tag sync failed',
          error instanceof Error ? error : new Error(String(error))
        );
      });
    }, this.syncIntervalMs);
  }

  /**
   * Stops the tag sync job.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.info('Tag sync job stopped');
  }

  /**
   * Syncs all Neo4j UserTag statistics to PostgreSQL facet_usage_history.
   *
   * @returns Sync result
   */
  async syncTags(): Promise<TagSyncResult> {
    if (this.isRunning) {
      this.logger.debug('Tag sync already running, skipping');
      return { tagsProcessed: 0, tagsFailed: 0, durationMs: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.debug('Starting tag sync');

      // Query all UserTag nodes from Neo4j
      const query = `
        MATCH (tag:UserTag)
        RETURN
          tag.normalizedForm as normalizedForm,
          tag.usageCount as usageCount,
          tag.paperCount as paperCount
      `;

      const result = await this.neo4jConnection.executeQuery<{
        normalizedForm: string;
        usageCount: number;
        paperCount: number;
      }>(query, {});

      let processed = 0;
      let failed = 0;

      // Batch insert/update to PostgreSQL
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        for (const record of result.records) {
          const normalizedForm = record.get('normalizedForm');
          const usageCount = Number(record.get('usageCount')) || 0;
          const paperCount = Number(record.get('paperCount')) || 0;

          try {
            await client.query('SELECT upsert_facet_usage_snapshot($1, $2, $3, $4)', [
              normalizedForm,
              new Date(),
              usageCount,
              paperCount,
            ]);
            processed++;
          } catch (error) {
            this.logger.warn('Failed to sync tag', {
              tag: normalizedForm,
              error: error instanceof Error ? error.message : String(error),
            });
            failed++;
          }
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      const durationMs = Date.now() - startTime;

      this.logger.info('Tag sync completed', {
        tagsProcessed: processed,
        tagsFailed: failed,
        durationMs,
      });

      return { tagsProcessed: processed, tagsFailed: failed, durationMs };
    } finally {
      this.isRunning = false;
    }
  }
}
