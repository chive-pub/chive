/**
 * Staleness detection for indexed records.
 *
 * @remarks
 * Detects when indexed records are out of sync with their authoritative
 * PDS sources by comparing CIDs and sync timestamps.
 *
 * **Staleness Criteria:**
 * 1. Indexed CID differs from current PDS CID (primary check)
 * 2. Record exists in index but not in PDS (deleted)
 * 3. PDS unreachable and last sync > 24 hours ago (fallback)
 *
 * **ATProto Compliance:**
 * - Ensures index accuracy by detecting outdated records
 * - Triggers re-indexing when PDS has newer data
 * - Respects PDS as source of truth
 *
 * @example
 * ```typescript
 * const detector = new StalenessDetector(pool);
 *
 * // Check if a record needs re-indexing
 * const isStale = await detector.isStale(
 *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!
 * );
 *
 * if (isStale) {
 *   console.log('Record needs re-indexing');
 *   await reindexRecord(uri);
 * }
 * ```
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { Pool } from 'pg';

import type { AtUri, CID } from '../../types/atproto.js';
import { DatabaseError, ValidationError } from '../../types/errors.js';

import { SelectBuilder } from './query-builder.js';

/**
 * Database row interface for staleness queries.
 *
 * @internal
 */
interface StalenessCheckRow extends Record<string, unknown> {
  readonly uri: string;
  readonly cid: string;
  readonly pds_url: string;
  readonly indexed_at: Date;
}

/**
 * Staleness detector for indexed records.
 *
 * @remarks
 * Compares indexed record CIDs with current PDS CIDs to detect staleness.
 * Falls back to time-based checking if PDS is unreachable.
 *
 * **Detection Strategy:**
 * 1. Fetch indexed CID and PDS URL from database
 * 2. Query PDS for current record CID via XRPC
 * 3. Compare CIDs - if different, record is stale
 * 4. If PDS unreachable, use time-based fallback
 *
 * @public
 * @since 0.1.0
 */
export class StalenessDetector {
  private readonly pool: Pool;

