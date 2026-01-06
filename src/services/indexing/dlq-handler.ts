/**
 * Dead Letter Queue (DLQ) handler for failed event processing.
 *
 * @remarks
 * Manages failed events that cannot be processed after retries.
 * Events in the DLQ require manual investigation and can be replayed
 * after fixing the underlying issue.
 *
 * **DLQ Semantics:**
 * - Events sent to DLQ after max retries exceeded
 * - Permanent errors (validation) go directly to DLQ (no retries)
 * - Each entry includes error details for debugging
 * - Replay capability for recovered events
 *
 * **Alert Thresholds:**
 * - Warning: 100+ events in DLQ
 * - Critical: 1000+ events in DLQ
 *
 * @example
 * ```typescript
 * const dlq = new DeadLetterQueue({ db, alerts, classifier });
 *
 * try {
 *   await processEvent(event);
 * } catch (error) {
 *   // Send to DLQ for manual review
 *   await dlq.add(event, error);
 * }
 *
 * // Later: replay recovered event
 * const entries = await dlq.list({ limit: 10 });
 * for (const entry of entries) {
 *   await dlq.retry(entry.id);
 * }
 * ```
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import { DatabaseError, NotFoundError } from '../../types/errors.js';

import { ErrorClassifier, ErrorType } from './error-classifier.js';

/**
 * DLQ configuration options.
 *
 * @public
 */
export interface DLQOptions {
  /**
   * PostgreSQL connection pool.
   */
  readonly db: Pool;

  /**
   * Alert service for threshold notifications.
   */
  readonly alerts?: AlertService;

  /**
   * Error classifier for categorizing failures.
   */
  readonly classifier?: ErrorClassifier;

  /**
   * Warning threshold (number of DLQ entries).
   *
   * @defaultValue 100
   */
  readonly warningThreshold?: number;

  /**
   * Critical threshold (number of DLQ entries).
   *
   * @defaultValue 1000
   */
  readonly criticalThreshold?: number;
}

/**
 * Alert service interface.
 *
 * @public
 */
export interface AlertService {
  /**
   * Sends an alert.
   *
   * @param message - Alert message
   * @param severity - Alert severity
   */
  send(message: string, severity: 'info' | 'warning' | 'critical'): Promise<void>;
}

/**
 * DLQ entry stored in database.
 *
 * @public
 */
export interface DLQEntry {
  /**
   * Unique entry ID (auto-increment).
   */
  readonly id: number;

  /**
   * Event sequence number.
   */
  readonly seq: number;

  /**
   * Repository DID.
   */
  readonly repoDid: string;

  /**
   * Event type.
   */
  readonly eventType: string;

  /**
   * Full event data (JSON).
   */
  readonly eventData: DLQEvent;

  /**
   * Error message.
   */
  readonly errorMessage: string;

  /**
   * Error type classification.
   */
  readonly errorType: ErrorType;

  /**
   * Number of retry attempts.
   */
  readonly retryCount: number;

  /**
   * When entry was created.
   */
  readonly createdAt: Date;

  /**
   * Last retry attempt timestamp.
   */
  readonly lastRetryAt?: Date;
}

/**
 * DLQ list options.
 *
 * @public
 */
export interface DLQListOptions {
  /**
   * Maximum number of entries to return.
   *
   * @defaultValue 100
   */
  readonly limit?: number;

  /**
   * Offset for pagination.
   *
   * @defaultValue 0
   */
  readonly offset?: number;

  /**
   * Filter by error type.
   */
  readonly errorType?: ErrorType;

  /**
   * Filter by repository DID.
   */
  readonly repoDid?: string;

  /**
   * Order by field.
   *
   * @defaultValue "created_at"
   */
  readonly orderBy?: 'created_at' | 'seq' | 'retry_count';

  /**
   * Order direction.
   *
   * @defaultValue "DESC"
   */
  readonly order?: 'ASC' | 'DESC';
}

/**
 * DLQ statistics.
 *
 * @public
 */
export interface DLQStats {
  /**
   * Total number of entries in DLQ.
   */
  readonly total: number;

  /**
   * Count by error type.
   */
  readonly byErrorType: Record<ErrorType, number>;

  /**
   * Oldest entry timestamp.
   */
  readonly oldestEntry?: Date;

  /**
   * Newest entry timestamp.
   */
  readonly newestEntry?: Date;
}

/**
 * Event interface for DLQ.
 *
 * @public
 */
export interface DLQEvent {
  /**
   * Event sequence number.
   */
  readonly seq: number;

  /**
   * Repository DID.
   */
  readonly repo: string;

  /**
   * Event type discriminator.
   */
  readonly $type: string;

  /**
   * Full event data.
   */
  readonly [key: string]: unknown;
}

/**
 * Manages dead letter queue for failed events.
 *
 * @remarks
 * Stores failed events in PostgreSQL for manual investigation and replay.
 *
 * Events are added to DLQ when:
 * - Max retry attempts exceeded
 * - Permanent error detected (validation, parse errors)
 * - Manual decision to skip event
 *
 * The DLQ provides:
 * - Persistent storage of failed events
 * - Error categorization
 * - Retry capability
 * - Alert thresholds
 * - Statistics and reporting
 *
 * @public
 */
