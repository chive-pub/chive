/**
 * Storage backend interface for Chive's PostgreSQL database.
 *
 * @remarks
 * This interface provides access to Chive's local index database. It stores
 * searchable metadata about eprints, but NOT the source data itself.
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
import type { AnnotationBody } from '../models/annotation.js';
import type { EprintAuthor } from '../models/author.js';
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
} from '../models/eprint.js';
import type { Result } from '../result.js';

/**
 * Semantic version for structured versioning.
 *
 * @remarks
 * Follows SemVer 2.0.0 specification. Use for software or documents
 * requiring structured versioning with backward compatibility semantics.
 *
 * @public
 */
export interface SemanticVersion {
  /** Major version (breaking changes) */
  readonly major: number;
  /** Minor version (backward-compatible features) */
  readonly minor: number;
  /** Patch version (backward-compatible fixes) */
  readonly patch: number;
  /** Pre-release identifier (e.g., "alpha", "beta.1") */
  readonly prerelease?: string;
}

/**
 * Stored eprint metadata in Chive's index.
 *
 * @remarks
 * This is an INDEX record, not the source of truth. The authoritative
 * eprint data lives in the user's PDS. This record enables fast searching
 * and browsing without hitting individual PDSes.
 *
 * @public
 */
export interface StoredEprint {
  /**
   * AT URI of the eprint record.
   */
  readonly uri: AtUri;

  /**
   * CID of the indexed eprint version.
   *
   * @remarks
   * Used to detect when PDS has a newer version (staleness check).
   */
  readonly cid: CID;

  /**
   * All authors with contributions, affiliations, and metadata.
   *
   * @remarks
   * Unified author list including primary and co-authors.
   * Order is determined by each author's `order` property.
   */
  readonly authors: readonly EprintAuthor[];

  /**
   * DID of the human user who submitted this eprint.
   *
   * @remarks
   * Always set to the human who performed the submission.
   * May or may not appear in the authors list.
   */
  readonly submittedBy: DID;

  /**
   * DID of the paper's own account (if paper has its own PDS).
   *
   * @remarks
   * Optional field for paper-centric account model.
   * When set, blobs and the record itself live in the paper's PDS.
   * When undefined, they live in the submitter's PDS.
   */
  readonly paperDid?: DID;

  /**
   * Eprint title.
   *
   * @remarks
   * Indexed for full-text search and faceted filtering.
   */
  readonly title: string;

  /**
   * Rich text abstract with embedded knowledge graph references.
   *
   * @remarks
   * Stored as AnnotationBody (RichTextBody format) with text items
   * and nodeRef items. Uses application/x-chive-gloss+json format.
   */
  readonly abstract: AnnotationBody;

  /**
   * Plain text abstract for full-text search indexing.
   *
   * @remarks
   * Auto-generated from the rich abstract by extracting text content.
   * Indexed for full-text search.
   */
  readonly abstractPlainText?: string;

  /**
   * Blob reference to primary document in user's PDS.
   *
   * @remarks
   * This is a BlobRef (CID pointer), not blob data. The actual document
   * remains in the user's PDS. Supports multiple formats (PDF, DOCX,
   * HTML, Markdown, LaTeX, Jupyter, etc.).
   */
  readonly documentBlobRef: BlobRef;

  /**
   * Detected or user-specified document format.
   *
   * @remarks
   * Auto-detected from MIME type and magic bytes. Defaults to 'pdf'.
   */
  readonly documentFormat: DocumentFormat;

  /**
   * Supplementary materials attached to this eprint.
   *
   * @remarks
   * Additional files (appendices, figures, data, code, notebooks).
   * Each item has metadata including category and display order.
   */
  readonly supplementaryMaterials?: readonly SupplementaryMaterial[];

  /**
   * AT URI of previous version (if this is an update).
   *
   * @remarks
   * Used to build version chains for eprints with multiple revisions.
   */
  readonly previousVersionUri?: AtUri;

  /**
   * Version identifier.
   *
   * @remarks
   * Can be a simple integer (1-indexed, increments with each revision)
   * or a semantic version object for more structured versioning.
   * Integer versioning is recommended for academic eprints.
   */
  readonly version: number | SemanticVersion;

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
   * User-provided keywords for the eprint. Indexed for full-text search.
   */
  readonly keywords?: readonly string[];

  /**
   * Research field references from the knowledge graph.
   *
   * @remarks
   * Links to field nodes in the knowledge graph for categorization.
   */
  readonly fields?: readonly {
    readonly uri: string;
    readonly label: string;
    readonly id?: string;
    readonly parentUri?: string;
  }[];

  /**
   * License (SPDX identifier).
   *
   * @example "CC-BY-4.0", "MIT", "Apache-2.0"
   */
  readonly license: string;

  /**
   * AT-URI to license node in the knowledge graph.
   *
   * @remarks
   * Points to a governance-controlled license node (subkind=license).
   * Optional; when present, provides canonical license reference.
   * The `license` field contains the SPDX identifier for fallback.
   */
  readonly licenseUri?: AtUri;

