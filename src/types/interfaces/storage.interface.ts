/**
 * Storage backend interface for Chive's PostgreSQL database.
 *
 * @remarks
 * This interface provides access to Chive's local index database. It stores
 * searchable metadata about preprints, but NOT the source data itself.
 *
 * **CRITICAL ATProto Compliance**:
 * - Stores INDEXES only, not source data
 * - Stores BlobRefs, never blob data
 * - Tracks PDS source for staleness detection
 * - All indexes are rebuildable from firehose
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, BlobRef, CID, DID } from '../atproto.js';
import type { Result } from '../result.js';

/**
 * Stored preprint metadata in Chive's index.
 *
 * @remarks
 * This is an INDEX record, not the source of truth. The authoritative
 * preprint data lives in the user's PDS. This record enables fast searching
 * and browsing without hitting individual PDSes.
 *
 * @public
 */
export interface StoredPreprint {
  /**
   * AT URI of the preprint record.
   */
  readonly uri: AtUri;

  /**
   * CID of the indexed preprint version.
   *
   * @remarks
   * Used to detect when PDS has a newer version (staleness check).
   */
  readonly cid: CID;

  /**
   * Author's DID.
   */
  readonly author: DID;

  /**
   * Preprint title.
   *
   * @remarks
   * Indexed for full-text search and faceted filtering.
   */
  readonly title: string;

  /**
   * Preprint abstract.
   *
   * @remarks
   * Indexed for full-text search.
   */
  readonly abstract: string;

  /**
   * Blob reference to PDF in user's PDS.
   *
   * @remarks
   * This is a BlobRef (CID pointer), not blob data. The actual PDF remains
   * in the user's PDS.
   */
  readonly pdfBlobRef: BlobRef;

  /**
   * AT URI of previous version (if this is an update).
   *
   * @remarks
   * Used to build version chains for preprints with multiple revisions.
   */
  readonly previousVersionUri?: AtUri;

  /**
   * Changelog describing changes in this version.
   *
   * @remarks
   * Optional field provided by authors when uploading a new version.
   */
  readonly versionNotes?: string;

  /**
   * Keywords for searchability and categorization.
   *
   * @remarks
   * User-provided keywords for the preprint. Indexed for full-text search.
   */
  readonly keywords?: readonly string[];

  /**
   * License (SPDX identifier).
   *
   * @example "CC-BY-4.0", "MIT", "Apache-2.0"
   */
  readonly license: string;

  /**
   * URL of the user's PDS where this preprint lives.
   *
   * @remarks
   * Used for:
   * - Staleness detection (checking for updates)
   * - Fetching blobs for proxying
   * - Rebuilding index from source
   */
  readonly pdsUrl: string;

  /**
   * When this record was indexed by Chive.
   */
  readonly indexedAt: Date;

  /**
   * When the preprint was created (from record).
   */
  readonly createdAt: Date;
}

/**
 * Query options for retrieving preprints from index.
 *
 * @public
 */
export interface PreprintQueryOptions {
  /**
   * Maximum number of records to return.
   *
   * @remarks
   * Default: 50. Maximum: 100.
   */
  readonly limit?: number;

  /**
   * Offset for pagination.
   *
   * @remarks
   * For cursor-based pagination, use Elasticsearch instead.
   */
  readonly offset?: number;

  /**
   * Field to sort by.
   *
   * @remarks
   * Default: createdAt (newest first).
   */
  readonly sortBy?: 'createdAt' | 'indexedAt' | 'title';