export class DeadLetterQueue {
  private readonly db: Pool;
  private readonly alerts?: AlertService;
  private readonly classifier: ErrorClassifier;
  private readonly warningThreshold: number;
  private readonly criticalThreshold: number;

  /**
   * Creates a dead letter queue handler.
   *
   * @param options - Configuration options
   */
  constructor(options: DLQOptions) {
    this.db = options.db;
    this.alerts = options.alerts;
    this.classifier = options.classifier ?? new ErrorClassifier();
    this.warningThreshold = options.warningThreshold ?? 100;
    this.criticalThreshold = options.criticalThreshold ?? 1000;
  }

  /**
   * Adds event to dead letter queue.
   *
   * @param event - Failed event
   * @param error - Error that caused failure
   * @param retryCount - Number of retries attempted
   * @returns Promise resolving to DLQ entry ID
   *
   * @remarks
   * Stores complete event data and error details for later investigation.
   *
   * After adding, checks DLQ size and sends alerts if thresholds exceeded.
   *
   * @throws {Error}
   * Thrown if database insert fails.
   *
   * @example
   * ```typescript
   * try {
   *   await processEvent(event);
   * } catch (error) {
   *   const entryId = await dlq.add(event, error, 3);
   *   console.error('Event sent to DLQ:', entryId);
   * }
   * ```
   */
  async add(event: DLQEvent, error: Error, retryCount = 0): Promise<number> {
    const errorType = this.classifier.classify(error);

    const result = await this.db.query<{ id: number }>(
      `INSERT INTO firehose_dlq (
        seq, repo_did, event_type, event_data, error_message, error_type, retry_count, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id`,
      [
        event.seq,
        event.repo,
        event.$type,
        JSON.stringify(event),
        error.message,
        errorType,
        retryCount,
      ]
    );

    const entryId = result.rows[0]?.id;

    if (!entryId) {
      throw new DatabaseError('CREATE', 'Failed to insert DLQ entry: no ID returned');
    }

    // Check thresholds and send alerts
    await this.checkThresholds();

    return entryId;
  }

  /**
   * Retries a DLQ entry.
   *
   * @param id - DLQ entry ID
   * @param processor - Event processor function
   * @returns Promise resolving to success status
   *
   * @remarks
   * Attempts to reprocess the failed event. If successful, removes
   * entry from DLQ. If failed, increments retry count and updates
   * last retry timestamp.
   *
   * @throws {Error}
   * Thrown if entry not found or database update fails.
   *
   * @example
   * ```typescript
   * const success = await dlq.retry(123, async (event) => {
   *   await processEvent(event);
   * });
   *
   * if (success) {
   *   console.log('Event reprocessed successfully');
   * } else {
   *   console.log('Retry failed - still in DLQ');
   * }
   * ```
   */
  async retry(id: number, processor: (event: DLQEvent) => Promise<void>): Promise<boolean> {
    // Fetch entry
    const result = await this.db.query<{
      event_data: string;
      retry_count: number;
    }>('SELECT event_data, retry_count FROM firehose_dlq WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('DLQEntry', String(id));
    }

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('DLQEntry', String(id));
    }

    // PostgreSQL JSONB columns are auto-parsed by pg driver
    const event = (
      typeof row.event_data === 'string' ? JSON.parse(row.event_data) : row.event_data
    ) as DLQEvent;
    const retryCount = row.retry_count;

