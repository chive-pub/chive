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
 * - Delegates to EprintsRepository for CRUD operations
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
 * // Store eprint
 * const result = await storage.storeEprint({
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

import type { AtUri, CID, DID } from '../../types/atproto.js';
import type {
  IStorageBackend,
  EprintQueryOptions,
  StoredEprint,
  StoredChangelog,
  ChangelogQueryOptions,
  ChangelogListResult,
  SemanticVersionData,
  ChangelogSectionData,
  IndexedUserTag,
  EprintCitationQueryOptions,
  CitationListResult,
  IndexedCitation,
  IndexCitationInput,
  RelatedWorkQueryOptions,
  RelatedWorkListResult,
  IndexedRelatedWork,
  IndexRelatedWorkInput,
} from '../../types/interfaces/storage.interface.js';
import { Err, Ok, type Result } from '../../types/result.js';

import { EprintsRepository } from './eprints-repository.js';
import { PDSTracker } from './pds-tracker.js';
import { StalenessDetector } from './staleness-detector.js';

/**
 * PostgreSQL storage adapter implementing IStorageBackend.
 *
 * @remarks
 * Thin orchestration layer that delegates to specialized repositories.
 * This design provides clean separation of concerns and makes testing easier.
 *
 * **Delegation Strategy:**
 * - EprintsRepository handles all eprint CRUD operations
 * - PDSTracker manages PDS source tracking
 * - StalenessDetector checks if records need re-indexing
 *
 * @public
 * @since 0.1.0
 */
export class PostgreSQLAdapter implements IStorageBackend {
  private readonly pool: Pool;
  private readonly eprintsRepo: EprintsRepository;
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
    this.pool = pool;
    this.eprintsRepo = new EprintsRepository(pool);
    this.pdsTracker = new PDSTracker(pool);
    this.stalenessDetector = new StalenessDetector(pool);
  }

  /**
   * Stores or updates an eprint index record.
   *
   * @param eprint - Eprint metadata to index
   * @returns Result indicating success or failure
   *
   * @remarks
   * Delegates to EprintsRepository for the actual storage operation.
   * Upserts the eprint (insert or update based on URI).
   *
   * **ATProto Compliance:** Stores metadata only, not source data.
   *
   * @example
   * ```typescript
   * const result = await adapter.storeEprint({
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
   *   pdsUrl: 'https://pds.example.com',
   *   indexedAt: new Date(),
   *   createdAt: new Date()
   * });
   * ```
   *
   * @public
   */
  async storeEprint(eprint: StoredEprint): Promise<Result<void, Error>> {
    return this.eprintsRepo.store(eprint);
  }

  /**
   * Retrieves an eprint index record by URI.
   *
   * @param uri - AT URI of the eprint
   * @returns Eprint if indexed, null otherwise
   *
   * @remarks
   * Delegates to EprintsRepository for the query.
   * Returns null if the eprint has not been indexed by Chive.
   * The eprint may still exist in the user's PDS.
   *
   * @example
   * ```typescript
   * const eprint = await adapter.getEprint(
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
  async getEprint(uri: AtUri): Promise<StoredEprint | null> {
    return this.eprintsRepo.findByUri(uri);
  }

  /**
   * Queries eprints by author.
   *
   * @param author - Author DID
   * @param options - Query options (limit, offset, sort)
   * @returns Array of eprints by this author
   *
   * @remarks
   * Delegates to EprintsRepository for the query.
   * Returns eprints in order specified by options.sortBy.
   * Defaults to newest first (createdAt desc).
   *
   * @example
   * ```typescript
   * const eprints = await adapter.getEprintsByAuthor(
   *   toDID('did:plc:abc')!,
   *   { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
   * );
   *
   * eprints.forEach(p => console.log(p.title));
   * ```
   *
   * @public
   */
  async getEprintsByAuthor(author: DID, options: EprintQueryOptions = {}): Promise<StoredEprint[]> {
    return this.eprintsRepo.findByAuthor(author, options);
  }

  /**
   * Counts total eprints by author.
   *
   * @param author - Author DID
   * @returns Total count of eprints by this author
   *
   * @remarks
   * Returns the total count without fetching full eprint data.
   * Used for displaying metrics in author profiles.
   *
   * @public
   */
  async countEprintsByAuthor(author: DID): Promise<number> {
    return this.eprintsRepo.countByAuthor(author);
  }

  /**
   * Lists all eprint URIs with pagination.
   *
   * @param options - Query options including limit
   * @returns Array of eprint URIs
   *
   * @remarks
   * Used for browsing all eprints without facet filtering.
   *
   * @public
   */
  async listEprintUris(
    options: { limit?: number; cursor?: string } = {}
  ): Promise<readonly string[]> {
    return this.eprintsRepo.listUris(options);
  }

  /**
   * Lists eprint URIs filtered by field URIs.
   *
   * @param fieldUris - Field URIs to filter by (OR semantics)
   * @param options - Query options including limit
   * @returns Array of eprint URIs that have any of the specified fields
   *
   * @remarks
   * Delegates to EprintsRepository for the JSONB field query.
   * Used for discipline/field-based filtering in browse pages.
   *
   * @public
   */
  async listEprintUrisByFieldUri(
    fieldUris: readonly string[],
    options: { limit?: number } = {}
  ): Promise<readonly string[]> {
    return this.eprintsRepo.listUrisByFieldUri(fieldUris, options);
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
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!,
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
   * Stores an eprint and tracks PDS source in a single transaction.
   *
   * @param eprint - Eprint metadata to index
   * @param pdsUrl - URL of the user's PDS
   * @param lastSynced - Last successful sync timestamp
   * @returns Result indicating success or failure
   *
   * @remarks
   * Delegates to EprintsRepository for the transactional operation.
   * Both store and PDS tracking happen atomically.
   *
   * **ATProto Compliance:** Ensures consistent PDS source tracking.
   *
   * @example
   * ```typescript
   * const result = await adapter.storeEprintWithPDSTracking(
   *   eprintData,
   *   'https://pds.example.com',
   *   new Date()
   * );
   * ```
   *
   * @public
   */
  async storeEprintWithPDSTracking(
    eprint: StoredEprint,
    pdsUrl: string,
    lastSynced: Date
  ): Promise<Result<void, Error>> {
    return this.eprintsRepo.storeWithPDSTracking(eprint, pdsUrl, lastSynced);
  }

  /**
   * Finds an eprint by external identifiers.
   *
   * @param externalIds - External service identifiers to search
   * @returns First matching eprint or null
   *
   * @remarks
   * Delegates to EprintsRepository for the query.
   * Searches by DOI, arXiv ID, Semantic Scholar ID, etc.
   *
   * @example
   * ```typescript
   * const eprint = await adapter.findByExternalIds({
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
    return this.eprintsRepo.findByExternalIds(externalIds);
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
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!
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

  /**
   * Deletes an eprint from the index.
   *
   * @param uri - AT URI of the eprint to delete
   * @returns Result indicating success or failure
   *
   * @remarks
   * Delegates to EprintsRepository for the deletion.
   * Removes the eprint from the local index only.
   *
   * **ATProto Compliance:** Never writes to user PDSes.
   *
   * @example
   * ```typescript
   * const result = await adapter.deleteEprint(
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!
   * );
   *
   * if (!result.ok) {
   *   console.error('Failed to delete:', result.error);
   * }
   * ```
   *
   * @public
   */
  async deleteEprint(uri: AtUri): Promise<Result<void, Error>> {
    return this.eprintsRepo.delete(uri);
  }

  /**
   * Retrieves a single changelog entry by URI.
   *
   * @param uri - AT URI of the changelog record
   * @returns Changelog view or null if not found
   *
   * @remarks
   * Changelogs are indexed from the firehose and describe changes
   * between eprint versions.
   *
   * @public
   */
  async getChangelog(uri: AtUri): Promise<StoredChangelog | null> {
    const result = await this.pool.query<ChangelogRow>(
      `SELECT uri, cid, eprint_uri, version, previous_version, summary,
              sections, reviewer_response, created_at
       FROM changelogs_index
       WHERE uri = $1`,
      [uri]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.mapChangelogRow(row);
  }

  /**
   * Lists changelogs for a specific eprint with pagination.
   *
   * @param eprintUri - AT URI of the eprint
   * @param options - Query options (limit, offset)
   * @returns Paginated list of changelogs, newest first
   *
   * @remarks
   * Returns changelogs ordered by creation date descending.
   *
   * @public
   */
  async listChangelogs(
    eprintUri: AtUri,
    options?: ChangelogQueryOptions
  ): Promise<ChangelogListResult> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    // Get total count
    const countResult = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM changelogs_index WHERE eprint_uri = $1',
      [eprintUri]
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    // Get paginated changelogs, newest first
    const result = await this.pool.query<ChangelogRow>(
      `SELECT uri, cid, eprint_uri, version, previous_version, summary,
              sections, reviewer_response, created_at
       FROM changelogs_index
       WHERE eprint_uri = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [eprintUri, limit, offset]
    );

    const changelogs = result.rows.map((row) => this.mapChangelogRow(row));

    return {
      changelogs,
      total,
    };
  }

  /**
   * Stores or updates a changelog index record.
   *
   * @param changelog - Changelog metadata to index
   * @returns Result indicating success or failure
   *
   * @remarks
   * Upserts the changelog (insert or update based on URI).
   *
   * @public
   */
  async storeChangelog(changelog: StoredChangelog): Promise<Result<void, Error>> {
    try {
      await this.pool.query(
        `INSERT INTO changelogs_index (
          uri, cid, eprint_uri, version, previous_version, summary,
          sections, reviewer_response, created_at, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          version = EXCLUDED.version,
          previous_version = EXCLUDED.previous_version,
          summary = EXCLUDED.summary,
          sections = EXCLUDED.sections,
          reviewer_response = EXCLUDED.reviewer_response,
          last_synced_at = NOW()`,
        [
          changelog.uri,
          changelog.cid,
          changelog.eprintUri,
          JSON.stringify(changelog.version),
          changelog.previousVersion ? JSON.stringify(changelog.previousVersion) : null,
          changelog.summary ?? null,
          JSON.stringify(changelog.sections),
          changelog.reviewerResponse ?? null,
          new Date(changelog.createdAt),
        ]
      );
      return Ok(undefined);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Deletes a changelog from the index.
   *
   * @param uri - AT URI of the changelog to delete
   * @returns Result indicating success or failure
   *
   * @public
   */
  async deleteChangelog(uri: AtUri): Promise<Result<void, Error>> {
    try {
      await this.pool.query('DELETE FROM changelogs_index WHERE uri = $1', [uri]);
      return Ok(undefined);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Retrieves user tags for an eprint.
   *
   * @param eprintUri - AT URI of the eprint
   * @returns Array of indexed user tags
   *
   * @remarks
   * Returns individual user tag records indexed from the firehose.
   * Ordered by creation time descending (newest first).
   *
   * @public
   */
  async getTagsForEprint(eprintUri: AtUri): Promise<readonly IndexedUserTag[]> {
    const result = await this.pool.query<UserTagRow>(
      `SELECT uri, cid, eprint_uri, tagger_did, tag, created_at, pds_url, indexed_at
       FROM user_tags_index
       WHERE eprint_uri = $1
       ORDER BY created_at DESC`,
      [eprintUri]
    );

    return result.rows.map((row) => ({
      uri: row.uri as AtUri,
      cid: row.cid as CID,
      eprintUri: row.eprint_uri as AtUri,
      taggerDid: row.tagger_did as DID,
      tag: row.tag,
      createdAt: row.created_at,
      pdsUrl: row.pds_url,
      indexedAt: row.indexed_at,
    }));
  }

  /**
   * SQL expression that normalizes a raw tag/keyword column to the canonical
   * hyphen-separated form (matching src/utils/normalize-tag.ts).
   */
  private static normalizeExpr(col: string): string {
    // lowercase -> strip special chars -> spaces to hyphens -> collapse hyphens -> trim hyphens
    return `TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(${col}), '[^a-z0-9\\s-]', '', 'g'), '\\s+', '-', 'g'), '-+', '-', 'g'))`;
  }

  /**
   * Retrieves distinct eprint URIs that match a normalized term as either
   * a community tag or an author keyword.
   */
  async getEprintUrisForTerm(
    normalizedTerm: string,
    limit: number,
    offset: number
  ): Promise<{ uris: AtUri[]; total: number }> {
    const normTag = PostgreSQLAdapter.normalizeExpr('tag');
    const normKw = PostgreSQLAdapter.normalizeExpr('k');

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM (
         SELECT DISTINCT eprint_uri AS uri FROM user_tags_index WHERE ${normTag} = $1
         UNION
         SELECT DISTINCT uri FROM eprints_index, LATERAL unnest(keywords) AS k WHERE ${normKw} = $1
       ) combined`,
      [normalizedTerm]
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    if (limit === 0) {
      return { uris: [], total };
    }

    const result = await this.pool.query<{ uri: string }>(
      `SELECT uri FROM (
         SELECT DISTINCT eprint_uri AS uri FROM user_tags_index WHERE ${normTag} = $1
         UNION
         SELECT DISTINCT uri FROM eprints_index, LATERAL unnest(keywords) AS k WHERE ${normKw} = $1
       ) combined
       ORDER BY uri
       LIMIT $2 OFFSET $3`,
      [normalizedTerm, limit, offset]
    );

    return {
      uris: result.rows.map((r) => r.uri as AtUri),
      total,
    };
  }

  /**
   * Searches distinct keywords from eprints_index matching a search term.
   */
  async searchKeywords(
    searchText: string,
    limit: number
  ): Promise<{ normalizedForm: string; displayForm: string; usageCount: number }[]> {
    const normKw = PostgreSQLAdapter.normalizeExpr('k');

    const result = await this.pool.query<{
      normalized: string;
      display: string;
      count: string;
    }>(
      `SELECT ${normKw} AS normalized, k AS display, COUNT(DISTINCT uri)::text AS count
       FROM eprints_index, LATERAL unnest(keywords) AS k
       WHERE ${normKw} LIKE '%' || $1 || '%'
       GROUP BY normalized, k
       ORDER BY count DESC
       LIMIT $2`,
      [searchText.toLowerCase(), limit]
    );

    return result.rows.map((r) => ({
      normalizedForm: r.normalized,
      displayForm: r.display,
      usageCount: parseInt(r.count, 10),
    }));
  }

  /**
   * Deletes a record from an index table by AT-URI.
   */
  async deleteByUri(table: string, uri: AtUri): Promise<void> {
    // Allowlist of valid table names to prevent SQL injection
    const validTables = [
      'user_tags_index',
      'reviews_index',
      'endorsements_index',
      'citations_index',
      'related_works_index',
    ];
    if (!validTables.includes(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }
    await this.pool.query(`DELETE FROM ${table} WHERE uri = $1`, [uri]);
  }

  /**
   * Indexes a user tag record into the user_tags_index table.
   */
  async indexTag(tag: {
    readonly uri: AtUri;
    readonly cid: CID;
    readonly eprintUri: AtUri;
    readonly taggerDid: DID;
    readonly tag: string;
    readonly createdAt: Date;
    readonly pdsUrl: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_tags_index (
        uri, cid, eprint_uri, tagger_did, tag, created_at, pds_url, indexed_at, last_synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (uri) DO UPDATE SET
        cid = EXCLUDED.cid,
        tag = EXCLUDED.tag,
        last_synced_at = NOW()`,
      [tag.uri, tag.cid, tag.eprintUri, tag.taggerDid, tag.tag, tag.createdAt, tag.pdsUrl]
    );
  }

  // ===========================================================================
  // CITATION METHODS
  // ===========================================================================

  /**
   * Retrieves citations for an eprint with optional source filtering.
   *
   * @param eprintUri - AT URI of the eprint
   * @param options - Query options (limit, offset, source)
   * @returns Paginated list of citations
   *
   * @public
   */
  async getCitationsForEprint(
    eprintUri: AtUri,
    options?: EprintCitationQueryOptions
  ): Promise<CitationListResult> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const source = options?.source ?? 'all';

    let whereClause = 'WHERE eprint_uri = $1';
    const params: unknown[] = [eprintUri];

    if (source === 'user') {
      whereClause += " AND source = 'user-provided'";
    } else if (source === 'auto') {
      whereClause += " AND source != 'user-provided'";
    }

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM extracted_citations ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const result = await this.pool.query<CitationRow>(
      `SELECT id, eprint_uri, raw_text, title, doi, arxiv_id, authors, year, venue,
              source, confidence, chive_match_uri, match_confidence, is_influential,
              citation_type, context, user_record_uri, curator_did, extracted_at, updated_at
       FROM extracted_citations
       ${whereClause}
       ORDER BY extracted_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const citations: IndexedCitation[] = result.rows.map((row) => this.mapCitationRow(row));

    return { citations, total };
  }

  /**
   * Indexes a user-provided citation from the firehose.
   *
   * @param citation - Citation data to index
   *
   * @public
   */
  async indexCitation(citation: IndexCitationInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO extracted_citations (
        eprint_uri, title, doi, arxiv_id, authors, year, venue, source,
        confidence, chive_match_uri, citation_type, context,
        user_record_uri, curator_did, extracted_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'user-provided', 1.0, $8, $9, $10, $11, $12, $13, $13)
      ON CONFLICT (user_record_uri) WHERE user_record_uri IS NOT NULL DO UPDATE SET
        title = EXCLUDED.title,
        doi = EXCLUDED.doi,
        arxiv_id = EXCLUDED.arxiv_id,
        authors = EXCLUDED.authors,
        year = EXCLUDED.year,
        venue = EXCLUDED.venue,
        chive_match_uri = EXCLUDED.chive_match_uri,
        citation_type = EXCLUDED.citation_type,
        context = EXCLUDED.context,
        updated_at = NOW()`,
      [
        citation.eprintUri,
        citation.title,
        citation.doi ?? null,
        citation.arxivId ?? null,
        citation.authors ? JSON.stringify(citation.authors) : null,
        citation.year ?? null,
        citation.venue ?? null,
        citation.chiveUri ?? null,
        citation.citationType ?? null,
        citation.context ?? null,
        citation.userRecordUri,
        citation.curatorDid,
        citation.createdAt,
      ]
    );
  }

  /**
   * Deletes a user-provided citation by its record URI.
   *
   * @param userRecordUri - AT URI of the citation record
   *
   * @public
   */
  async deleteCitation(userRecordUri: AtUri): Promise<void> {
    await this.pool.query('DELETE FROM extracted_citations WHERE user_record_uri = $1', [
      userRecordUri,
    ]);
  }

  // ===========================================================================
  // RELATED WORK METHODS
  // ===========================================================================

  /**
   * Retrieves related works for an eprint with pagination.
   *
   * @param eprintUri - AT URI of the eprint
   * @param options - Query options (limit, offset)
   * @returns Paginated list of related works
   *
   * @public
   */
  async getRelatedWorksForEprint(
    eprintUri: AtUri,
    options?: RelatedWorkQueryOptions
  ): Promise<RelatedWorkListResult> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const countResult = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM user_related_works_index WHERE source_eprint_uri = $1',
      [eprintUri]
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const result = await this.pool.query<RelatedWorkRow>(
      `SELECT uri, cid, source_eprint_uri, target_eprint_uri, relationship_type,
              description, curator_did, created_at, pds_url, indexed_at, last_synced_at
       FROM user_related_works_index
       WHERE source_eprint_uri = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [eprintUri, limit, offset]
    );

    const relatedWorks: IndexedRelatedWork[] = result.rows.map((row) =>
      this.mapRelatedWorkRow(row)
    );

    return { relatedWorks, total };
  }

  /**
   * Indexes a related work record from the firehose.
   *
   * @param relatedWork - Related work data to index
   *
   * @public
   */
  async indexRelatedWork(relatedWork: IndexRelatedWorkInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_related_works_index (
        uri, cid, source_eprint_uri, target_eprint_uri, relationship_type,
        description, curator_did, created_at, pds_url, indexed_at, last_synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (uri) DO UPDATE SET
        cid = EXCLUDED.cid,
        source_eprint_uri = EXCLUDED.source_eprint_uri,
        target_eprint_uri = EXCLUDED.target_eprint_uri,
        relationship_type = EXCLUDED.relationship_type,
        description = EXCLUDED.description,
        last_synced_at = NOW()`,
      [
        relatedWork.uri,
        relatedWork.cid,
        relatedWork.sourceEprintUri,
        relatedWork.targetEprintUri,
        relatedWork.relationshipType,
        relatedWork.description ?? null,
        relatedWork.curatorDid,
        relatedWork.createdAt,
        relatedWork.pdsUrl,
      ]
    );
  }

  /**
   * Deletes a related work record by its URI.
   *
   * @param uri - AT URI of the related work record
   *
   * @public
   */
  async deleteRelatedWork(uri: AtUri): Promise<void> {
    await this.pool.query('DELETE FROM user_related_works_index WHERE uri = $1', [uri]);
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Maps a citation database row to IndexedCitation.
   *
   * @param row - Database row
   * @returns Mapped citation object
   *
   * @internal
   */
  private mapCitationRow(row: CitationRow): IndexedCitation {
    const rawAuthors = row.authors;
    let parsedAuthors: readonly string[] | undefined;
    if (rawAuthors != null) {
      parsedAuthors =
        typeof rawAuthors === 'string'
          ? (JSON.parse(rawAuthors) as string[])
          : (rawAuthors as string[]);
    }

    return {
      id: row.id,
      eprintUri: row.eprint_uri as AtUri,
      rawText: row.raw_text ?? undefined,
      title: row.title ?? undefined,
      doi: row.doi ?? undefined,
      arxivId: row.arxiv_id ?? undefined,
      authors: parsedAuthors,
      year: row.year ?? undefined,
      venue: row.venue ?? undefined,
      source: row.source,
      confidence: row.confidence,
      chiveMatchUri: row.chive_match_uri ? (row.chive_match_uri as AtUri) : undefined,
      matchConfidence: row.match_confidence ?? undefined,
      isInfluential: row.is_influential ?? undefined,
      citationType: row.citation_type ?? undefined,
      context: row.context ?? undefined,
      userRecordUri: row.user_record_uri ? (row.user_record_uri as AtUri) : undefined,
      curatorDid: row.curator_did ? (row.curator_did as DID) : undefined,
      extractedAt: row.extracted_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Maps a related work database row to IndexedRelatedWork.
   *
   * @param row - Database row
   * @returns Mapped related work object
   *
   * @internal
   */
  private mapRelatedWorkRow(row: RelatedWorkRow): IndexedRelatedWork {
    return {
      uri: row.uri as AtUri,
      cid: row.cid as CID,
      sourceEprintUri: row.source_eprint_uri as AtUri,
      targetEprintUri: row.target_eprint_uri as AtUri,
      relationshipType: row.relationship_type,
      description: row.description ?? undefined,
      curatorDid: row.curator_did as DID,
      createdAt: row.created_at,
      pdsUrl: row.pds_url ?? undefined,
      indexedAt: row.indexed_at,
      lastSyncedAt: row.last_synced_at,
    };
  }

  /**
   * Maps a changelog database row to StoredChangelog.
   *
   * @param row - Database row
   * @returns Mapped changelog object
   *
   * @internal
   */
  private mapChangelogRow(row: ChangelogRow): StoredChangelog {
    return {
      uri: row.uri as AtUri,
      cid: row.cid as CID,
      eprintUri: row.eprint_uri as AtUri,
      version: row.version as SemanticVersionData,
      previousVersion: row.previous_version as SemanticVersionData | undefined,
      summary: row.summary ?? undefined,
      sections: (row.sections as ChangelogSectionData[]) ?? [],
      reviewerResponse: row.reviewer_response ?? undefined,
      createdAt: row.created_at.toISOString(),
    };
  }
}

/**
 * Database row representation of changelog index record.
 *
 * @internal
 */
interface ChangelogRow {
  readonly uri: string;
  readonly cid: string;
  readonly eprint_uri: string;
  readonly version: unknown; // JSONB
  readonly previous_version: unknown; // JSONB, can be null
  readonly summary: string | null;
  readonly sections: unknown; // JSONB array
  readonly reviewer_response: string | null;
  readonly created_at: Date;
}

/**
 * Database row representation of user tag index record.
 *
 * @internal
 */
interface UserTagRow {
  readonly uri: string;
  readonly cid: string;
  readonly eprint_uri: string;
  readonly tagger_did: string;
  readonly tag: string;
  readonly created_at: Date;
  readonly pds_url: string;
  readonly indexed_at: Date;
}

/**
 * Database row representation of extracted citation record.
 *
 * @internal
 */
interface CitationRow {
  readonly id: number;
  readonly eprint_uri: string;
  readonly raw_text: string | null;
  readonly title: string | null;
  readonly doi: string | null;
  readonly arxiv_id: string | null;
  readonly authors: unknown; // JSONB
  readonly year: number | null;
  readonly venue: string | null;
  readonly source: string;
  readonly confidence: number;
  readonly chive_match_uri: string | null;
  readonly match_confidence: number | null;
  readonly is_influential: boolean | null;
  readonly citation_type: string | null;
  readonly context: string | null;
  readonly user_record_uri: string | null;
  readonly curator_did: string | null;
  readonly extracted_at: Date;
  readonly updated_at: Date;
}

/**
 * Database row representation of user related work record.
 *
 * @internal
 */
interface RelatedWorkRow {
  readonly uri: string;
  readonly cid: string;
  readonly source_eprint_uri: string;
  readonly target_eprint_uri: string;
  readonly relationship_type: string;
  readonly description: string | null;
  readonly curator_did: string;
  readonly created_at: Date;
  readonly pds_url: string | null;
  readonly indexed_at: Date;
  readonly last_synced_at: Date;
}
