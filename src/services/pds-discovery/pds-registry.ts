/**
 * PDS Registry service.
 *
 * @remarks
 * Manages the registry of known Personal Data Servers (PDSes) that may
 * contain Chive records. Supports proactive PDS scanning to catch records
 * that don't appear in the relay firehose.
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';
import { injectable } from 'tsyringe';

import { DatabaseError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

import type { RelayHostTracker } from './relay-host-tracker.js';

/**
 * Discovery source for PDSes.
 *
 * @public
 */
export type DiscoverySource =
  | 'plc_enumeration'
  | 'relay_listhosts'
  | 'user_registration'
  | 'did_mention';

/**
 * PDS status.
 *
 * @public
 */
export type PDSStatus = 'pending' | 'active' | 'scanning' | 'unreachable' | 'no_chive_records';

/**
 * PDS registry entry.
 *
 * @public
 */
export interface PDSRegistryEntry {
  pdsUrl: string;
  discoveredAt: Date;
  discoverySource: DiscoverySource;
  status: PDSStatus;
  lastScanAt?: Date;
  nextScanAt?: Date;
  hasChiveRecords?: boolean;
  chiveRecordCount: number;
  consecutiveFailures: number;
  scanPriority: number;
  lastError?: string;
  updatedAt: Date;
  isRelayConnected: boolean;
}

/**
 * Known relay-connected PDS domain patterns (fallback).
 *
 * @remarks
 * Used as a fallback when RelayHostTracker is not available.
 * The preferred method is to query the relay's listHosts endpoint.
 */
const RELAY_CONNECTED_PATTERNS_FALLBACK = [
  /\.host\.bsky\.network$/i,
  /^bsky\.social$/i,
  /\.bsky\.network$/i,
];

/**
 * Detects whether a PDS URL is relay-connected based on known patterns.
 *
 * @remarks
 * This is a synchronous fallback check using domain patterns.
 * For authoritative checks, use RelayHostTracker.isRelayConnected().
 *
 * @param pdsUrl - PDS endpoint URL
 * @returns True if the PDS matches known relay-connected patterns
 */
