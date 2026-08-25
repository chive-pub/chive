/**
 * Field label resolution job.
 *
 * @remarks
 * Periodic job that scans for eprints with unresolved field labels
 * (stored as UUIDs) and resolves them from the Neo4j knowledge graph.
 *
 * This handles the case where eprints were indexed before their field
 * nodes existed in Neo4j, leaving UUID placeholders behind. Deploys recreate
 * Neo4j and repopulate it asynchronously, so a reindex can resolve labels
 * against an empty graph and persist UUIDs to both stores. Repairing
 * PostgreSQL alone is not enough: browse and search read from Elasticsearch,
 * so the UI would keep showing UUIDs indefinitely.
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import { jobMetrics } from '../observability/prometheus-registry.js';
import { withSpan } from '../observability/tracer.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';
import { type NodeLookup, needsLabelResolution, resolveFieldLabels } from '../utils/field-label.js';

/**
 * Minimal interface for writing resolved labels back to the search index.
 *
 * @remarks
 * Satisfied by `ElasticsearchAdapter`.
 *
 * @public
 */
export interface FieldLabelIndexWriter {
  updateFieldLabels(uri: string, fields: readonly { id: string; label: string }[]): Promise<void>;
}

/**
 * @public
 */
export interface FieldLabelResolutionJobConfig {
  readonly pool: Pool;
  readonly nodeLookup: NodeLookup;
  readonly logger: ILogger;

  /**
   * Search index to mirror repaired labels into.
   *
   * @remarks
   * Optional only so existing callers and tests keep working. Omitting it
   * leaves the search index showing UUIDs even after PostgreSQL is repaired.
   */
  readonly indexWriter?: FieldLabelIndexWriter;

  /**
   * Interval between scans in milliseconds.
   *
   * @defaultValue 3600000 (1 hour)
   */
  readonly intervalMs?: number;

  /**
   * Maximum eprints to process per run.
   *
   * @defaultValue 100
   */
  readonly batchSize?: number;

  /**
   * Whether to run immediately on start.
   *
   * @defaultValue true
   */
  readonly runOnStartup?: boolean;
}

/**
 * @public
 */
export interface ResolutionRunResult {
  readonly success: boolean;
  readonly scanned: number;
  readonly resolved: number;
  readonly indexUpdated: number;
  readonly durationMs: number;
  readonly error?: string;
}

/**
 * Periodic job that resolves UUID field labels from Neo4j.
 *
 * @public
 */
export class FieldLabelResolutionJob {
  private readonly pool: Pool;
  private readonly nodeLookup: NodeLookup;
  private readonly indexWriter: FieldLabelIndexWriter | undefined;
  private readonly logger: ILogger;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly runOnStartup: boolean;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(config: FieldLabelResolutionJobConfig) {
    this.pool = config.pool;
    this.nodeLookup = config.nodeLookup;
    this.indexWriter = config.indexWriter;
    this.logger = config.logger.child({ service: 'field-label-resolution-job' });
    this.intervalMs = config.intervalMs ?? 3_600_000; // 1 hour
    this.batchSize = config.batchSize ?? 100;
    this.runOnStartup = config.runOnStartup ?? true;
  }

  async start(): Promise<void> {
    this.logger.info('Starting field label resolution job', {
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
    });

    if (this.runOnStartup) {
      await this.run();
    }

    this.intervalId = setInterval(() => {
      this.run().catch((err) => {
        this.logger.error(
          'Field label resolution job failed',
          err instanceof Error ? err : undefined
        );
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.info('Field label resolution job stopped');
  }

  async run(): Promise<ResolutionRunResult> {
    if (this.isRunning) {
      return {
        success: false,
        scanned: 0,
        resolved: 0,
        indexUpdated: 0,
        durationMs: 0,
        error: 'Already running',
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const endTimer = jobMetrics.duration.startTimer({ job: 'field_label_resolution' });

    try {
      const result = await withSpan('job.field_label_resolution', async () => {
        // Find eprints with UUID-like field labels
        const rows = await this.pool.query<{ uri: string; fields: string }>(
          `SELECT uri, fields::text as fields
           FROM eprints_index
           WHERE fields IS NOT NULL
             AND fields::text ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
             AND deleted_at IS NULL
           LIMIT $1`,
          [this.batchSize]
        );

        if (rows.rows.length === 0) {
          this.logger.debug('No eprints with unresolved field labels found');
          return {
            success: true as const,
            scanned: 0,
            resolved: 0,
            indexUpdated: 0,
            durationMs: 0,
          };
        }

        this.logger.info('Found eprints with unresolved field labels', {
          count: rows.rows.length,
        });

        let resolved = 0;
        let indexUpdated = 0;

        for (const row of rows.rows) {
          const fields = JSON.parse(row.fields) as { uri: string; label: string; id?: string }[];

          // Check if any fields actually need resolution
          const hasUnresolved = fields.some((f) => needsLabelResolution(f.label));
          if (!hasUnresolved) continue;

          const resolvedFields = await resolveFieldLabels(fields, this.nodeLookup);

          // Check if resolution actually changed any labels
          const changed = resolvedFields.some((rf, i) => rf.label !== fields[i]?.label);
          if (!changed) continue;

          await this.pool.query('UPDATE eprints_index SET fields = $1::jsonb WHERE uri = $2', [
            JSON.stringify(resolvedFields),
            row.uri,
          ]);

          resolved++;

          // Browse and search read from the search index, not PostgreSQL, so
          // the repair is only visible to users once it lands there too. A
          // failure here must not abort the run: PostgreSQL is already
          // correct, and the next pass retries.
          if (this.indexWriter) {
            try {
              await this.indexWriter.updateFieldLabels(row.uri, resolvedFields);
              indexUpdated++;
            } catch (err) {
              this.logger.warn('Failed to mirror resolved field labels to the search index', {
                uri: row.uri,
                error: err instanceof Error ? err.message : 'Unknown error',
              });
            }
          }
        }

        return {
          success: true as const,
          scanned: rows.rows.length,
          resolved,
          indexUpdated,
          durationMs: Date.now() - startTime,
        };
      });

      jobMetrics.executionsTotal.inc({ job: 'field_label_resolution', status: 'success' });
      jobMetrics.lastRunTimestamp.set({ job: 'field_label_resolution' }, Date.now() / 1000);
      jobMetrics.itemsProcessed.inc(
        { job: 'field_label_resolution', status: 'success' },
        result.resolved
      );
      endTimer({ status: 'success' });

      if (result.resolved > 0) {
        this.logger.info('Field label resolution completed', {
          scanned: result.scanned,
          resolved: result.resolved,
          indexUpdated: result.indexUpdated,
          durationMs: result.durationMs,
        });

        if (!this.indexWriter) {
          this.logger.warn(
            'Repaired field labels in PostgreSQL only; no search index writer is configured, so browse and search will keep showing UUIDs'
          );
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        'Field label resolution failed',
        error instanceof Error ? error : undefined
      );
      jobMetrics.executionsTotal.inc({ job: 'field_label_resolution', status: 'error' });
      endTimer({ status: 'error' });
      return {
        success: false,
        scanned: 0,
        resolved: 0,
        indexUpdated: 0,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      };
    } finally {
      this.isRunning = false;
    }
  }
}