    try {
      // Attempt reprocessing
      await processor(event);

      // Success: remove from DLQ
      await this.db.query('DELETE FROM firehose_dlq WHERE id = $1', [id]);

      return true;
    } catch {
      // Failure: update retry count and timestamp
      await this.db.query(
        `UPDATE firehose_dlq
         SET retry_count = $1, last_retry_at = NOW()
         WHERE id = $2`,
        [retryCount + 1, id]
      );

      return false;
    }
  }

  /**
   * Lists DLQ entries.
   *
   * @param options - List options
   * @returns Promise resolving to array of DLQ entries
   *
   * @remarks
   * Supports pagination, filtering, and ordering.
   *
   * @example
   * ```typescript
   * // Get most recent 10 entries
   * const recent = await dlq.list({ limit: 10, orderBy: 'created_at', order: 'DESC' });
   *
   * // Get all permanent errors
   * const permanent = await dlq.list({ errorType: ErrorType.PERMANENT });
   *
   * // Pagination
   * const page2 = await dlq.list({ limit: 100, offset: 100 });
   * ```
   */
  async list(options: DLQListOptions = {}): Promise<DLQEntry[]> {
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;
    const orderBy = options.orderBy ?? 'created_at';
    const order = options.order ?? 'DESC';

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.errorType) {
      conditions.push(`error_type = $${paramIndex}`);
      params.push(options.errorType);
      paramIndex++;
    }

    if (options.repoDid) {
      conditions.push(`repo_did = $${paramIndex}`);
      params.push(options.repoDid);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        id, seq, repo_did, event_type, event_data,
        error_message, error_type, retry_count,
        created_at, last_retry_at
      FROM firehose_dlq
      ${whereClause}
      ORDER BY ${orderBy} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await this.db.query<{
      id: number;
      seq: number;
      repo_did: string;
      event_type: string;
      event_data: string;
      error_message: string;
      error_type: ErrorType;
      retry_count: number;
      created_at: Date;
      last_retry_at: Date | null;
    }>(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      seq: row.seq,
      repoDid: row.repo_did,
      eventType: row.event_type,
      // PostgreSQL JSONB columns are auto-parsed by pg driver
      eventData: (typeof row.event_data === 'string'
        ? JSON.parse(row.event_data)
        : row.event_data) as DLQEvent,
      errorMessage: row.error_message,
      errorType: row.error_type,
      retryCount: row.retry_count,
      createdAt: row.created_at,
      lastRetryAt: row.last_retry_at ?? undefined,
    }));
  }

  /**
   * Gets DLQ statistics.
   *
   * @returns Promise resolving to DLQ stats
   *
   * @remarks
   * Provides overview of DLQ health:
   * - Total entries
   * - Breakdown by error type
   * - Age of oldest/newest entries
   *
   * @example
   * ```typescript
   * const stats = await dlq.getStats();
   * console.log('Total DLQ entries:', stats.total);
   * console.log('Permanent errors:', stats.byErrorType[ErrorType.PERMANENT]);
   * console.log('Oldest entry:', stats.oldestEntry);
   * ```
   */
  async getStats(): Promise<DLQStats> {
    const result = await this.db.query<{
      total: string;
      error_type: ErrorType;
      count: string;
      oldest_entry: Date | null;
      newest_entry: Date | null;
    }>(`
      SELECT
        COUNT(*) as total,
        error_type,
        COUNT(*) as count,
        MIN(created_at) as oldest_entry,
        MAX(created_at) as newest_entry
      FROM firehose_dlq
      GROUP BY error_type
    `);

    const byErrorType: Record<string, number> = {
      [ErrorType.TRANSIENT]: 0,
      [ErrorType.PERMANENT]: 0,
      [ErrorType.RATE_LIMIT]: 0,
    };

    let total = 0;
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    for (const row of result.rows) {
      const count = parseInt(row.count, 10);
      byErrorType[row.error_type] = count;
      total += count;

      if (row.oldest_entry && (!oldestEntry || row.oldest_entry < oldestEntry)) {
        oldestEntry = row.oldest_entry;
      }

      if (row.newest_entry && (!newestEntry || row.newest_entry > newestEntry)) {
        newestEntry = row.newest_entry;
      }
    }

    return {
      total,
      byErrorType: byErrorType as Record<ErrorType, number>,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Gets count of entries in DLQ.
   *
   * @returns Promise resolving to entry count
   *
   * @example
   * ```typescript
   * const count = await dlq.getCount();
   * if (count > 1000) {
   *   console.error('Critical: DLQ has', count, 'entries');
   * }
   * ```
   */
  async getCount(): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM firehose_dlq'
    );

    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /**
   * Deletes entry from DLQ.
   *
   * @param id - DLQ entry ID
   * @returns Promise resolving when deleted
   *
   * @remarks
   * Use with caution - only delete after resolving or permanently
   * deciding to skip the event.
   *
   * @example
   * ```typescript
   * // After manual investigation, decide to skip event
   * await dlq.delete(123);
   * ```
   */
  async delete(id: number): Promise<void> {
    await this.db.query('DELETE FROM firehose_dlq WHERE id = $1', [id]);
  }

  /**
   * Purges old entries from DLQ.
   *
   * @param olderThanDays - Delete entries older than this many days
   * @returns Promise resolving to number of entries deleted
   *
   * @remarks
   * Use for cleanup of old entries that have been investigated and
   * no longer need to be retained.
   *
   * @example
   * ```typescript
   * // Delete entries older than 90 days
   * const deleted = await dlq.purgeOldEntries(90);
   * console.log('Purged', deleted, 'old DLQ entries');
   * ```
   */
  async purgeOldEntries(olderThanDays: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `DELETE FROM firehose_dlq
       WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
       RETURNING id`
    );

    return result.rowCount ?? 0;
  }

  /**
   * Checks DLQ size against thresholds and sends alerts.
   *
   * @internal
   */
  private async checkThresholds(): Promise<void> {
    if (!this.alerts) {
      return;
    }

    const count = await this.getCount();

    if (count >= this.criticalThreshold) {
      await this.alerts.send(
        `Critical: DLQ has ${count} entries (threshold: ${this.criticalThreshold})`,
        'critical'
      );
    } else if (count >= this.warningThreshold) {
      await this.alerts.send(
        `Warning: DLQ has ${count} entries (threshold: ${this.warningThreshold})`,
        'warning'
      );
    }
  }
}