  /**
   * Sort order.
   *
   * @remarks
   * Default: desc (descending).
   */
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Storage backend interface for Chive's local index.
 *
 * @remarks
 * This interface stores indexes, not source data. All data can be rebuilt
 * from the AT Protocol firehose.
 *
 * Implementation uses PostgreSQL for relational queries, JSONB columns for
 * flexible schema, partitioning for scalability, and indexes on uri, author,
 * and createdAt.
 *
 * @public
 */
export interface IStorageBackend {
  /**
   * Stores or updates a preprint index record.
   *
   * @param preprint - Preprint metadata to index
   * @returns Result indicating success or failure
   *
   * @remarks
   * Upserts the preprint (insert or update based on URI).
   * Updates indexedAt timestamp on every call.
   *
   * **ATProto Compliance**: Stores metadata only, not source data.
   *
   * @example
   * ```typescript
   * const result = await storage.storePreprint({
   *   uri: toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!,
   *   cid: toCID('bafyreib...')!,
   *   author: toDID('did:plc:abc')!,
   *   title: 'Neural Networks in Biology',
   *   abstract: 'This paper explores...',
   *   pdfBlobRef: {
   *     $type: 'blob',
   *     ref: toCID('bafyreib...')!,
   *     mimeType: 'application/pdf',
   *     size: 2048576
   *   },
   *   pdsUrl: 'https://pds.example.com',
   *   indexedAt: new Date(),
   *   createdAt: new Date()
   * });
   *
   * if (!result.ok) {
   *   console.error('Failed to store:', result.error);
   * }
   * ```
   *
   * @public
   */
  storePreprint(preprint: StoredPreprint): Promise<Result<void, Error>>;

  /**
   * Retrieves a preprint index record by URI.
   *
   * @param uri - AT URI of the preprint
   * @returns Preprint if indexed, null otherwise
   *
   * @remarks
   * Returns null if the preprint has not been indexed by Chive.
   * The preprint may still exist in the user's PDS.
   *
   * @example
   * ```typescript
   * const preprint = await storage.getPreprint(
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
  getPreprint(uri: AtUri): Promise<StoredPreprint | null>;

  /**
   * Queries preprints by author.
   *
   * @param author - Author DID
   * @param options - Query options (limit, offset, sort)
   * @returns Array of preprints by this author
   *
   * @remarks
   * Returns preprints in order specified by options.sortBy.
   * For full-text search across all fields, use ISearchEngine instead.
   *
   * @example
   * ```typescript
   * const preprints = await storage.getPreprintsByAuthor(
   *   toDID('did:plc:abc')!,
   *   { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
   * );
   *
   * preprints.forEach(p => console.log(p.title));
   * ```
   *
   * @public
   */
  getPreprintsByAuthor(author: DID, options?: PreprintQueryOptions): Promise<StoredPreprint[]>;

  /**
   * Lists all preprint URIs with pagination.
   *
   * @param options - Query options including limit
   * @returns Array of preprint URIs
   *
   * @remarks
   * Used for browsing all preprints without facet filtering.
   * Returns URIs only for efficiency; full metadata can be fetched separately.
   *
   * @example
   * ```typescript
   * const uris = await storage.listPreprintUris({ limit: 100 });
   * ```
   *
   * @public
   */
  listPreprintUris(options?: { limit?: number; cursor?: string }): Promise<readonly string[]>;

  /**
   * Tracks PDS source for staleness detection.
   *
   * @param uri - Record URI
   * @param pdsUrl - URL of the user's PDS
   * @param lastSynced - Last successful sync timestamp
   * @returns Result indicating success or failure
   *
   * @remarks
   * **ATProto Compliance**: Essential for detecting when index is stale
   * (PDS has newer data) and triggering re-indexing.
   *
   * This enables rebuilding the index from scratch if needed.
   *
   * @example
   * ```typescript
   * await storage.trackPDSSource(
   *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!,
   *   'https://pds.example.com',
   *   new Date()
   * );
   * ```
   *
   * @public
   */
  trackPDSSource(uri: AtUri, pdsUrl: string, lastSynced: Date): Promise<Result<void, Error>>;

  /**
   * Checks if an indexed record is stale (PDS has newer version).
   *
   * @param uri - Record URI
   * @returns True if index is stale, false otherwise
   *
   * @remarks
   * Staleness is detected by comparing:
   * - Indexed CID vs current PDS CID
   * - Last sync time vs PDS update time
   *
   * When stale, the indexing pipeline should re-fetch and re-index.
   *
   * @example
   * ```typescript
   * const isStale = await storage.isStale(
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
  isStale(uri: AtUri): Promise<boolean>;
}
