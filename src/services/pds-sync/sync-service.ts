/**
 * PDS sync service for staleness detection and re-indexing.
 *
 * @remarks
 * Detects when AppView indexes are stale compared to PDS source of truth
 * and triggers refresh operations to maintain eventual consistency.
 *
 * Background job checks records not synced recently (configurable threshold),
 * fetches current versions from PDSes, compares CIDs, and re-indexes if changed.
 *
 * @packageDocumentation
 * @public
 */

import type { IPolicy } from 'cockatiel';
import type { Pool } from 'pg';

import type { AtUri, CID, DID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IRepository } from '../../types/interfaces/repository.interface.js';
import type { IStorageBackend, StoredEprint } from '../../types/interfaces/storage.interface.js';
import type { Result } from '../../types/result.js';

/**
 * Deletion source types.
 *
 * @public
 */
export type DeletionSource = 'pds_404' | 'firehose_tombstone' | 'admin';

/**
 * PDS sync service configuration.
 *
 * @public
 */
export interface PDSSyncServiceOptions {
  /**
   * PostgreSQL connection pool for direct queries.
   */
  readonly pool: Pool;

  /**
   * Storage backend for querying indexed records.
   */
  readonly storage: IStorageBackend;

  /**
   * Repository interface for fetching from user PDSes.
   */
  readonly repository: IRepository;

  /**
   * Resilience policy (circuit breaker + retry) for PDS calls.
   */
  readonly resiliencePolicy: IPolicy;

  /**
   * Logger for sync events.
   */
  readonly logger: ILogger;

  /**
   * Default staleness threshold in milliseconds.
   *
   * @defaultValue 604800000 (7 days)
   */
  readonly defaultMaxAge?: number;

  /**
   * Maximum records to check per batch.
   *
   * @defaultValue 100
   */
  readonly batchSize?: number;
}

/**
 * Staleness detection result.
 *
 * @public
 */
export interface StalenessCheckResult {
  /**
   * Record URI.
   */
  readonly uri: AtUri;

  /**
   * Whether index is stale (PDS has newer version).
   */
  readonly isStale: boolean;

  /**
   * CID in Chive's index.
   */
  readonly indexedCID: CID;

  /**
   * CID from PDS (if fetched successfully).
   */
  readonly pdsCID?: CID;

  /**
   * Error if PDS fetch failed.
   */
  readonly error?: NotFoundError | ValidationError | DatabaseError;
}

/**
 * Refresh result.
 *
 * @public
 */
export interface RefreshResult {
  /**
   * Whether refresh was attempted.
   */
  readonly refreshed: boolean;

  /**
   * Whether content changed.
   */
  readonly changed: boolean;

  /**
   * Previous CID (from index).
   */
  readonly previousCID: CID;

  /**
   * Current CID (from PDS).
   */
  readonly currentCID: CID;

  /**
   * Error if refresh failed.
   */
  readonly error?: NotFoundError | ValidationError | DatabaseError;
}

/**
 * PDS sync service implementation.
 *
 * @remarks
 * Staleness detection process:
 * 1. Query storage for records not synced recently
 * 2. Fetch current version from user's PDS
 * 3. Compare CIDs
 * 4. Re-index if changed, update timestamp if unchanged
 * 5. Process in batches to avoid overwhelming PDSes
 *
 * @example
 * ```typescript
 * import { circuitBreaker, retry, wrap } from 'cockatiel';
 *
 * const resiliencePolicy = wrap(
 *   retry(exponentialBackoff({ maxAttempts: 3 })),
 *   circuitBreaker(consecutiveBreaker(5))
 * );
 *
 * const service = new PDSSyncService({
 *   storage,
 *   repository,
 *   resiliencePolicy,
 *   logger,
 *   defaultMaxAge: 7 * 24 * 60 * 60 * 1000,
 *   batchSize: 100
 * });
 *
 * // Background job (cron)
 * setInterval(async () => {
 *   const stale = await service.detectStaleRecords();
 *   for (const uri of stale) {
 *     const result = await service.refreshRecord(uri);
 *     if (result.ok && result.value.changed) {
 *       console.log(`Re-indexed: ${uri}`);
 *     }
 *   }
 * }, 3600000); // Hourly
 * ```
 *
 * @public
 */
export class PDSSyncService {
  private readonly pool: Pool;
  private readonly storage: IStorageBackend;
  private readonly repository: IRepository;
  private readonly resiliencePolicy: IPolicy;
  private readonly logger: ILogger;
  private readonly defaultMaxAge: number;
  private readonly batchSize: number;