  /**
   * Creates a staleness detector.
   *
   * @param pool - PostgreSQL connection pool
   *
   * @remarks
   * The pool should be created with createPool() for correct configuration.
   * The detector does not close the pool; caller is responsible for cleanup.
   */
  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Checks if an indexed record is stale.
   *
   * @param uri - Record URI
   * @returns True if index is stale, false otherwise
   *
   * @remarks
   * Compares the indexed CID with the current CID in the user's PDS.
   * If the CIDs differ, the index is stale and needs re-indexing.
   *
   * Fallback: If PDS is unreachable, uses time-based staleness check
   * (stale if not synced in last 24 hours).
   *
   * **ATProto Compliance:** Essential for ensuring index accuracy and
   * detecting when users have updated their records.
   *
   * @example
   * ```typescript
   * const isStale = await detector.isStale(
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!
   * );
   *
   * if (isStale) {
   *   await reindexService.reindex(uri);
   * }
   * ```
   *
   * @public
   */
  async isStale(uri: AtUri): Promise<boolean> {
    try {
      // Fetch indexed record CID and PDS URL
      const query = new SelectBuilder<StalenessCheckRow>()
        .select('cid', 'pds_url', 'indexed_at')
        .from('eprints_index')
        .where({ uri })
        .build();

      const result = await this.pool.query<{
        cid: string;
        pds_url: string;
        indexed_at: Date;
      }>(query.sql, [...query.params]);

      if (result.rows.length === 0) {
        // Record not in index: not stale (doesn't exist)
        return false;
      }

      const row = result.rows[0];
      if (!row) {
        return false;
      }

      const indexedCID = row.cid;
      const pdsUrl = row.pds_url;

      // Try to fetch current CID from PDS
      try {
        const currentCID = await this.fetchRecordCID(uri, pdsUrl);

        if (!currentCID) {
          // Record doesn't exist in PDS anymore: consider stale
          return true;
        }

        // Compare CIDs: if different, index is stale
        return currentCID !== indexedCID;
      } catch {
        // PDS unreachable or error: fallback to time-based staleness
        // Consider stale if not synced in last 24 hours
        const lastSynced = new Date(row.indexed_at);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        return lastSynced < oneDayAgo;
      }
    } catch (error) {
      throw new DatabaseError(
        'READ',
        `Failed to check staleness: ${String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Fetches the current CID of a record from its PDS.
   *
   * @param uri - AT URI of the record
   * @param pdsUrl - URL of the user's PDS
   * @returns Current CID, or null if record not found
   *
   * @remarks
   * Uses XRPC com.atproto.repo.getRecord to fetch the current record
   * and extract its CID. This is the authoritative way to check if
   * an indexed record is stale.
   *
   * **Implementation:**
   * - Parses AT URI into DID, collection, and rkey components
   * - Constructs XRPC endpoint URL with query parameters
   * - Fetches record from PDS with 10-second timeout
   * - Extracts and validates CID from response
   *
   * @throws Error if PDS is unreachable or returns invalid response
   *
   * @example
   * ```typescript
   * const cid = await detector.fetchRecordCID(
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!,
   *   'https://pds.example.com'
   * );
   *
   * if (cid) {
   *   console.log('Current CID:', cid);
   * }
   * ```
   *
   * @public
   */
  async fetchRecordCID(uri: AtUri, pdsUrl: string): Promise<CID | null> {
    // Parse AT URI: at://did:plc:abc/collection/rkey
    const uriParts = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri);
    if (!uriParts) {
      throw new ValidationError(`Invalid AT URI format: ${uri}`, 'uri', 'pattern');
    }

    const [, did, collection, rkey] = uriParts;

    // Type guard: match groups are always defined after regex match succeeds
    if (!did || !collection || !rkey) {
      throw new ValidationError(`Invalid AT URI format: ${uri}`, 'uri', 'pattern');
    }

    // Construct XRPC URL: https://pds.example.com/xrpc/com.atproto.repo.getRecord
    const xrpcUrl = new URL('/xrpc/com.atproto.repo.getRecord', pdsUrl);
    xrpcUrl.searchParams.set('repo', did);
    xrpcUrl.searchParams.set('collection', collection);
    xrpcUrl.searchParams.set('rkey', rkey);

    try {
      const response = await fetch(xrpcUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        // Timeout after 10 seconds
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 404) {
        // Record not found in PDS
        return null;
      }

      if (!response.ok) {
        throw new DatabaseError('READ', `PDS returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        uri?: string;
        cid?: string;
        value?: unknown;
      };

      if (!data.cid || typeof data.cid !== 'string') {
        throw new ValidationError('PDS response missing CID field', 'cid', 'required');
      }

      return data.cid as CID;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DatabaseError('READ', `Timeout fetching record from PDS: ${pdsUrl}`);
      }
      throw error;
    }
  }

  /**
   * Checks staleness for multiple records in batch.
   *
   * @param uris - Array of record URIs to check
   * @returns Map of URI to staleness status
   *
   * @remarks
   * Efficiently checks multiple records by batching database queries
   * and parallelizing PDS requests. Useful for bulk staleness detection.
   *
   * Records that fail staleness check are marked as stale. This is a
   * conservative approach that triggers re-indexing on errors.
   *
   * @example
   * ```typescript
   * const uris = [
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!,
   *   toAtUri('at://did:plc:def/pub.chive.eprint.submission/uvw')!,
   * ];
   *
   * const stalenessMap = await detector.checkBatch(uris);
   *
   * for (const [uri, isStale] of stalenessMap.entries()) {
   *   if (isStale) {
   *     console.log('Stale:', uri);
   *   }
   * }
   * ```
   *
   * @public
   */
  async checkBatch(uris: readonly AtUri[]): Promise<Map<AtUri, boolean>> {
    const result = new Map<AtUri, boolean>();

    // Fetch all records in one query
    const placeholders = uris.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      SELECT uri, cid, pds_url, indexed_at
      FROM eprints_index
      WHERE uri IN (${placeholders})
    `;

    const rows = await this.pool.query<{
      uri: string;
      cid: string;
      pds_url: string;
      indexed_at: Date;
    }>(query, [...uris]);

    // Check staleness for each record in parallel
    await Promise.all(
      rows.rows.map(async (row) => {
        const uri = row.uri as AtUri;
        const indexedCID = row.cid;
        const pdsUrl = row.pds_url;

        try {
          const currentCID = await this.fetchRecordCID(uri, pdsUrl);

          if (!currentCID) {
            result.set(uri, true);
            return;
          }

          result.set(uri, currentCID !== indexedCID);
        } catch {
          // On error, fallback to time-based check
          const lastSynced = new Date(row.indexed_at);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          result.set(uri, lastSynced < oneDayAgo);
        }
      })
    );

    // Mark records not in index as not stale
    for (const uri of uris) {
      if (!result.has(uri)) {
        result.set(uri, false);
      }
    }

    return result;
  }
}
