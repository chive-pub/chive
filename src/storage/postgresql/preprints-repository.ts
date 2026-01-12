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
 *   documentBlobRef: { ... },
 *   documentFormat: 'pdf',
 *   publicationStatus: 'preprint',
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
import type { PreprintAuthor } from '../../types/models/author.js';
import type {
  ConferencePresentation,
  DocumentFormat,
  ExternalIds,
  FundingSource,
  PublicationStatus,
  PublishedVersion,
  RelatedWork,
  Repositories,
  SupplementaryMaterial,
} from '../../types/models/preprint.js';
import { Err, Ok, type Result } from '../../types/result.js';

import { InsertBuilder, SelectBuilder, UpdateBuilder } from './query-builder.js';

/**
 * Database row representation of preprint index record.
 *
 * @remarks
 * Maps StoredPreprint interface to PostgreSQL table structure.
 * BlobRef is denormalized into separate columns (cid, mime_type, size).
 * Complex metadata stored as JSONB.
 *
 * @internal
 */
interface PreprintRow extends Record<string, unknown> {
  readonly uri: string;
  readonly cid: string;
  readonly authors: string; // JSONB stored as string
  readonly submitted_by: string;
  readonly paper_did: string | null;
  readonly title: string;
  readonly abstract: string;
  readonly document_blob_cid: string;
  readonly document_blob_mime_type: string;
  readonly document_blob_size: number;
  readonly document_format: string;
  readonly keywords: string[] | null;
  readonly license: string;
  readonly publication_status: string;
  readonly published_version: string | null; // JSONB
  readonly external_ids: string | null; // JSONB
  readonly related_works: string | null; // JSONB
  readonly repositories: string | null; // JSONB
  readonly funding: string | null; // JSONB
  readonly conference_presentation: string | null; // JSONB
  readonly supplementary_materials: string | null; // JSONB
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
   *   documentBlobRef: {
   *     $type: 'blob',
   *     ref: toCID('bafyreib...')!,
   *     mimeType: 'application/pdf',
   *     size: 2048576
   *   },
   *   documentFormat: 'pdf',
   *   publicationStatus: 'preprint',
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
          authors: JSON.stringify(preprint.authors),
          submitted_by: preprint.submittedBy,
          paper_did: preprint.paperDid ?? null,
          title: preprint.title,
          abstract: preprint.abstract,
          document_blob_cid: preprint.documentBlobRef.ref,
          document_blob_mime_type: preprint.documentBlobRef.mimeType,
          document_blob_size: preprint.documentBlobRef.size,
          document_format: preprint.documentFormat,
          keywords: preprint.keywords ? [...preprint.keywords] : null,
          license: preprint.license,
          publication_status: preprint.publicationStatus,
          published_version: preprint.publishedVersion
            ? JSON.stringify(preprint.publishedVersion)
            : null,
          external_ids: preprint.externalIds ? JSON.stringify(preprint.externalIds) : null,
          related_works: preprint.relatedWorks ? JSON.stringify(preprint.relatedWorks) : null,
          repositories: preprint.repositories ? JSON.stringify(preprint.repositories) : null,
          funding: preprint.funding ? JSON.stringify(preprint.funding) : null,
          conference_presentation: preprint.conferencePresentation
            ? JSON.stringify(preprint.conferencePresentation)
            : null,
          supplementary_materials: preprint.supplementaryMaterials
            ? JSON.stringify(preprint.supplementaryMaterials)
            : null,
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
          'authors',
          'submitted_by',
          'paper_did',
          'title',
          'abstract',
          'document_blob_cid',
          'document_blob_mime_type',
          'document_blob_size',
          'document_format',
          'keywords',
          'license',
          'publication_status',
          'published_version',
          'external_ids',
          'related_works',
          'repositories',
          'funding',
          'conference_presentation',
          'supplementary_materials',
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