  constructor(options: PDSSyncServiceOptions) {
    this.pool = options.pool;
    this.storage = options.storage;
    this.repository = options.repository;
    this.resiliencePolicy = options.resiliencePolicy;
    this.logger = options.logger;
    this.defaultMaxAge = options.defaultMaxAge ?? 7 * 24 * 60 * 60 * 1000;
    this.batchSize = options.batchSize ?? 100;
  }

  /**
   * Detects stale records needing refresh.
   *
   * @param maxAge - Maximum age in milliseconds
   * @returns Array of stale record URIs
   *
   * @remarks
   * Returns records not synced within threshold. Queries eprints_index
   * for records where last_synced_at is older than the cutoff.
   *
   * @public
   */
  async detectStaleRecords(maxAge?: number): Promise<readonly AtUri[]> {
    const threshold = maxAge ?? this.defaultMaxAge;
    const cutoff = new Date(Date.now() - threshold);

    this.logger.info('Detecting stale records', {
      cutoff: cutoff.toISOString(),
      threshold,
      batchSize: this.batchSize,
    });

    try {
      const result = await this.pool.query<{ uri: string }>(
        `SELECT uri
         FROM eprints_index
         WHERE last_synced_at < $1
         ORDER BY last_synced_at ASC
         LIMIT $2`,
        [cutoff, this.batchSize]
      );

      const staleUris = result.rows.map((row) => row.uri as AtUri);

      this.logger.info('Found stale records', { count: staleUris.length });

      return staleUris;
    } catch (error) {
      this.logger.error(
        'Failed to detect stale records',
        error instanceof Error ? error : undefined
      );
      return [];
    }
  }