export function isRelayConnectedPDSSync(pdsUrl: string): boolean {
  try {
    const url = new URL(pdsUrl);
    const hostname = url.hostname.toLowerCase();
    return RELAY_CONNECTED_PATTERNS_FALLBACK.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
}

/**
 * Scan result for completed scans.
 *
 * @public
 */
export interface ScanResult {
  hasChiveRecords: boolean;
  chiveRecordCount: number;
  nextScanHours?: number;
}

/**
 * PDS registry interface.
 *
 * @public
 */
export interface IPDSRegistry {
  registerPDS(pdsUrl: string, source: DiscoverySource): Promise<void>;
  getPDSesForScan(limit: number): Promise<PDSRegistryEntry[]>;
  markScanStarted(pdsUrl: string): Promise<void>;
  markScanCompleted(pdsUrl: string, result: ScanResult): Promise<void>;
  markScanFailed(pdsUrl: string, error: string): Promise<void>;
  getPDS(pdsUrl: string): Promise<PDSRegistryEntry | null>;
  getPDSStats(): Promise<{
    total: number;
    active: number;
    withChiveRecords: number;
    unreachable: number;
  }>;
}

/**
 * Database row type for PDS registry.
 */
interface PDSRegistryRow {
  pds_url: string;
  discovered_at: Date;
  discovery_source: DiscoverySource;
  status: PDSStatus;
  last_scan_at: Date | null;
  next_scan_at: Date | null;
  has_chive_records: boolean | null;
  chive_record_count: number;
  consecutive_failures: number;
  scan_priority: number;
  last_error: string | null;
  updated_at: Date;
  is_relay_connected: boolean;
}

/**
 * PDS Registry service implementation.
 *
 * @public
 */
@injectable()
export class PDSRegistry implements IPDSRegistry {
  private readonly pool: Pool;
  private readonly logger: ILogger;
  private readonly relayHostTracker?: RelayHostTracker;

  constructor(pool: Pool, logger: ILogger, relayHostTracker?: RelayHostTracker) {
    this.pool = pool;
    this.logger = logger;
    this.relayHostTracker = relayHostTracker;
  }

  /**
   * Registers a new PDS in the registry.
   *
   * @param pdsUrl - PDS endpoint URL
   * @param source - How the PDS was discovered
   *
   * @remarks
   * Uses RelayHostTracker to check if the PDS is connected to the relay
   * by querying the relay's `com.atproto.sync.listHosts` endpoint.
   * Falls back to pattern matching if the tracker is not available.
   */
  async registerPDS(pdsUrl: string, source: DiscoverySource): Promise<void> {
    try {
      // Normalize URL (remove trailing slash)
      const normalizedUrl = pdsUrl.replace(/\/$/, '');

      // Detect if this is a relay-connected PDS
      // Prefer authoritative check via relay's listHosts, fall back to pattern matching
      let relayConnected: boolean;
      if (this.relayHostTracker) {
        try {
          relayConnected = await this.relayHostTracker.isRelayConnected(normalizedUrl);
        } catch (error) {
          this.logger.warn('RelayHostTracker failed, using pattern fallback', {
            pdsUrl: normalizedUrl,
            error: error instanceof Error ? error.message : String(error),
          });
          relayConnected = isRelayConnectedPDSSync(normalizedUrl);
        }
      } else {
        relayConnected = isRelayConnectedPDSSync(normalizedUrl);
      }

      await this.pool.query(
        `
        INSERT INTO pds_registry (pds_url, discovery_source, status, is_relay_connected)
        VALUES ($1, $2, 'pending', $3)
        ON CONFLICT (pds_url) DO NOTHING
        `,
        [normalizedUrl, source, relayConnected]
      );

      this.logger.debug('Registered PDS', {
        pdsUrl: normalizedUrl,
        source,
        isRelayConnected: relayConnected,
      });
    } catch (error) {
      this.logger.error('Failed to register PDS', error instanceof Error ? error : undefined, {
        pdsUrl,
        source,
      });
      throw new DatabaseError(
        'CREATE',
        `Failed to register PDS: ${pdsUrl}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets PDSes that are ready for scanning.
   *
   * @remarks
   * Only returns PDSes that are NOT relay-connected. Relay-connected PDSes
   * (like Bluesky's *.host.bsky.network) have their records in the firehose
   * and don't need proactive scanning.
   *
   * For authenticated users on relay-connected PDSes, historical records are
   * backfilled via DID-specific scans in the registerPDS handler.
   *
   * @param limit - Maximum number of PDSes to return
   * @returns PDSes ready for scan, ordered by priority
   */
  async getPDSesForScan(limit: number): Promise<PDSRegistryEntry[]> {
    try {
      const result = await this.pool.query<PDSRegistryRow>(
        `
        SELECT *
        FROM pds_registry
        WHERE status IN ('pending', 'active')
          AND (next_scan_at IS NULL OR next_scan_at <= NOW())
          AND consecutive_failures < 5
          AND is_relay_connected = FALSE
        ORDER BY scan_priority ASC, next_scan_at ASC NULLS FIRST
        LIMIT $1
        `,
        [limit]
      );

      return result.rows.map((row) => this.mapRow(row));
    } catch (error) {
      this.logger.error('Failed to get PDSes for scan', error instanceof Error ? error : undefined);
      throw new DatabaseError(
        'QUERY',
        'Failed to get PDSes for scan',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Marks a PDS scan as started.
   *
   * @param pdsUrl - PDS endpoint URL
   */
  async markScanStarted(pdsUrl: string): Promise<void> {
    try {
      await this.pool.query(
        `
        UPDATE pds_registry
        SET status = 'scanning'
        WHERE pds_url = $1
        `,
        [pdsUrl]
      );

      this.logger.debug('Marked PDS scan started', { pdsUrl });
    } catch (error) {
      this.logger.error(
        'Failed to mark PDS scan started',
        error instanceof Error ? error : undefined,
        { pdsUrl }
      );
      throw new DatabaseError(
        'UPDATE',
        `Failed to mark PDS scan started: ${pdsUrl}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Marks a PDS scan as completed.
   *
   * @param pdsUrl - PDS endpoint URL
   * @param result - Scan result
   */
  async markScanCompleted(pdsUrl: string, result: ScanResult): Promise<void> {
    try {
      const nextScanHours = result.nextScanHours ?? (result.hasChiveRecords ? 24 : 168);

      await this.pool.query(
        `
        UPDATE pds_registry
        SET
          status = CASE WHEN $2 THEN 'active' ELSE 'no_chive_records' END,
          last_scan_at = NOW(),
          next_scan_at = NOW() + ($4 || ' hours')::INTERVAL,
          has_chive_records = $2,
          chive_record_count = $3,
          consecutive_failures = 0,
          last_error = NULL
        WHERE pds_url = $1
        `,
        [pdsUrl, result.hasChiveRecords, result.chiveRecordCount, nextScanHours]
      );

      this.logger.info('PDS scan completed', {
        pdsUrl,
        hasChiveRecords: result.hasChiveRecords,
        recordCount: result.chiveRecordCount,
      });
    } catch (error) {
      this.logger.error(
        'Failed to mark PDS scan completed',
        error instanceof Error ? error : undefined,
        { pdsUrl }
      );
      throw new DatabaseError(
        'UPDATE',
        `Failed to mark PDS scan completed: ${pdsUrl}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Marks a PDS scan as failed.
   *
   * @param pdsUrl - PDS endpoint URL
   * @param error - Error message
   */
  async markScanFailed(pdsUrl: string, error: string): Promise<void> {
    try {
      await this.pool.query(
        `
        UPDATE pds_registry
        SET
          consecutive_failures = consecutive_failures + 1,
          last_error = $2,
          status = CASE
            WHEN consecutive_failures >= 4 THEN 'unreachable'
            ELSE 'active'
          END,
          next_scan_at = NOW() + (POWER(2, LEAST(consecutive_failures, 4)) || ' hours')::INTERVAL
        WHERE pds_url = $1
        `,
        [pdsUrl, error]
      );

      this.logger.warn('PDS scan failed', { pdsUrl, error });
    } catch (err) {
      this.logger.error('Failed to mark PDS scan failed', err instanceof Error ? err : undefined, {
        pdsUrl,
      });
      throw new DatabaseError(
        'UPDATE',
        `Failed to mark PDS scan failed: ${pdsUrl}`,
        err instanceof Error ? err : undefined
      );
    }
  }

  /**
   * Gets a single PDS entry.
   *
   * @param pdsUrl - PDS endpoint URL
   * @returns PDS entry or null if not found
   */
  async getPDS(pdsUrl: string): Promise<PDSRegistryEntry | null> {
    try {
      const result = await this.pool.query<PDSRegistryRow>(
        `
        SELECT * FROM pds_registry WHERE pds_url = $1
        `,
        [pdsUrl]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return this.mapRow(row);
    } catch (error) {
      this.logger.error('Failed to get PDS', error instanceof Error ? error : undefined, {
        pdsUrl,
      });
      throw new DatabaseError(
        'READ',
        `Failed to get PDS: ${pdsUrl}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets statistics about the PDS registry.
   */
  async getPDSStats(): Promise<{
    total: number;
    active: number;
    withChiveRecords: number;
    unreachable: number;
  }> {
    try {
      const result = await this.pool.query<{
        total: string;
        active: string;
        with_chive_records: string;
        unreachable: string;
      }>(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE has_chive_records = TRUE) as with_chive_records,
          COUNT(*) FILTER (WHERE status = 'unreachable') as unreachable
        FROM pds_registry
      `);

      const row = result.rows[0];
      // COUNT queries always return a row, but add fallback for safety
      if (!row) {
        return { total: 0, active: 0, withChiveRecords: 0, unreachable: 0 };
      }
      return {
        total: parseInt(row.total, 10),
        active: parseInt(row.active, 10),
        withChiveRecords: parseInt(row.with_chive_records, 10),
        unreachable: parseInt(row.unreachable, 10),
      };
    } catch (error) {
      this.logger.error('Failed to get PDS stats', error instanceof Error ? error : undefined);
      throw new DatabaseError(
        'QUERY',
        'Failed to get PDS stats',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Refreshes relay connectivity status for all PDSes.
   *
   * @remarks
   * Queries the relay's `com.atproto.sync.listHosts` endpoint to get the
   * authoritative list of connected PDSes, then updates the registry.
   * This should be run periodically (e.g., hourly) to keep the status current.
   *
   * @returns Number of PDSes updated
   */
  async refreshRelayConnectivity(): Promise<number> {
    if (!this.relayHostTracker) {
      this.logger.warn('RelayHostTracker not available, skipping relay connectivity refresh');
      return 0;
    }

    try {
      // Get all relay hosts from the tracker
      const relayHosts = await this.relayHostTracker.getRelayHosts();
      const relayHostSet = new Set(relayHosts.map((h) => h.toLowerCase()));

      this.logger.info('Refreshing relay connectivity status', {
        relayHostCount: relayHosts.length,
      });

      // Get all PDSes from registry
      const result = await this.pool.query<{ pds_url: string; is_relay_connected: boolean }>(
        'SELECT pds_url, is_relay_connected FROM pds_registry'
      );

      let updatedCount = 0;

      for (const row of result.rows) {
        try {
          const url = new URL(row.pds_url);
          const hostname = url.hostname.toLowerCase();
          const isRelayConnected = relayHostSet.has(hostname);

          // Only update if status changed
          if (isRelayConnected !== row.is_relay_connected) {
            await this.pool.query(
              'UPDATE pds_registry SET is_relay_connected = $1 WHERE pds_url = $2',
              [isRelayConnected, row.pds_url]
            );
            updatedCount++;
            this.logger.debug('Updated relay connectivity status', {
              pdsUrl: row.pds_url,
              isRelayConnected,
            });
          }
        } catch {
          // Invalid URL, skip
        }
      }

      this.logger.info('Relay connectivity refresh completed', { updatedCount });
      return updatedCount;
    } catch (error) {
      this.logger.error(
        'Failed to refresh relay connectivity',
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Maps a database row to a PDSRegistryEntry.
   */
  private mapRow(row: PDSRegistryRow): PDSRegistryEntry {
    return {
      pdsUrl: row.pds_url,
      discoveredAt: row.discovered_at,
      discoverySource: row.discovery_source,
      status: row.status,
      lastScanAt: row.last_scan_at ?? undefined,
      nextScanAt: row.next_scan_at ?? undefined,
      hasChiveRecords: row.has_chive_records ?? undefined,
      chiveRecordCount: row.chive_record_count,
      consecutiveFailures: row.consecutive_failures,
      scanPriority: row.scan_priority,
      lastError: row.last_error ?? undefined,
      updatedAt: row.updated_at,
      isRelayConnected: row.is_relay_connected,
    };
  }
}
