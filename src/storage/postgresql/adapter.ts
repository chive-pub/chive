/**
 * PostgreSQL implementation of IStorageBackend.
 *
 * @remarks
 * Provides storage operations for Chive's local index using PostgreSQL.
 * Implements the IStorageBackend interface as a thin orchestration layer
 * that delegates to specialized repository classes.
 *
 * **Architecture Pattern:**
 * - Adapter implements IStorageBackend interface
 * - Delegates to PreprintsRepository for CRUD operations
 * - Delegates to PDSTracker for source tracking
 * - Delegates to StalenessDetector for staleness checks
 *
 * **ATProto Compliance:**
 * - Stores indexes only, not source data
 * - Tracks PDS URLs for rebuilding
 * - Stores BlobRefs, never blob data
 * - All data rebuildable from firehose
 *
 * @example
 * ```typescript
 * import { createPool } from './connection.js';
 * import { getDatabaseConfig } from './config.js';
 * import { PostgreSQLAdapter } from './adapter.js';
 *
 * const config = getDatabaseConfig();
 * const pool = createPool(config);
 * const storage = new PostgreSQLAdapter(pool);
 *
 * // Store preprint
 * const result = await storage.storePreprint({
 *   uri: toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!,
 *   cid: toCID('bafyreib...')!,
 *   author: toDID('did:plc:abc')!,
 *   title: 'Neural Networks in Biology',
 *   abstract: 'This paper explores...',
 *   documentBlobRef: {
 *     $type: 'blob',
 *     ref: toCID('bafyreib...')!,
 *     mimeType: 'application/pdf',
 *     size: 2048576
 *   },
 *   pdsUrl: 'https://pds.example.com',
 *   indexedAt: new Date(),
 *   createdAt: new Date()
 * });
 * ```
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { Pool } from 'pg';

import type { AtUri, DID } from '../../types/atproto.js';
import type {
  IStorageBackend,
  PreprintQueryOptions,
  StoredPreprint,
} from '../../types/interfaces/storage.interface.js';
import type { Result } from '../../types/result.js';

import { PDSTracker } from './pds-tracker.js';
import { PreprintsRepository } from './preprints-repository.js';
import { StalenessDetector } from './staleness-detector.js';

/**
 * PostgreSQL storage adapter implementing IStorageBackend.
 *
 * @remarks
 * Thin orchestration layer that delegates to specialized repositories.
 * This design provides clean separation of concerns and makes testing easier.
 *
 * **Delegation Strategy:**
 * - PreprintsRepository handles all preprint CRUD operations
 * - PDSTracker manages PDS source tracking
 * - StalenessDetector checks if records need re-indexing
 *
 * @public
 * @since 0.1.0
 */
export class PostgreSQLAdapter implements IStorageBackend {
  private readonly preprintsRepo: PreprintsRepository;
  private readonly pdsTracker: PDSTracker;
  private readonly stalenessDetector: StalenessDetector;

  /**
   * Creates PostgreSQL storage adapter.
   *
   * @param pool - Database connection pool
   *
   * @remarks
   * The pool should be created with createPool() for correct configuration.
   * The adapter does not close the pool; caller is responsible for cleanup.
   *
   * Initializes all repository instances with the same connection pool
   * for efficient resource sharing.
   */
  constructor(pool: Pool) {
    this.preprintsRepo = new PreprintsRepository(pool);
    this.pdsTracker = new PDSTracker(pool);
    this.stalenessDetector = new StalenessDetector(pool);
  }

  /**
   * Stores or updates a preprint index record.
   *
   * @param preprint - Preprint metadata to index
   * @returns Result indicating success or failure
   *
   * @remarks
   * Delegates to PreprintsRepository for the actual storage operation.
   * Upserts the preprint (insert or update based on URI).
   *
   * **ATProto Compliance:** Stores metadata only, not source data.
   *
   * @example
   * ```typescript
   * const result = await adapter.storePreprint({
   *   uri: toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!,
   *   cid: toCID('bafyreib...')!,
   *   author: toDID('did:plc:abc')!,
   *   title: 'Neural Networks in Biology',
   *   abstract: 'This paper explores...',
   *   documentBlobRef: {
   *     $type: 'blob',
   *     ref: toCID('bafyreib...')!,
   *     mimeType: 'application/pdf',
   *     size: 2048576
   *   },
   *   pdsUrl: 'https://pds.example.com',
   *   indexedAt: new Date(),
   *   createdAt: new Date()
   * });
   * ```
   *
   * @public
   */
  async storePreprint(preprint: StoredPreprint): Promise<Result<void, Error>> {
    return this.preprintsRepo.store(preprint);
  }