  /**
   * Refreshes record from PDS, re-indexing if content changed.
   *
   * @param uri - Record URI to refresh
   * @returns Refresh result with change detection
   *
   * @remarks
   * Fetches current record from PDS with resilience (circuit breaker + retry).
   * Compares CIDs. If changed, updates storage and sync timestamp.
   * If unchanged, updates sync timestamp only.
   *
   * @throws {@link NotFoundError}
   * When record is not found in index.
   *
   * @throws {@link DatabaseError}
   * When PDS fetch or storage update fails.
   *
   * @example
   * ```typescript
   * const result = await service.refreshRecord(uri);
   *
   * if (result.ok) {
   *   if (result.value.changed) {
   *     console.log(`Re-indexed: ${result.value.previousCID} → ${result.value.currentCID}`);
   *   }
   * } else {
   *   console.error('Refresh failed:', result.error.message);
   * }
   * ```
   *
   * @public
   */
  async refreshRecord(
    uri: AtUri
  ): Promise<Result<RefreshResult, NotFoundError | ValidationError | DatabaseError>> {
    this.logger.info('Refreshing record from PDS', { uri });

    try {
      const indexed = await this.storage.getEprint(uri);

      if (!indexed) {
        return {
          ok: false,
          error: new NotFoundError('eprint', uri),
        };
      }

      const pdsRecord = await this.fetchFromPDS(uri);

      if (pdsRecord.ok === false) {
        return {
          ok: false,
          error: pdsRecord.error,
        };
      }

      const fresh = pdsRecord.value;
      const cidsMatch = fresh.cid === indexed.cid;

      if (!cidsMatch) {
        this.logger.info('Content changed, re-indexing', {
          uri,
          oldCID: indexed.cid,
          newCID: fresh.cid,
        });

        const updatedEprint: StoredEprint = {
          uri: fresh.uri,
          cid: fresh.cid,
          authors: indexed.authors,
          submittedBy: indexed.submittedBy,
          paperDid: indexed.paperDid,
          title: indexed.title,
          abstract: indexed.abstract,
          abstractPlainText: indexed.abstractPlainText,
          documentBlobRef: indexed.documentBlobRef,
          documentFormat: indexed.documentFormat,
          supplementaryMaterials: indexed.supplementaryMaterials,
          previousVersionUri: indexed.previousVersionUri,
          versionNotes: indexed.versionNotes,
          keywords: indexed.keywords,
          license: indexed.license,
          publicationStatus: indexed.publicationStatus,
          publishedVersion: indexed.publishedVersion,
          externalIds: indexed.externalIds,
          relatedWorks: indexed.relatedWorks,
          repositories: indexed.repositories,
          funding: indexed.funding,
          conferencePresentation: indexed.conferencePresentation,
          pdsUrl: indexed.pdsUrl,
          indexedAt: new Date(),
          createdAt: indexed.createdAt,
        };

        const storeResult = await this.storage.storeEprint(updatedEprint);

        if (storeResult.ok === false) {
          return {
            ok: false,
            error:
              storeResult.error instanceof DatabaseError
                ? storeResult.error
                : new DatabaseError('WRITE', 'Failed to store eprint'),
          };
        }

        await this.storage.trackPDSSource(uri, indexed.pdsUrl, new Date());

        return {
          ok: true,
          value: {
            refreshed: true,
            changed: true,
            previousCID: indexed.cid,
            currentCID: fresh.cid,
          },
        };
      } else {
        this.logger.debug('No changes detected, updating sync timestamp', { uri });

        await this.storage.trackPDSSource(uri, indexed.pdsUrl, new Date());

        return {
          ok: true,
          value: {
            refreshed: true,
            changed: false,
            previousCID: indexed.cid,
            currentCID: fresh.cid,
          },
        };
      }
    } catch (error) {
      this.logger.error('Failed to refresh record', error instanceof Error ? error : undefined, {
        uri,
      });

      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        return {
          ok: false,
          error,
        };
      }

      return {
        ok: false,
        error: new DatabaseError('QUERY', 'Failed to refresh record from PDS'),
      };
    }
  }

  /**
   * Checks if record is stale (needs refresh).
   *
   * @param uri - Record URI
   * @returns Staleness check result
   *
   * @remarks
   * Wrapper around {@link IStorageBackend.isStale} with enhanced result.
   * Optionally fetches from PDS to get current CID.
   *
   * @example
   * ```typescript
   * const result = await service.checkStaleness(uri);
   *
   * if (result.isStale) {
   *   await service.refreshRecord(uri);
   * }
   * ```
   *
   * @public
   */
  async checkStaleness(uri: AtUri): Promise<StalenessCheckResult> {
    try {
      const indexed = await this.storage.getEprint(uri);

      if (!indexed) {
        throw new NotFoundError('eprint', uri);
      }

      const isStale = await this.storage.isStale(uri);

      if (!isStale) {
        return {
          uri,
          isStale: false,
          indexedCID: indexed.cid,
        };
      }

      const pdsRecord = await this.fetchFromPDS(uri);

      if (pdsRecord.ok === false) {
        return {
          uri,
          isStale: true,
          indexedCID: indexed.cid,
          error: pdsRecord.error,
        };
      }

      return {
        uri,
        isStale: pdsRecord.value.cid !== indexed.cid,
        indexedCID: indexed.cid,
        pdsCID: pdsRecord.value.cid,
      };
    } catch (error) {
      return {
        uri,
        isStale: false,
        indexedCID: '' as CID,
        error:
          error instanceof DatabaseError
            ? error
            : new DatabaseError('QUERY', 'Failed to check staleness'),
      };
    }
  }

  /**
   * Tracks PDS update after indexing new record.
   *
   * @param uri - Record URI
   * @param cid - New CID
   * @param pdsUrl - PDS endpoint
   * @returns Result indicating success or failure
   *
   * @remarks
   * Called by indexing pipeline after successfully indexing a record
   * from the firehose to track sync state.
   *
   * @public
   */
  async trackPDSUpdate(uri: AtUri, cid: CID, pdsUrl: string): Promise<Result<void, DatabaseError>> {
    this.logger.debug('Tracking PDS update', { uri, cid, pdsUrl });

    try {
      const result = await this.storage.trackPDSSource(uri, pdsUrl, new Date());

      if (result.ok === false) {
        return {
          ok: false,
          error: new DatabaseError('WRITE', result.error.message),
        };
      }

      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'WRITE',
          error instanceof Error ? error.message : 'Failed to track PDS update'
        ),
      };
    }
  }

  /**
   * Marks a record as deleted (soft delete).
   *
   * @param uri - Record URI
   * @param source - How deletion was detected
   * @returns Result indicating success or failure
   *
   * @remarks
   * Soft-deletes a record when:
   * - PDS returns 404 during freshness check
   * - Firehose emits a tombstone event
   * - Admin manually deletes
   *
   * Records are marked with `deleted_at` timestamp and `deletion_source`.
   * They are excluded from normal queries but retained for audit purposes.
   *
   * @example
   * ```typescript
   * // When PDS returns 404
   * const result = await syncService.markAsDeleted(uri, 'pds_404');
   *
   * if (result.ok) {
   *   console.log('Record marked as deleted');
   * }
   * ```
   *
   * @public
   */
  async markAsDeleted(
    uri: AtUri,
    source: DeletionSource
  ): Promise<Result<void, NotFoundError | DatabaseError>> {
    this.logger.info('Marking record as deleted', { uri, source });

    try {
      const result = await this.pool.query(
        `UPDATE eprints_index
         SET deleted_at = NOW(), deletion_source = $2
         WHERE uri = $1 AND deleted_at IS NULL`,
        [uri, source]
      );

      if (result.rowCount === 0) {
        // Record either doesn't exist or already deleted
        const existsResult = await this.pool.query<{ deleted_at: Date | null }>(
          `SELECT deleted_at FROM eprints_index WHERE uri = $1`,
          [uri]
        );

        if (existsResult.rows.length === 0) {
          return {
            ok: false,
            error: new NotFoundError('eprint', uri),
          };
        }

        // Already deleted - no error, just no-op
        this.logger.debug('Record already deleted', { uri });
        return { ok: true, value: undefined };
      }

      this.logger.info('Record marked as deleted', { uri, source });
      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error(
        'Failed to mark record as deleted',
        error instanceof Error ? error : undefined,
        {
          uri,
          source,
        }
      );

      return {
        ok: false,
        error: new DatabaseError(
          'WRITE',
          error instanceof Error ? error.message : 'Failed to mark record as deleted'
        ),
      };
    }
  }

  /**
   * Restores a soft-deleted record.
   *
   * @param uri - Record URI
   * @returns Result indicating success or failure
   *
   * @remarks
   * Removes the `deleted_at` and `deletion_source` flags from a record,
   * restoring it to active status. Useful for admin corrections.
   *
   * @public
   */
  async restoreRecord(uri: AtUri): Promise<Result<void, NotFoundError | DatabaseError>> {
    this.logger.info('Restoring deleted record', { uri });

    try {
      const result = await this.pool.query(
        `UPDATE eprints_index
         SET deleted_at = NULL, deletion_source = NULL
         WHERE uri = $1 AND deleted_at IS NOT NULL`,
        [uri]
      );

      if (result.rowCount === 0) {
        return {
          ok: false,
          error: new NotFoundError('eprint', uri),
        };
      }

      this.logger.info('Record restored', { uri });
      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to restore record', error instanceof Error ? error : undefined, {
        uri,
      });

      return {
        ok: false,
        error: new DatabaseError(
          'WRITE',
          error instanceof Error ? error.message : 'Failed to restore record'
        ),
      };
    }
  }

  /**
   * Gets deleted records for cleanup.
   *
   * @param gracePeriodMs - Only return records deleted longer than this
   * @param limit - Maximum records to return
   * @returns Array of deleted record URIs
   *
   * @remarks
   * Used by cleanup jobs to find records that have been soft-deleted
   * for longer than the grace period and can be permanently removed.
   *
   * @public
   */
  async getDeletedRecords(
    gracePeriodMs: number = 7 * 24 * 60 * 60 * 1000,
    limit = 100
  ): Promise<readonly AtUri[]> {
    const cutoff = new Date(Date.now() - gracePeriodMs);

    try {
      const result = await this.pool.query<{ uri: string }>(
        `SELECT uri
         FROM eprints_index
         WHERE deleted_at IS NOT NULL
           AND deleted_at < $1
         ORDER BY deleted_at ASC
         LIMIT $2`,
        [cutoff, limit]
      );

      return result.rows.map((row) => row.uri as AtUri);
    } catch (error) {
      this.logger.error(
        'Failed to get deleted records',
        error instanceof Error ? error : undefined
      );
      return [];
    }
  }

  /**
   * Fetches record from PDS with resilience.
   *
   * @param uri - Record URI
   * @returns Repository record from PDS
   *
   * @remarks
   * Uses {@link IRepository.getRecord} with resilience policy
   * (circuit breaker + retry). Handles 404 (record deleted) and
   * network errors gracefully.
   *
   * @private
   */
  private async fetchFromPDS<T = unknown>(
    uri: AtUri
  ): Promise<
    Result<
      { readonly uri: AtUri; readonly cid: CID; readonly author: DID; readonly value: T },
      NotFoundError | ValidationError | DatabaseError
    >
  > {
    try {
      const record = await this.resiliencePolicy.execute(async () => {
        return await this.repository.getRecord<T>(uri);
      });

      if (!record) {
        return {
          ok: false,
          error: new NotFoundError('record', uri),
        };
      }

      if (!record.uri || !record.cid || !record.author) {
        return {
          ok: false,
          error: new ValidationError(
            'Invalid record from PDS: missing uri, cid, or author',
            'record'
          ),
        };
      }

      return {
        ok: true,
        value: {
          uri: record.uri,
          cid: record.cid,
          author: record.author,
          value: record.value,
        },
      };
    } catch (error) {
      this.logger.error('PDS fetch failed', error instanceof Error ? error : undefined, { uri });

      return {
        ok: false,
        error:
          error instanceof DatabaseError
            ? error
            : new DatabaseError('FETCH', 'Failed to fetch from PDS'),
      };
    }
  }
}
