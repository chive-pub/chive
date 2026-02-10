/**
 * Repository for eprint record operations.
 *
 * @remarks
 * Provides domain-specific queries and operations for eprint records
 * in the PostgreSQL index. Implements the repository pattern for clean
 * separation of data access logic.
 *
 * **Repository Pattern Benefits:**
 * - Encapsulates all eprint-related database operations
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
 * const repo = new EprintsRepository(pool);
 *
 * // Store an eprint
 * const result = await repo.store({
 *   uri: toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!,
 *   cid: toCID('bafyreib...')!,
 *   author: toDID('did:plc:abc')!,
 *   title: 'Neural Networks in Biology',
 *   abstract: 'This paper explores...',
 *   documentBlobRef: { ... },
 *   documentFormat: 'pdf',
 *   publicationStatus: 'eprint',
 *   pdsUrl: 'https://pds.example.com',
 *   indexedAt: new Date(),
 *   createdAt: new Date()
 * });
 *
 * // Query by author
 * const eprints = await repo.findByAuthor(
 *   toDID('did:plc:abc')!,
 *   { limit: 10, sortBy: 'createdAt' }
 * );
 * ```
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { Pool, PoolClient } from 'pg';

import type { AtUri, CID, DID } from '../../types/atproto.js';
import type {
  EprintQueryOptions,
  SemanticVersion,
  StoredEprint,
} from '../../types/interfaces/storage.interface.js';
import type { AnnotationBody } from '../../types/models/annotation.js';
import type { EprintAuthor } from '../../types/models/author.js';
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
} from '../../types/models/eprint.js';
import { Err, Ok, type Result } from '../../types/result.js';

import { InsertBuilder, SelectBuilder, UpdateBuilder } from './query-builder.js';
import { withTransaction } from './transaction.js';

/**
 * Database row representation of eprint index record.
 *
 * @remarks
 * Maps StoredEprint interface to PostgreSQL table structure.
 * BlobRef is denormalized into separate columns (cid, mime_type, size).
 * Complex metadata stored as JSONB.
 *
 * @internal
 */
interface EprintRow extends Record<string, unknown> {
  readonly uri: string;
  readonly cid: string;
  readonly authors: string; // JSONB stored as string
  readonly submitted_by: string;
  readonly paper_did: string | null;
  readonly title: string;
  readonly abstract: unknown; // JSONB (AnnotationBody)
  readonly abstract_plain_text: string | null;
  readonly document_blob_cid: string;
  readonly document_blob_mime_type: string;
  readonly document_blob_size: number;
  readonly document_format: string;
  readonly version: string | number; // JSONB (SemanticVersion) or integer
  readonly keywords: string[] | null;
  readonly license: string;
  readonly license_uri: string | null;
  readonly publication_status: string;
  readonly published_version: string | null; // JSONB
  readonly external_ids: string | null; // JSONB
  readonly related_works: string | null; // JSONB
  readonly repositories: string | null; // JSONB
  readonly funding: string | null; // JSONB
  readonly conference_presentation: string | null; // JSONB
  readonly supplementary_materials: string | null; // JSONB
  readonly fields: string | null; // JSONB
  readonly needs_abstract_migration: boolean | null;
  readonly pds_url: string;
  readonly indexed_at: Date;
  readonly created_at: Date;
}

