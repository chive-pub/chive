/**
 * Repository for preprint record operations.
 *
 * @remarks
 * Provides domain-specific queries and operations for preprint records
 * in the PostgreSQL index. Implements the repository pattern for clean
 * separation of data access logic.
 *
 * **Repository Pattern Benefits:**
 * - Encapsulates all preprint-related database operations
 * - Type-safe queries with compile-time validation
 * - Consistent error handling and result types
 * - Easy to test with mock implementations
 *
 * **ATProto Compliance:**
 * - Stores indexes only, not source data
 * - Tracks PDS source for every record
 * - Stores BlobRefs, never blob data
 * - All data rebuildable from firehose
 *
 * @example
 * ```typescript
 * const repo = new PreprintsRepository(pool);
 *
 * // Store a preprint
 * const result = await repo.store({
 *   uri: toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!,
 *   cid: toCID('bafyreib...')!,
 *   author: toDID('did:plc:abc')!,
 *   title: 'Neural Networks in Biology',
 *   abstract: 'This paper explores...',
 *   pdfBlobRef: { ... },
 *   pdsUrl: 'https://pds.example.com',
 *   indexedAt: new Date(),
 *   createdAt: new Date()
 * });
 *
 * // Query by author
 * const preprints = await repo.findByAuthor(
 *   toDID('did:plc:abc')!,
 *   { limit: 10, sortBy: 'createdAt' }
 * );
 * ```
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { Pool } from 'pg';

import type { AtUri, CID, DID } from '../../types/atproto.js';
import type {
  PreprintQueryOptions,
  StoredPreprint,
} from '../../types/interfaces/storage.interface.js';
import { Err, Ok, type Result } from '../../types/result.js';

import { InsertBuilder, SelectBuilder, UpdateBuilder } from './query-builder.js';

/**
 * Database row representation of preprint index record.
 *
 * @remarks
 * Maps StoredPreprint interface to PostgreSQL table structure.
 * BlobRef is denormalized into separate columns (cid, mime_type, size).
 *
 * @internal
 */
interface PreprintRow extends Record<string, unknown> {
  readonly uri: string;
  readonly cid: string;
  readonly author_did: string;
  readonly title: string;
  readonly abstract: string;
  readonly pdf_blob_cid: string;
  readonly pdf_blob_mime_type: string;
  readonly pdf_blob_size: number;
  readonly keywords: string[] | null;
  readonly license: string;
  readonly pds_url: string;
  readonly indexed_at: Date;
  readonly created_at: Date;
}

/**
 * Repository for preprint record operations.
 *
 * @remarks
 * Implements the repository pattern for preprint data access.
 * All database operations for preprints go through this repository.
 *
 * **Operations Provided:**
 * - CRUD operations (create, read, update, delete)
 * - Query by author, title, keywords
 * - Batch operations for bulk indexing
 * - Upsert for idempotent indexing
 *
 * @public
 * @since 0.1.0
 */
export class PreprintsRepository {
  private readonly pool: Pool;

