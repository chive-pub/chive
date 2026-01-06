/**
 * Repository interface for fetching records from user PDSes.
 *
 * @remarks
 * This interface provides read-only access to AT Protocol repositories (PDSes).
 * It allows Chive to fetch records and blobs from user-controlled servers for
 * indexing purposes.
 *
 * ATProto compliance: this interface is read-only; AppViews must not write to
 * user PDSes. Fetched blobs are proxied, not stored. All data fetched via this
 * interface remains in user PDSes as the source of truth.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, CID, DID, NSID } from '../atproto.js';

/**
 * Repository record from AT Protocol PDS.
 *
 * @typeParam T - Record value type
 *
 * @remarks
 * Represents a single record fetched from a user's repository. Contains
 * both the record value and metadata for verification and indexing.
 *
 * @public
 */
export interface RepositoryRecord<T = unknown> {
  /**
   * AT URI uniquely identifying this record.
   */
  readonly uri: AtUri;

  /**
   * CID (content identifier) of this record version.
   *
   * @remarks
   * The CID enables cryptographic verification of record integrity and
   * distinguishes different versions of the same record.
   */
  readonly cid: CID;

  /**
   * Record value (schema-specific data).
   *
   * @remarks
   * Type varies by collection NSID. For example, `pub.chive.preprint.submission`
   * yields preprint data, while `pub.chive.review.comment` yields review data.
   */
  readonly value: T;

  /**
   * DID of the repository owner (record author).
   */
  readonly author: DID;

  /**
   * Timestamp when this record was indexed by Chive.
   *
   * @remarks
   * ISO 8601 format (e.g., "2025-01-15T10:30:00Z").
   * Used for sorting and staleness detection.
   */
  readonly indexedAt: string;
}

/**
 * Options for fetching a single record.
 *
 * @public
 */
export interface GetRecordOptions {
  /**
   * Specific CID version to fetch.
   *
   * @remarks
   * If provided, fetches the record at this specific version.
   * If omitted, fetches the latest version.
   */
  readonly cid?: CID;
}

/**
 * Options for listing records from a collection.
 *
 * @public
 */
export interface ListRecordsOptions {
  /**
   * Maximum number of records to return.
   *
   * @remarks
   * Default: 50. Maximum: 100.
   */
  readonly limit?: number;

  /**
   * Cursor for pagination.
   *
   * @remarks
   * Opaque string returned by previous list operation.
   * Use to fetch next page of results.
   */
  readonly cursor?: string;

  /**
   * Whether to return records in reverse chronological order.
   *
   * @remarks
   * Default: false (oldest first). True: newest first.
   */
  readonly reverse?: boolean;
}

/**
 * Repository interface for fetching records from user PDSes.
 *
 * @remarks
 * This interface is read-only; Chive does not write to user PDSes.
 *
 * Implementation uses AT Protocol endpoints: `com.atproto.repo.getRecord` for
 * single records, `com.atproto.repo.listRecords` for collections, and
 * `com.atproto.sync.getBlob` for blob data. All fetches go directly to the
 * user's PDS via DID resolution.
 *
 * @public
 */
export interface IRepository {
  /**
   * Fetches a single record by AT URI.
   *
   * @typeParam T - Record value type
   * @param uri - AT URI of the record
   * @param options - Fetch options (CID for specific version)
   * @returns Record if found, null otherwise
   *
   * @remarks
   * This method fetches the record from the user's PDS. If the record
   * doesn't exist or the PDS is unreachable, returns null.
   *
   * @example
   * ```typescript
   * const record = await repository.getRecord<PreprintRecord>(
   *   toAtUri('at://did:plc:abc123/pub.chive.preprint.submission/xyz789')!
   * );
   *
   * if (record) {
   *   console.log('Title:', record.value.title);
   * }
   * ```
   *
   * @public
   */
  getRecord<T>(uri: AtUri, options?: GetRecordOptions): Promise<RepositoryRecord<T> | null>;

  /**
   * Lists records from a collection in a user's repository.
   *
   * @typeParam T - Record value type
   * @param did - Repository DID
   * @param collection - Collection NSID
   * @param options - List options (limit, cursor, reverse)
   * @returns Async iterable of records
   *
   * @remarks
   * Returns an async iterable for memory-efficient streaming of large collections.
   * Use `for await...of` to iterate.
   *
   * @example
   * ```typescript
   * const preprints = repository.listRecords<PreprintRecord>(
   *   toDID('did:plc:abc123')!,
   *   toNSID('pub.chive.preprint.submission')!,
   *   { limit: 10 }
   * );
   *
   * for await (const record of preprints) {
   *   console.log('Preprint:', record.value.title);
   * }
   * ```
   *
   * @public
   */
  listRecords<T>(
    did: DID,
    collection: NSID,
    options?: ListRecordsOptions
  ): AsyncIterable<RepositoryRecord<T>>;

  /**
   * Fetches a blob from a user's PDS.
   *
   * @param did - Repository DID
   * @param cid - Blob CID
   * @returns Blob data as readable stream
   *
   * @remarks
   * This method fetches blobs for proxying only; Chive does not store blob data.
   * The stream is piped directly to the client. Use this for proxying PDF
   * downloads, serving images via CDN, or streaming large files.
   *
   * @example
   * ```typescript
   * const pdfStream = await repository.getBlob(
   *   toDID('did:plc:abc123')!,
   *   toCID('bafyreib2rxk...')!
   * );
   *
   * // Pipe to response
   * return new Response(pdfStream, {
   *   headers: { 'Content-Type': 'application/pdf' }
   * });
   * ```
   *
   * @public
   */
  getBlob(did: DID, cid: CID): Promise<ReadableStream<Uint8Array>>;
}