/**
 * Repository for eprint record operations.
 *
 * @remarks
 * Implements the repository pattern for eprint data access.
 * All database operations for eprints go through this repository.
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
export class EprintsRepository {
  private readonly pool: Pool;

  /**
   * Creates an eprints repository.
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
   * Stores or updates an eprint index record.
   *
   * @param eprint - Eprint metadata to index
   * @returns Result indicating success or failure
   *
   * @remarks
   * Upserts the eprint (insert or update based on URI).
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
   *   uri: toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!,
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
   *   publicationStatus: 'eprint',
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
  async store(eprint: StoredEprint): Promise<Result<void, Error>> {
    try {
      const query = new InsertBuilder<EprintRow>()
        .into('eprints_index')
        .values({
          uri: eprint.uri,
          cid: eprint.cid,
          authors: JSON.stringify(eprint.authors),
          submitted_by: eprint.submittedBy,
          paper_did: eprint.paperDid ?? null,
          title: eprint.title,
          abstract: JSON.stringify(eprint.abstract),
          abstract_plain_text: eprint.abstractPlainText ?? null,
          document_blob_cid: eprint.documentBlobRef.ref,
          document_blob_mime_type: eprint.documentBlobRef.mimeType,
          document_blob_size: eprint.documentBlobRef.size,
          document_format: eprint.documentFormat,
          version:
            typeof eprint.version === 'number' ? eprint.version : JSON.stringify(eprint.version),
          keywords: eprint.keywords ? [...eprint.keywords] : null,
          license: eprint.license,
          license_uri: eprint.licenseUri ?? null,
          publication_status: eprint.publicationStatus,
          published_version: eprint.publishedVersion
            ? JSON.stringify(eprint.publishedVersion)
            : null,
          external_ids: eprint.externalIds ? JSON.stringify(eprint.externalIds) : null,
          related_works: eprint.relatedWorks ? JSON.stringify(eprint.relatedWorks) : null,
          repositories: eprint.repositories ? JSON.stringify(eprint.repositories) : null,
          funding: eprint.funding ? JSON.stringify(eprint.funding) : null,
          conference_presentation: eprint.conferencePresentation
            ? JSON.stringify(eprint.conferencePresentation)
            : null,
          supplementary_materials: eprint.supplementaryMaterials
            ? JSON.stringify(eprint.supplementaryMaterials)
            : null,
          fields: eprint.fields ? JSON.stringify(eprint.fields) : null,
          needs_abstract_migration: eprint.needsAbstractMigration ?? null,
          pds_url: eprint.pdsUrl,
          indexed_at: eprint.indexedAt,
          created_at: eprint.createdAt,
        })
        .onConflict('uri', 'update')
        .build();

      await this.pool.query(query.sql, [...query.params]);
      return Ok(undefined);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to store eprint: ${String(error)}`)
      );
    }
  }

  /**
   * Stores an eprint and tracks PDS source in a single transaction.
   *
   * @param eprint - Eprint metadata to index
   * @param pdsUrl - URL of the user's PDS
   * @param lastSynced - Last successful sync timestamp
   * @returns Result indicating success or failure
   *
   * @remarks
   * Wraps both store and PDS tracking in a transaction for atomicity.
   * If either operation fails, both are rolled back.
   *
   * **ATProto Compliance:** Ensures consistent PDS source tracking.
   *
   * @example
   * ```typescript
   * const result = await repo.storeWithPDSTracking(
   *   eprintData,
   *   'https://pds.example.com',
   *   new Date()
   * );
   * ```
   *
   * @public
   */
  async storeWithPDSTracking(
    eprint: StoredEprint,
    pdsUrl: string,
    lastSynced: Date
  ): Promise<Result<void, Error>> {
    return withTransaction(this.pool, async (client: PoolClient) => {
      // Build insert query
      const query = new InsertBuilder<EprintRow>()
        .into('eprints_index')
        .values({
          uri: eprint.uri,
          cid: eprint.cid,
          authors: JSON.stringify(eprint.authors),
          submitted_by: eprint.submittedBy,
          paper_did: eprint.paperDid ?? null,
          title: eprint.title,
          abstract: JSON.stringify(eprint.abstract),
          abstract_plain_text: eprint.abstractPlainText ?? null,
          document_blob_cid: eprint.documentBlobRef.ref,
          document_blob_mime_type: eprint.documentBlobRef.mimeType,
          document_blob_size: eprint.documentBlobRef.size,
          document_format: eprint.documentFormat,
          version:
            typeof eprint.version === 'number' ? eprint.version : JSON.stringify(eprint.version),
          keywords: eprint.keywords ? [...eprint.keywords] : null,
          license: eprint.license,
          license_uri: eprint.licenseUri ?? null,
          publication_status: eprint.publicationStatus,
          published_version: eprint.publishedVersion
            ? JSON.stringify(eprint.publishedVersion)
            : null,
          external_ids: eprint.externalIds ? JSON.stringify(eprint.externalIds) : null,
          related_works: eprint.relatedWorks ? JSON.stringify(eprint.relatedWorks) : null,
          repositories: eprint.repositories ? JSON.stringify(eprint.repositories) : null,
          funding: eprint.funding ? JSON.stringify(eprint.funding) : null,
          conference_presentation: eprint.conferencePresentation
            ? JSON.stringify(eprint.conferencePresentation)
            : null,
          supplementary_materials: eprint.supplementaryMaterials
            ? JSON.stringify(eprint.supplementaryMaterials)
            : null,
          fields: eprint.fields ? JSON.stringify(eprint.fields) : null,
          needs_abstract_migration: eprint.needsAbstractMigration ?? null,
          pds_url: eprint.pdsUrl,
          indexed_at: eprint.indexedAt,
          created_at: eprint.createdAt,
        })
        .onConflict('uri', 'update')
        .build();

      // Execute eprint upsert
      await client.query(query.sql, [...query.params]);

      // Update PDS tracking in same transaction
      await client.query(`UPDATE eprints_index SET pds_url = $1, indexed_at = $2 WHERE uri = $3`, [
        pdsUrl,
        lastSynced,
        eprint.uri,
      ]);
    });
  }

  /**
   * Retrieves an eprint index record by URI.
   *
   * @param uri - AT URI of the eprint
   * @returns Eprint if indexed, null otherwise
   *
   * @remarks
   * Returns null if the eprint has not been indexed by Chive.
   * The eprint may still exist in the user's PDS.
   *
   * @example
   * ```typescript
   * const eprint = await repo.findByUri(
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!
   * );
   *
   * if (eprint) {
   *   console.log('Title:', eprint.title);
   * }
   * ```
   *
   * @public
   */
  async findByUri(uri: AtUri): Promise<StoredEprint | null> {
    try {
      const query = new SelectBuilder<EprintRow>()
        .select(
          'uri',
          'cid',
          'authors',
          'submitted_by',
          'paper_did',
          'title',
          'abstract',
          'abstract_plain_text',
          'document_blob_cid',
          'document_blob_mime_type',
          'document_blob_size',
          'document_format',
          'version',
          'keywords',
          'license',
          'license_uri',
          'publication_status',
          'published_version',
          'external_ids',
          'related_works',
          'repositories',
          'funding',
          'conference_presentation',
          'supplementary_materials',
          'fields',
          'needs_abstract_migration',
          'pds_url',
          'indexed_at',
          'created_at'
        )
        .from('eprints_index')
        .where({ uri })
        .build();

      const result = await this.pool.query<EprintRow>(query.sql, [...query.params]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return this.rowToEprint(row);
    } catch (error) {
      throw error instanceof Error ? error : new Error(`Failed to find eprint: ${String(error)}`);
    }
  }

  /**
   * Queries eprints by author.
   *
   * @param author - Author DID
   * @param options - Query options (limit, offset, sort)
   * @returns Array of eprints by this author
   *
   * @remarks
   * Returns eprints in order specified by options.sortBy.
   * Defaults to newest first (createdAt desc).
   *
   * Maximum limit is 100 eprints per query. Use offset for pagination.
   *
   * @example
   * ```typescript
   * const eprints = await repo.findByAuthor(
   *   toDID('did:plc:abc')!,
   *   { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
   * );
   *
   * eprints.forEach(p => console.log(p.title));
   * ```
   *
   * @public
   */
  async findByAuthor(author: DID, options: EprintQueryOptions = {}): Promise<StoredEprint[]> {
    try {
      const limit = Math.min(options.limit ?? 50, 100);
      const offset = options.offset ?? 0;
      const sortBy = options.sortBy ?? 'createdAt';
      const sortOrder = options.sortOrder ?? 'desc';

      // Map sortBy to column name
      const sortColumn =
        sortBy === 'createdAt' ? 'created_at' : sortBy === 'indexedAt' ? 'indexed_at' : 'title';

      // Convert to uppercase for SQL
      const sortDirection = sortOrder.toUpperCase() as 'ASC' | 'DESC';

      // Use JSONB containment query to find eprints where the author DID
      // appears anywhere in the authors array (not just submitted_by).
      // The @> operator checks if the authors array contains an object with the given DID.
      const query = `
        SELECT
          uri, cid, authors, submitted_by, paper_did, title, abstract,
          abstract_plain_text, document_blob_cid, document_blob_mime_type,
          document_blob_size, document_format, version, keywords, license, license_uri,
          publication_status, published_version, external_ids, related_works,
          repositories, funding, conference_presentation, supplementary_materials,
          fields, needs_abstract_migration, pds_url, indexed_at, created_at
        FROM eprints_index
        WHERE authors @> $1::jsonb
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query<EprintRow>(query, [
        JSON.stringify([{ did: author }]),
        limit,
        offset,
      ]);

      return result.rows.map((row) => this.rowToEprint(row));
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to find eprints by author: ${String(error)}`);
    }
  }

  /**
   * Counts total eprints by author.
   *
   * @param author - Author DID to count eprints for
   * @returns Total count of eprints by this author
   *
   * @remarks
   * Uses JSONB containment query to count eprints where the author DID
   * appears anywhere in the authors array.
   *
   * @example
   * ```typescript
   * const count = await repo.countByAuthor(toDID('did:plc:abc')!);
   * console.log(`Author has ${count} eprints`);
   * ```
   *
   * @public
   */
  async countByAuthor(author: DID): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*)::int AS count
        FROM eprints_index
        WHERE authors @> $1::jsonb
      `;

      const result = await this.pool.query<{ count: number }>(query, [
        JSON.stringify([{ did: author }]),
      ]);

      return result.rows[0]?.count ?? 0;
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to count eprints by author: ${String(error)}`);
    }
  }

  /**
   * Lists all eprint URIs with pagination.
   *
   * @param options - Query options including limit
   * @returns Array of eprint URIs ordered by creation date (newest first)
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
        .from('eprints_index')
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
        : new Error(`Failed to list eprint URIs: ${String(error)}`);
    }
  }

  /**
   * Updates eprint metadata.
   *
   * @param uri - Eprint URI
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
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!,
   *   {
   *     title: 'Updated Title',
   *     abstract: 'Updated abstract...'
   *   }
   * );
   * ```
   *
   * @public
   */
  async update(uri: AtUri, updates: Partial<StoredEprint>): Promise<Result<void, Error>> {
    try {
      // Convert StoredEprint fields to database column names
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

      const query = new UpdateBuilder<EprintRow>()
        .table('eprints_index')
        .set(dbUpdates as Partial<EprintRow>)
        .where({ uri })
        .build();

      const result = await this.pool.query(query.sql, [...query.params]);

      if (result.rowCount === 0) {
        return Err(new Error(`Eprint not found: ${uri}`));
      }

      return Ok(undefined);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to update eprint: ${String(error)}`)
      );
    }
  }

  /**
   * Deletes an eprint from the index.
   *
   * @param uri - Eprint URI
   * @returns Result indicating success or failure
   *
   * @remarks
   * Removes the eprint from the local index. Does not delete from PDS
   * (ATProto compliance - never write to user PDSes).
   *
   * @example
   * ```typescript
   * const result = await repo.delete(
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!
   * );
   * ```
   *
   * @public
   */
  async delete(uri: AtUri): Promise<Result<void, Error>> {
    try {
      const result = await this.pool.query('DELETE FROM eprints_index WHERE uri = $1', [uri]);

      if (result.rowCount === 0) {
        return Err(new Error(`Eprint not found: ${uri}`));
      }

      return Ok(undefined);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to delete eprint: ${String(error)}`)
      );
    }
  }

  /**
   * Counts total eprints in the index.
   *
   * @returns Total number of indexed eprints
   *
   * @example
   * ```typescript
   * const total = await repo.count();
   * console.log(`${total} eprints indexed`);
   * ```
   *
   * @public
   */
  async count(): Promise<number> {
    try {
      const result = await this.pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM eprints_index'
      );

      const row = result.rows[0];
      return row ? parseInt(row.count, 10) : 0;
    } catch (error) {
      throw error instanceof Error ? error : new Error(`Failed to count eprints: ${String(error)}`);
    }
  }

  /**
   * Converts database row to StoredEprint interface.
   *
   * @param row - Database row
   * @returns StoredEprint object
   *
   * @remarks
   * Reconstitutes BlobRef from denormalized columns.
   * Parses JSONB columns for complex metadata.
   * Performs type conversions (string → Date, number → bigint).
   *
   * @internal
   */
  private rowToEprint(row: EprintRow): StoredEprint {
    // Parse authors from JSONB
    const authors: readonly EprintAuthor[] =
      typeof row.authors === 'string'
        ? (JSON.parse(row.authors) as EprintAuthor[])
        : (row.authors as EprintAuthor[]);

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
    interface FieldRow {
      uri: string;
      label: string;
      id?: string;
      parentUri?: string;
    }
    const fields = row.fields
      ? typeof row.fields === 'string'
        ? (JSON.parse(row.fields) as FieldRow[])
        : (row.fields as FieldRow[])
      : undefined;

    // Parse abstract from JSONB - PostgreSQL returns objects directly
    // All abstracts are expected to be in rich text format
    let abstract: AnnotationBody;
    if (typeof row.abstract === 'string') {
      abstract = JSON.parse(row.abstract) as AnnotationBody;
    } else if (row.abstract && typeof row.abstract === 'object') {
      abstract = row.abstract as AnnotationBody;
    } else {
      // Fallback for null/undefined
      abstract = { type: 'RichText', items: [], format: 'application/x-chive-gloss+json' };
    }

    return {
      uri: row.uri as AtUri,
      cid: row.cid as CID,
      authors,
      submittedBy: row.submitted_by as DID,
      paperDid: row.paper_did ? (row.paper_did as DID) : undefined,
      title: row.title,
      abstract,
      abstractPlainText: row.abstract_plain_text ?? undefined,
      documentBlobRef: {
        $type: 'blob',
        ref: row.document_blob_cid as CID,
        mimeType: row.document_blob_mime_type,
        size: row.document_blob_size,
      },
      documentFormat: row.document_format as DocumentFormat,
      version: this.parseVersion(row.version),
      keywords: row.keywords ?? undefined,
      license: row.license,
      licenseUri: (row.license_uri as AtUri) ?? undefined,
      publicationStatus: row.publication_status as PublicationStatus,
      publishedVersion,
      externalIds,
      relatedWorks,
      repositories,
      funding,
      conferencePresentation,
      supplementaryMaterials,
      fields,
      needsAbstractMigration: row.needs_abstract_migration ?? undefined,
      pdsUrl: row.pds_url,
      indexedAt: new Date(row.indexed_at),
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Parses version from database format.
   *
   * @param version - Version from database (number or JSON string)
   * @returns Parsed version (number or SemanticVersion)
   *
   * @internal
   */
  private parseVersion(version: string | number | null | undefined): number | SemanticVersion {
    if (version === null || version === undefined) {
      return 1;
    }
    if (typeof version === 'number') {
      return version;
    }
    // Try to parse as SemanticVersion JSON
    try {
      const parsed = JSON.parse(version) as SemanticVersion;
      if (
        typeof parsed === 'object' &&
        typeof parsed.major === 'number' &&
        typeof parsed.minor === 'number' &&
        typeof parsed.patch === 'number'
      ) {
        return parsed;
      }
      // Invalid semantic version structure, treat as integer
      return parseInt(version, 10) || 1;
    } catch {
      // Not valid JSON, try to parse as integer
      return parseInt(version, 10) || 1;
    }
  }

  /**
   * Finds eprint URIs by field URI.
   *
   * @param fieldUris - Field URIs to filter by (OR semantics)
   * @param options - Query options including limit
   * @returns Array of eprint URIs that have any of the specified fields
   *
   * @remarks
   * Searches the `fields` JSONB column for eprints whose fields array
   * contains any object with a matching URI. Uses JSONB containment
   * queries for efficient filtering.
   *
   * @example
   * ```typescript
   * const uris = await repo.listUrisByFieldUri(
   *   ['at://did:plc:graph-pds/pub.chive.graph.node/4f5a6b7c-8d9e-0f1a-2b3c-4d5e6f7a8b9c'],
   *   { limit: 100 }
   * );
   * ```
   *
   * @public
   */
  async listUrisByFieldUri(
    fieldUris: readonly string[],
    options: { limit?: number } = {}
  ): Promise<readonly string[]> {
    if (fieldUris.length === 0) {
      return [];
    }

    const limit = Math.min(options.limit ?? 1000, 5000);

    // Build OR conditions for each field URI
    // Use JSONB @> containment operator for efficient querying
    const conditions = fieldUris.map((_, i) => `fields @> $${i + 1}::jsonb`);

    const query = `
      SELECT uri
      FROM eprints_index
      WHERE ${conditions.join(' OR ')}
      ORDER BY created_at DESC
      LIMIT $${fieldUris.length + 1}
    `;

    // Each param is a JSONB array with one object containing the URI
    const params = [...fieldUris.map((uri) => JSON.stringify([{ uri }])), limit];

    try {
      const result = await this.pool.query<{ uri: string }>(query, params);
      return result.rows.map((row) => row.uri);
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to list eprints by field URI: ${String(error)}`);
    }
  }

  /**
   * Finds an eprint by external identifiers.
   *
   * @param externalIds - External service identifiers to search
   * @returns First matching eprint or null
   *
   * @remarks
   * Searches in priority order: DOI, arXiv, Semantic Scholar, OpenAlex, DBLP,
   * OpenReview, PubMed, SSRN.
   *
   * **Index Requirements:**
   * This method queries JSONB paths on `external_ids` and `published_version` columns.
   * Performance depends on the following GIN indexes from migration 1732910000000:
   * - `idx_eprints_external_ids_gin` - GIN index on `external_ids` JSONB
   *
   * Note: The `->>` operator extracts text values; GIN indexes support this
   * efficiently when using expression indexes or when combined with `@>` containment.
   * For high-volume lookups, consider adding expression indexes on frequently
   * queried paths (e.g., `CREATE INDEX ON eprints_index ((external_ids->>'doi'))`).
   *
   * @example
   * ```typescript
   * const eprint = await repo.findByExternalIds({
   *   doi: '10.1234/example',
   *   arxivId: '2301.12345',
   * });
   * ```
   *
   * @public
   */
  async findByExternalIds(externalIds: {
    doi?: string;
    arxivId?: string;
    semanticScholarId?: string;
    openAlexId?: string;
    dblpId?: string;
    openReviewId?: string;
    pmid?: string;
    ssrnId?: string;
  }): Promise<StoredEprint | null> {
    // Build OR conditions for each provided external ID
    const conditions: string[] = [];
    const params: string[] = [];
    let paramIndex = 1;

    // DOI is stored both in external_ids and published_version
    if (externalIds.doi) {
      conditions.push(`external_ids->>'doi' = $${paramIndex}`);
      conditions.push(`published_version->>'doi' = $${paramIndex}`);
      params.push(externalIds.doi);
      paramIndex++;
    }

    if (externalIds.arxivId) {
      conditions.push(`external_ids->>'arxivId' = $${paramIndex}`);
      params.push(externalIds.arxivId);
      paramIndex++;
    }

    if (externalIds.semanticScholarId) {
      conditions.push(`external_ids->>'semanticScholarId' = $${paramIndex}`);
      params.push(externalIds.semanticScholarId);
      paramIndex++;
    }

    if (externalIds.openAlexId) {
      conditions.push(`external_ids->>'openAlexId' = $${paramIndex}`);
      params.push(externalIds.openAlexId);
      paramIndex++;
    }

    if (externalIds.dblpId) {
      conditions.push(`external_ids->>'dblpId' = $${paramIndex}`);
      params.push(externalIds.dblpId);
      paramIndex++;
    }

    if (externalIds.openReviewId) {
      conditions.push(`external_ids->>'openReviewId' = $${paramIndex}`);
      params.push(externalIds.openReviewId);
      paramIndex++;
    }

    if (externalIds.pmid) {
      conditions.push(`external_ids->>'pmid' = $${paramIndex}`);
      params.push(externalIds.pmid);
      paramIndex++;
    }

    if (externalIds.ssrnId) {
      conditions.push(`external_ids->>'ssrnId' = $${paramIndex}`);
      params.push(externalIds.ssrnId);
      paramIndex++;
    }

    if (conditions.length === 0) {
      return null;
    }

    const query = `
      SELECT
        uri, cid, authors, submitted_by, paper_did, title, abstract,
        document_blob_cid, document_blob_mime_type, document_blob_size,
        document_format, version, keywords, license, publication_status,
        previous_version_uri, version_notes, supplementary_materials,
        published_version, external_ids, related_works, repositories,
        funding, conference_presentation, fields, needs_abstract_migration,
        pds_url, indexed_at, created_at
      FROM eprints_index
      WHERE ${conditions.join(' OR ')}
      LIMIT 1
    `;

    try {
      const result = await this.pool.query<EprintRow>(query, params);
      const row = result.rows[0];
      return row ? this.rowToEprint(row) : null;
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(`Failed to find eprint by external IDs: ${String(error)}`);
    }
  }
}