  /**
   * Current publication status.
   *
   * @remarks
   * Tracks progression from eprint through review to publication.
   * Defaults to 'eprint' for new submissions.
   */
  readonly publicationStatus: PublicationStatus;

  /**
   * Link to the published version (Version of Record).
   *
   * @remarks
   * Populated when eprint has been published in a journal.
   */
  readonly publishedVersion?: PublishedVersion;

  /**
   * External persistent identifiers.
   *
   * @remarks
   * Links to external systems (arXiv, PubMed, SSRN, OpenAlex, etc.)
   */
  readonly externalIds?: ExternalIds;

  /**
   * Related works.
   *
   * @remarks
   * Links to related eprints, datasets, software, and prior versions
   * using DataCite-compatible relation types.
   */
  readonly relatedWorks?: readonly RelatedWork[];

  /**
   * Linked repositories.
   *
   * @remarks
   * Code, data, protocols, and materials repositories.
   */
  readonly repositories?: Repositories;

  /**
   * Funding sources.
   *
   * @remarks
   * Links to CrossRef Funder Registry and ROR for standardized IDs.
   */
  readonly funding?: readonly FundingSource[];

  /**
   * Conference presentation.
   *
   * @remarks
   * Information about conference where this work was presented.
   */
  readonly conferencePresentation?: ConferencePresentation;

  /**
   * URL of the user's PDS where this eprint lives.
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
   * When the eprint was created (from record).
   */
  readonly createdAt: Date;
}

/**
 * Query options for retrieving eprints from index.
 *
 * @public
 */