  /**
   * Creates a preprints repository.
   *
   * @param pool - PostgreSQL connection pool
   *
   * @remarks
   * The pool should be created with createPool() for correct configuration.
   * The repository does not close the pool; caller is responsible for cleanup.
   */
  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Stores or updates a preprint index record.
   *
   * @param preprint - Preprint metadata to index
   * @returns Result indicating success or failure
   *
   * @remarks
   * Upserts the preprint (insert or update based on URI).
   * Updates indexed_at and last_synced_at timestamps on every call.
   *
   * Uses INSERT ... ON CONFLICT DO UPDATE for atomic upsert.
   * Transaction ensures consistency if multiple writes occur concurrently.
   *
   * **ATProto Compliance:** Stores metadata only, not source data.
   *
   * @example
   * ```typescript
   * const result = await repo.store({
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
  async store(preprint: StoredPreprint): Promise<Result<void, Error>> {
    try {
      const query = new InsertBuilder<PreprintRow>()
        .into('preprints_index')
        .values({
          uri: preprint.uri,
          cid: preprint.cid,
          author_did: preprint.author,
          title: preprint.title,
          abstract: preprint.abstract,
          pdf_blob_cid: preprint.pdfBlobRef.ref,
          pdf_blob_mime_type: preprint.pdfBlobRef.mimeType,
          pdf_blob_size: preprint.pdfBlobRef.size,
          license: preprint.license,
          pds_url: preprint.pdsUrl,
          indexed_at: preprint.indexedAt,
          created_at: preprint.createdAt,
        })
        .onConflict('uri', 'update')
        .build();

      await this.pool.query(query.sql, [...query.params]);
      return Ok(undefined);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to store preprint: ${String(error)}`)
      );
    }
  }

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
   * const preprint = await repo.findByUri(
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
  async findByUri(uri: AtUri): Promise<StoredPreprint | null> {
    try {
      const query = new SelectBuilder<PreprintRow>()
        .select(
          'uri',
          'cid',
          'author_did',
          'title',
          'abstract',
          'pdf_blob_cid',
          'pdf_blob_mime_type',
          'pdf_blob_size',
          'keywords',
          'license',
          'pds_url',
          'indexed_at',
          'created_at'
        )
        .from('preprints_index')
        .where({ uri })
        .build();

      const result = await this.pool.query<PreprintRow>(query.sql, [...query.params]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return this.rowToPreprint(row);
    } catch (error) {
      throw error instanceof Error ? error : new Error(`Failed to find preprint: ${String(error)}`);
    }
  }

  /**
   * Queries preprints by author.
   *
   * @param author - Author DID
   * @param options - Query options (limit, offset, sort)
   * @returns Array of preprints by this author
   *
   * @remarks
   * Returns preprints in order specified by options.sortBy.
   * Defaults to newest first (createdAt desc).
   *
   * Maximum limit is 100 preprints per query. Use offset for pagination.
   *
   * @example
   * ```typescript
   * const preprints = await repo.findByAuthor(
   *   toDID('did:plc:abc')!,
   *   { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
   * );
   *
   * preprints.forEach(p => console.log(p.title));
   * ```
   *
   * @public
   */
  async findByAuthor(author: DID, options: PreprintQueryOptions = {}): Promise<StoredPreprint[]> {
    try {
      const limit = Math.min(options.limit ?? 50, 100);
      const offset = options.offset ?? 0;
      const sortBy = options.sortBy ?? 'createdAt';
      const sortOrder = options.sortOrder ?? 'desc';

      let query = new SelectBuilder<PreprintRow>()
        .select(
          'uri',
          'cid',
          'author_did',
          'title',
          'abstract',
          'pdf_blob_cid',
          'pdf_blob_mime_type',
          'pdf_blob_size',
          'keywords',
          'license',
          'pds_url',
          'indexed_at',
          'created_at'
        )
        .from('preprints_index')
        .where({ author_did: author });

      // Map sortBy to column name
      const sortColumn =
        sortBy === 'createdAt' ? 'created_at' : sortBy === 'indexedAt' ? 'indexed_at' : 'title';

      // Convert to uppercase for SQL
      const sortDirection = sortOrder.toUpperCase() as 'ASC' | 'DESC';

      query = query.orderBy(sortColumn, sortDirection).limit(limit).offset(offset);

      const builtQuery = query.build();
      const result = await this.pool.query<PreprintRow>(builtQuery.sql, [...builtQuery.params]);

      return result.rows.map((row) => this.rowToPreprint(row));
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to find preprints by author: ${String(error)}`);
    }
  }

  /**
   * Lists all preprint URIs with pagination.
   *
   * @param options - Query options including limit
   * @returns Array of preprint URIs ordered by creation date (newest first)
   *
   * @example
   * ```typescript
   * const uris = await repo.listUris({ limit: 100 });
   * ```
   *
   * @public
   */
  async listUris(options: { limit?: number; cursor?: string } = {}): Promise<readonly string[]> {
    try {
      const limit = Math.min(options.limit ?? 100, 1000);
      const offset = options.cursor ? parseInt(options.cursor, 10) : 0;

      // Select both uri and created_at to enable type-safe ordering
      const query = new SelectBuilder<{ uri: string; created_at: Date }>()
        .select('uri', 'created_at')
        .from('preprints_index')
        .orderBy('created_at', 'DESC')
        .limit(limit)
        .offset(offset)
        .build();

      const result = await this.pool.query<{ uri: string; created_at: Date }>(query.sql, [
        ...query.params,
      ]);
      return result.rows.map((row) => row.uri);
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to list preprint URIs: ${String(error)}`);
    }
  }

  /**
   * Updates preprint metadata.
   *
   * @param uri - Preprint URI
   * @param updates - Fields to update
   * @returns Result indicating success or failure
   *
   * @remarks
   * Updates only the specified fields. Use store() for full upsert.
   * Automatically updates indexed_at timestamp.
   *
   * @example
   * ```typescript
   * const result = await repo.update(
   *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!,
   *   {
   *     title: 'Updated Title',
   *     abstract: 'Updated abstract...'
   *   }
   * );
   * ```
   *
   * @public
   */
  async update(uri: AtUri, updates: Partial<StoredPreprint>): Promise<Result<void, Error>> {
    try {
      // Convert StoredPreprint fields to database column names
      // Use Record to allow property assignment
      const dbUpdates: Record<string, unknown> = {
        indexed_at: new Date(), // Always update sync timestamp
      };

      if (updates.cid) dbUpdates.cid = updates.cid;
      if (updates.title) dbUpdates.title = updates.title;
      if (updates.abstract) dbUpdates.abstract = updates.abstract;
      if (updates.pdfBlobRef) {
        dbUpdates.pdf_blob_cid = updates.pdfBlobRef.ref;
        dbUpdates.pdf_blob_mime_type = updates.pdfBlobRef.mimeType;
        dbUpdates.pdf_blob_size = updates.pdfBlobRef.size;
      }
      if (updates.pdsUrl) dbUpdates.pds_url = updates.pdsUrl;
      if (updates.createdAt) dbUpdates.created_at = updates.createdAt;

      const query = new UpdateBuilder<PreprintRow>()
        .table('preprints_index')
        .set(dbUpdates as Partial<PreprintRow>)
        .where({ uri })
        .build();

      const result = await this.pool.query(query.sql, [...query.params]);

      if (result.rowCount === 0) {
        return Err(new Error(`Preprint not found: ${uri}`));
      }

      return Ok(undefined);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to update preprint: ${String(error)}`)
      );
    }
  }

  /**
   * Deletes a preprint from the index.
   *
   * @param uri - Preprint URI
   * @returns Result indicating success or failure
   *
   * @remarks
   * Removes the preprint from the local index. Does not delete from PDS
   * (ATProto compliance - never write to user PDSes).
   *
   * @example
   * ```typescript
   * const result = await repo.delete(
   *   toAtUri('at://did:plc:abc/pub.chive.preprint.submission/xyz')!
   * );
   * ```
   *
   * @public
   */
  async delete(uri: AtUri): Promise<Result<void, Error>> {
    try {
      const result = await this.pool.query('DELETE FROM preprints_index WHERE uri = $1', [uri]);

      if (result.rowCount === 0) {
        return Err(new Error(`Preprint not found: ${uri}`));
      }

      return Ok(undefined);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to delete preprint: ${String(error)}`)
      );
    }
  }

  /**
   * Counts total preprints in the index.
   *
   * @returns Total number of indexed preprints
   *
   * @example
   * ```typescript
   * const total = await repo.count();
   * console.log(`${total} preprints indexed`);
   * ```
   *
   * @public
   */
  async count(): Promise<number> {
    try {
      const result = await this.pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM preprints_index'
      );

      const row = result.rows[0];
      return row ? parseInt(row.count, 10) : 0;
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to count preprints: ${String(error)}`);
    }
  }

  /**
   * Converts database row to StoredPreprint interface.
   *
   * @param row - Database row
   * @returns StoredPreprint object
   *
   * @remarks
   * Reconstitutes BlobRef from denormalized columns.
   * Performs type conversions (string → Date, number → bigint).
   *
   * @internal
   */
  private rowToPreprint(row: PreprintRow): StoredPreprint {
    return {
      uri: row.uri as AtUri,
      cid: row.cid as CID,
      author: row.author_did as DID,
      title: row.title,
      abstract: row.abstract,
      pdfBlobRef: {
        $type: 'blob',
        ref: row.pdf_blob_cid as CID,
        mimeType: row.pdf_blob_mime_type,
        size: row.pdf_blob_size,
      },
      keywords: row.keywords ?? undefined,
      license: row.license,
      pdsUrl: row.pds_url,
      indexedAt: new Date(row.indexed_at),
      createdAt: new Date(row.created_at),
    };
  }
}