      // Note: This queries by submitted_by. To query by any author DID,
      // use the JSONB query: authors @> '[{"did": "..."}]'
      let query = new SelectBuilder<PreprintRow>()
        .select(
          'uri',
          'cid',
          'authors',
          'submitted_by',
          'paper_did',
          'title',
          'abstract',
          'document_blob_cid',
          'document_blob_mime_type',
          'document_blob_size',
          'document_format',
          'keywords',
          'license',
          'publication_status',
          'published_version',
          'external_ids',
          'related_works',
          'repositories',
          'funding',
          'conference_presentation',
          'supplementary_materials',
          'pds_url',
          'indexed_at',
          'created_at'
        )
        .from('preprints_index')
        .where({ submitted_by: author });

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
      if (updates.documentBlobRef) {
        dbUpdates.document_blob_cid = updates.documentBlobRef.ref;
        dbUpdates.document_blob_mime_type = updates.documentBlobRef.mimeType;
        dbUpdates.document_blob_size = updates.documentBlobRef.size;
      }
      if (updates.documentFormat) dbUpdates.document_format = updates.documentFormat;
      if (updates.publicationStatus) dbUpdates.publication_status = updates.publicationStatus;
      if (updates.publishedVersion !== undefined) {
        dbUpdates.published_version = updates.publishedVersion
          ? JSON.stringify(updates.publishedVersion)
          : null;
      }
      if (updates.externalIds !== undefined) {
        dbUpdates.external_ids = updates.externalIds ? JSON.stringify(updates.externalIds) : null;
      }
      if (updates.relatedWorks !== undefined) {
        dbUpdates.related_works = updates.relatedWorks
          ? JSON.stringify(updates.relatedWorks)
          : null;
      }
      if (updates.repositories !== undefined) {
        dbUpdates.repositories = updates.repositories ? JSON.stringify(updates.repositories) : null;
      }
      if (updates.funding !== undefined) {
        dbUpdates.funding = updates.funding ? JSON.stringify(updates.funding) : null;
      }
      if (updates.conferencePresentation !== undefined) {
        dbUpdates.conference_presentation = updates.conferencePresentation
          ? JSON.stringify(updates.conferencePresentation)
          : null;
      }
      if (updates.supplementaryMaterials !== undefined) {
        dbUpdates.supplementary_materials = updates.supplementaryMaterials
          ? JSON.stringify(updates.supplementaryMaterials)
          : null;
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
   * Parses JSONB columns for complex metadata.
   * Performs type conversions (string → Date, number → bigint).
   *
   * @internal
   */
  private rowToPreprint(row: PreprintRow): StoredPreprint {
    // Parse authors from JSONB
    const authors: readonly PreprintAuthor[] =
      typeof row.authors === 'string'
        ? (JSON.parse(row.authors) as PreprintAuthor[])
        : (row.authors as PreprintAuthor[]);

    // Parse optional JSONB fields
    const publishedVersion = row.published_version
      ? (JSON.parse(row.published_version) as PublishedVersion)
      : undefined;
    const externalIds = row.external_ids
      ? (JSON.parse(row.external_ids) as ExternalIds)
      : undefined;
    const relatedWorks = row.related_works
      ? (JSON.parse(row.related_works) as RelatedWork[])
      : undefined;
    const repositories = row.repositories
      ? (JSON.parse(row.repositories) as Repositories)
      : undefined;
    const funding = row.funding ? (JSON.parse(row.funding) as FundingSource[]) : undefined;
    const conferencePresentation = row.conference_presentation
      ? (JSON.parse(row.conference_presentation) as ConferencePresentation)
      : undefined;
    const supplementaryMaterials = row.supplementary_materials
      ? (JSON.parse(row.supplementary_materials) as SupplementaryMaterial[])
      : undefined;

    return {
      uri: row.uri as AtUri,
      cid: row.cid as CID,
      authors,
      submittedBy: row.submitted_by as DID,
      paperDid: row.paper_did ? (row.paper_did as DID) : undefined,
      title: row.title,
      abstract: row.abstract,
      documentBlobRef: {
        $type: 'blob',
        ref: row.document_blob_cid as CID,
        mimeType: row.document_blob_mime_type,
        size: row.document_blob_size,
      },
      documentFormat: row.document_format as DocumentFormat,
      keywords: row.keywords ?? undefined,
      license: row.license,
      publicationStatus: row.publication_status as PublicationStatus,
      publishedVersion,
      externalIds,
      relatedWorks,
      repositories,
      funding,
      conferencePresentation,
      supplementaryMaterials,
      pdsUrl: row.pds_url,
      indexedAt: new Date(row.indexed_at),
      createdAt: new Date(row.created_at),
    };
  }
}