export interface EprintQueryOptions {
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
   * Stores or updates an eprint index record.
   *
   * @param eprint - Eprint metadata to index
   * @returns Result indicating success or failure
   *
   * @remarks
   * Upserts the eprint (insert or update based on URI).
   * Updates indexedAt timestamp on every call.
   *
   * **ATProto Compliance**: Stores metadata only, not source data.
   *
   * @example
   * ```typescript
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
  storeEprint(eprint: StoredEprint): Promise<Result<void, Error>>;

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
   * const eprint = await storage.getEprint(
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
  getEprint(uri: AtUri): Promise<StoredEprint | null>;

  /**
   * Queries eprints by author.
   *
   * @param author - Author DID
   * @param options - Query options (limit, offset, sort)
   * @returns Array of eprints by this author
   *
   * @remarks
   * Returns eprints in order specified by options.sortBy.
   * For full-text search across all fields, use ISearchEngine instead.
   *
   * @example
   * ```typescript
   * const eprints = await storage.getEprintsByAuthor(
   *   toDID('did:plc:abc')!,
   *   { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
   * );
   *
   * eprints.forEach(p => console.log(p.title));
   * ```
   *
   * @public
   */
  getEprintsByAuthor(author: DID, options?: EprintQueryOptions): Promise<StoredEprint[]>;

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
   * @example
   * ```typescript
   * const count = await storage.countEprintsByAuthor(toDID('did:plc:abc')!);
   * console.log(`Author has ${count} eprints`);
   * ```
   *
   * @public
   */
  countEprintsByAuthor(author: DID): Promise<number>;

  /**
   * Lists all eprint URIs with pagination.
   *
   * @param options - Query options including limit
   * @returns Array of eprint URIs
   *
   * @remarks
   * Used for browsing all eprints without facet filtering.
   * Returns URIs only for efficiency; full metadata can be fetched separately.
   *
   * @example
   * ```typescript
   * const uris = await storage.listEprintUris({ limit: 100 });
   * ```
   *
   * @public
   */
  listEprintUris(options?: { limit?: number; cursor?: string }): Promise<readonly string[]>;

  /**
   * Finds an eprint by external identifiers.
   *
   * @param externalIds - External service identifiers to search
   * @returns First matching eprint or null
   *
   * @remarks
   * Searches the eprints index by DOI and external IDs stored in the
   * `external_ids` JSONB column. Returns the first match found.
   *
   * Search priority:
   * 1. DOI (most authoritative)
   * 2. arXiv ID
   * 3. Semantic Scholar ID
   * 4. OpenAlex ID
   * 5. DBLP ID
   * 6. OpenReview ID
   * 7. PubMed ID
   * 8. SSRN ID
   *
   * @example
   * ```typescript
   * const eprint = await storage.findByExternalIds({
   *   doi: '10.1234/example',
   *   arxivId: '2301.12345',
   * });
   *
   * if (eprint) {
   *   console.log('Found duplicate:', eprint.uri);
   * }
   * ```
   *
   * @public
   */
  findByExternalIds(externalIds: {
    doi?: string;
    arxivId?: string;
    semanticScholarId?: string;
    openAlexId?: string;
    dblpId?: string;
    openReviewId?: string;
    pmid?: string;
    ssrnId?: string;
  }): Promise<StoredEprint | null>;

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
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!,
   *   'https://pds.example.com',
   *   new Date()
   * );
   * ```
   *
   * @public
   */
  trackPDSSource(uri: AtUri, pdsUrl: string, lastSynced: Date): Promise<Result<void, Error>>;

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
   * const result = await storage.storeEprintWithPDSTracking(
   *   eprintData,
   *   'https://pds.example.com',
   *   new Date()
   * );
   * ```
   *
   * @public
   */
  storeEprintWithPDSTracking(
    eprint: StoredEprint,
    pdsUrl: string,
    lastSynced: Date
  ): Promise<Result<void, Error>>;

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
  isStale(uri: AtUri): Promise<boolean>;

  /**
   * Deletes an eprint from the index.
   *
   * @param uri - AT URI of the eprint to delete
   * @returns Result indicating success or failure
   *
   * @remarks
   * Removes the eprint from the local index. Does not delete from PDS.
   * ATProto compliance: Chive never writes to user PDSes.
   *
   * Called when firehose receives a deletion event for an eprint.
   *
   * @example
   * ```typescript
   * const result = await storage.deleteEprint(
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
  deleteEprint(uri: AtUri): Promise<Result<void, Error>>;

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
   * @example
   * ```typescript
   * const changelog = await storage.getChangelog(
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.changelog/xyz')!
   * );
   *
   * if (changelog) {
   *   console.log('Version:', changelog.version);
   * }
   * ```
   *
   * @public
   */
  getChangelog(uri: AtUri): Promise<StoredChangelog | null>;

  /**
   * Lists changelogs for a specific eprint with pagination.
   *
   * @param eprintUri - AT URI of the eprint
   * @param options - Query options (limit, offset)
   * @returns Paginated list of changelogs, newest first
   *
   * @remarks
   * Returns changelogs ordered by creation date descending.
   * Each changelog describes changes introduced in a specific version.
   *
   * @example
   * ```typescript
   * const result = await storage.listChangelogs(
   *   toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!,
   *   { limit: 10 }
   * );
   *
   * for (const changelog of result.changelogs) {
   *   console.log(`Version ${changelog.version.major}: ${changelog.summary}`);
   * }
   * ```
   *
   * @public
   */
  listChangelogs(eprintUri: AtUri, options?: ChangelogQueryOptions): Promise<ChangelogListResult>;

  /**
   * Stores or updates a changelog index record.
   *
   * @param changelog - Changelog metadata to index
   * @returns Result indicating success or failure
   *
   * @remarks
   * Upserts the changelog (insert or update based on URI).
   * Called when firehose receives a changelog creation or update event.
   *
   * **ATProto Compliance:** Stores metadata only, not source data.
   *
   * @example
   * ```typescript
   * const result = await storage.storeChangelog({
   *   uri: toAtUri('at://did:plc:abc/pub.chive.eprint.changelog/xyz')!,
   *   cid: toCID('bafyreib...')!,
   *   eprintUri: toAtUri('at://did:plc:abc/pub.chive.eprint.submission/xyz')!,
   *   version: { major: 1, minor: 2, patch: 0 },
   *   summary: 'Updated methodology section',
   *   sections: [],
   *   createdAt: '2024-01-15T10:30:00Z',
   * });
   *
   * if (!result.ok) {
   *   console.error('Failed to store:', result.error);
   * }
   * ```
   *
   * @public
   */
  storeChangelog(changelog: StoredChangelog): Promise<Result<void, Error>>;

  /**
   * Deletes a changelog from the index.
   *
   * @param uri - AT URI of the changelog to delete
   * @returns Result indicating success or failure
   *
   * @remarks
   * Called when firehose receives a deletion event for a changelog.
   *
   * @public
   */
  deleteChangelog(uri: AtUri): Promise<Result<void, Error>>;
}

/**
 * Changelog section with category and items.
 *
 * @public
 */
export interface ChangelogSectionData {
  readonly category: string;
  readonly items: readonly ChangelogItemData[];
}

/**
 * Individual change item in a changelog section.
 *
 * @public
 */
export interface ChangelogItemData {
  readonly description: string;
  readonly changeType?: string;
  readonly location?: string;
  readonly reviewReference?: string;
}

/**
 * Semantic version for changelogs.
 *
 * @public
 */
export interface SemanticVersionData {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: string;
}

/**
 * Stored changelog in Chive's index.
 *
 * @public
 */
export interface StoredChangelog {
  readonly uri: AtUri;
  readonly cid: CID;
  readonly eprintUri: AtUri;
  readonly version: SemanticVersionData;
  readonly previousVersion?: SemanticVersionData;
  readonly summary?: string;
  readonly sections: readonly ChangelogSectionData[];
  readonly reviewerResponse?: string;
  readonly createdAt: string;
}

/**
 * Query options for changelog listing.
 *
 * @public
 */
export interface ChangelogQueryOptions {
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Result of listing changelogs.
 *
 * @public
 */
export interface ChangelogListResult {
  readonly changelogs: readonly StoredChangelog[];
  readonly total: number;
}
