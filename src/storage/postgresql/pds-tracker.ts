/**
 * PDS source tracking for AT Protocol compliance.
 *
 * @remarks
 * Tracks which PDS each indexed record originated from and when it was
 * last synced. Essential for detecting staleness and rebuilding indexes
 * from source.
 *
 * **ATProto Compliance:**
 * - Records PDS URL for every indexed record
 * - Tracks sync timestamps for staleness detection
 * - Enables complete rebuild from authoritative sources
 * - Supports credible exit (users retain control of data)
 *
 * @example
 * ```typescript
 * const tracker = new PDSTracker(pool);
 *
 * // Track PDS source when indexing a record
 * await tracker.trackSource(
 *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!,
 *   'https://pds.example.com',
 *   new Date()
 * );
 *
 * // Get PDS URL for a record
 * const pdsUrl = await tracker.getPDSUrl(uri);
 * ```
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { Pool } from 'pg';

import type { AtUri } from '../../types/atproto.js';
import { Err, Ok, type Result } from '../../types/result.js';

import { UpdateBuilder } from './query-builder.js';

/**
 * Database row interface for PDS tracking queries.
 *
 * @internal
 */
interface PDSTrackingRow extends Record<string, unknown> {
  readonly uri: string;
  readonly pds_url: string;
  readonly indexed_at: Date;
}

/**
 * PDS source tracker for indexed records.
 *
 * @remarks
 * Manages PDS source tracking for all indexed records. Each record in the
 * index must track its origin PDS to enable staleness detection and
 * rebuild capabilities.
 *
 * **Responsibilities:**
 * - Update PDS URL and sync timestamp when records are indexed
 * - Retrieve PDS URL for a given record
 * - Track last sync time for staleness detection
 *
 * @public
 * @since 0.1.0
 */
export class PDSTracker {
  private readonly pool: Pool;

  /**
   * Creates a PDS tracker.
   *
   * @param pool - PostgreSQL connection pool
   *
   * @remarks
   * The pool should be created with createPool() for correct configuration.
   * The tracker does not close the pool; caller is responsible for cleanup.
   */
  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Tracks PDS source for a record.
   *
   * @param uri - Record URI
   * @param pdsUrl - URL of the user's PDS
   * @param lastSynced - Last successful sync timestamp
   * @returns Result indicating success or failure
   *
   * @remarks
   * Updates the `pds_url` and `indexed_at` fields in the preprints_index table.
   * Should be called every time a record is indexed or re-indexed.
   *
   * **ATProto Compliance:** Essential for detecting when index is stale
   * (PDS has newer data) and triggering re-indexing.
   *
   * @example
   * ```typescript
   * const result = await tracker.trackSource(
   *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!,
   *   'https://pds.example.com',
   *   new Date()
   * );
   *
   * if (!result.ok) {
   *   console.error('Failed to track PDS:', result.error);
   * }
   * ```
   *
   * @public
   */
  async trackSource(uri: AtUri, pdsUrl: string, lastSynced: Date): Promise<Result<void, Error>> {
    try {
      const query = new UpdateBuilder<PDSTrackingRow>()
        .table('preprints_index')
        .set({
          pds_url: pdsUrl,
          indexed_at: lastSynced,
        })
        .where({ uri })
        .build();

      const result = await this.pool.query(query.sql, [...query.params]);

      if (result.rowCount === 0) {
        return Err(new Error(`Record not found in index: ${uri}`));
      }

      return Ok(undefined);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to track PDS source: ${String(error)}`)
      );
    }
  }

  /**
   * Gets the PDS URL for a record.
   *
   * @param uri - Record URI
   * @returns PDS URL, or null if record not indexed
   *
   * @remarks
   * Retrieves the PDS URL where the record is authoritatively stored.
   * Returns null if the record has not been indexed by Chive.
   *
   * @example
   * ```typescript
   * const pdsUrl = await tracker.getPDSUrl(
   *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!
   * );
   *
   * if (pdsUrl) {
   *   console.log('Record is stored at:', pdsUrl);
   * }
   * ```
   *
   * @public
   */
  async getPDSUrl(uri: AtUri): Promise<string | null> {
    try {
      const result = await this.pool.query<{ pds_url: string }>(
        'SELECT pds_url FROM preprints_index WHERE uri = $1',
        [uri]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return row ? row.pds_url : null;
    } catch (error) {
      throw error instanceof Error ? error : new Error(`Failed to get PDS URL: ${String(error)}`);
    }
  }

  /**
   * Gets the last sync time for a record.
   *
   * @param uri - Record URI
   * @returns Last sync timestamp, or null if record not indexed
   *
   * @remarks
   * Returns when the record was last successfully synced from its PDS.
   * Used by staleness detection to determine if re-indexing is needed.
   *
   * @example
   * ```typescript
   * const lastSync = await tracker.getLastSyncTime(
   *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!
   * );
   *
   * if (lastSync) {
   *   const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
   *   console.log(`Synced ${hoursSinceSync} hours ago`);
   * }
   * ```
   *
   * @public
   */
  async getLastSyncTime(uri: AtUri): Promise<Date | null> {
    try {
      const result = await this.pool.query<{ indexed_at: Date }>(
        'SELECT indexed_at FROM preprints_index WHERE uri = $1',
        [uri]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return row ? new Date(row.indexed_at) : null;
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to get last sync time: ${String(error)}`);
    }
  }
}
