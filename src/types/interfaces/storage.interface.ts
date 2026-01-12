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
   * Eprint abstract.
   *
   * @remarks
   * Indexed for full-text search.
   */
  readonly abstract: string;

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
    readonly name: string;
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
   * Stores or updates a eprint index record.
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
   * Retrieves a eprint index record by URI.
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
}