  /**
   * Retrieves a preprint index record by URI.
   *
   * @param uri - AT URI of the preprint
   * @returns Preprint if indexed, null otherwise
   *
   * @remarks
   * Delegates to PreprintsRepository for the query.
   * Returns null if the preprint has not been indexed by Chive.
   * The preprint may still exist in the user's PDS.
   *
   * @example
   * ```typescript
   * const preprint = await adapter.getPreprint(
   *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!
   * );
   *
   * if (preprint) {
   *   console.log('Title:', preprint.title);
   * }
   * ```
   *
   * @public
   */
  async getPreprint(uri: AtUri): Promise<StoredPreprint | null> {
    return this.preprintsRepo.findByUri(uri);
  }

  /**
   * Queries preprints by author.
   *
   * @param author - Author DID
   * @param options - Query options (limit, offset, sort)
   * @returns Array of preprints by this author
   *
   * @remarks
   * Delegates to PreprintsRepository for the query.
   * Returns preprints in order specified by options.sortBy.
   * Defaults to newest first (createdAt desc).
   *
   * @example
   * ```typescript
   * const preprints = await adapter.getPreprintsByAuthor(
   *   toDID('did:plc:abc')!,
   *   { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
   * );
   *
   * preprints.forEach(p => console.log(p.title));
   * ```
   *
   * @public
   */
  async getPreprintsByAuthor(
    author: DID,
    options: PreprintQueryOptions = {}
  ): Promise<StoredPreprint[]> {
    return this.preprintsRepo.findByAuthor(author, options);
  }

  /**
   * Lists all preprint URIs with pagination.
   *
   * @param options - Query options including limit
   * @returns Array of preprint URIs
   *
   * @remarks
   * Used for browsing all preprints without facet filtering.
   *
   * @public
   */
  async listPreprintUris(
    options: { limit?: number; cursor?: string } = {}
  ): Promise<readonly string[]> {
    return this.preprintsRepo.listUris(options);
  }

  /**
   * Tracks PDS source for staleness detection.
   *
   * @param uri - Record URI
   * @param pdsUrl - URL of the user's PDS
   * @param lastSynced - Last successful sync timestamp
   * @returns Result indicating success or failure
   *
   * @remarks
   * Delegates to PDSTracker for source tracking.
   * Essential for detecting when index is stale (PDS has newer data).
   *
   * **ATProto Compliance:** Required for credible exit and rebuild capabilities.
   *
   * @example
   * ```typescript
   * await adapter.trackPDSSource(
   *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!,
   *   'https://pds.example.com',
   *   new Date()
   * );
   * ```
   *
   * @public
   */
  async trackPDSSource(uri: AtUri, pdsUrl: string, lastSynced: Date): Promise<Result<void, Error>> {
    return this.pdsTracker.trackSource(uri, pdsUrl, lastSynced);
  }

  /**
   * Checks if an indexed record is stale (PDS has newer version).
   *
   * @param uri - Record URI
   * @returns True if index is stale, false otherwise
   *
   * @remarks
   * Delegates to StalenessDetector for the check.
   * Compares indexed CID with current PDS CID.
   * Falls back to time-based check if PDS is unreachable.
   *
   * **ATProto Compliance:** Ensures index accuracy by detecting outdated records.
   *
   * @example
   * ```typescript
   * const isStale = await adapter.isStale(
   *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!
   * );
   *
   * if (isStale) {
   *   console.log('Re-indexing required');
   * }
   * ```
   *
   * @public
   */
  async isStale(uri: AtUri): Promise<boolean> {
    return this.stalenessDetector.isStale(uri);
  }
}
