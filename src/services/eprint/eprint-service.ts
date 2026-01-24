/**
 * Eprint service orchestrating indexing and query operations.
 *
 * @remarks
 * Application-layer service that coordinates eprint operations across
 * storage, search, and repository infrastructure adapters.
 *
 * **Service Responsibilities:**
 * - Index eprints from firehose events (read-only from PDSes)
 * - Store metadata in PostgreSQL for structured queries
 * - Index full-text in Elasticsearch for search
 * - Track PDS sources for staleness detection
 * - Provide query operations for API layer
 *
 * **ATProto Compliance:**
 * - Read-only from PDSes via IRepository
 * - Stores BlobRefs only (never blob data)
 * - Tracks PDS source for each record
 * - All indexes rebuildable from firehose
 * - Never writes to user PDSes
 *
 * @example
 * ```typescript
 * const service = new EprintService({
 *   storage,
 *   search,
 *   repository,
 *   identity,
 *   logger
 * });
 *
 * // Index from firehose event
 * const result = await service.indexEprint(record, metadata);
 * if (!result.ok) {
 *   logger.error('Indexing failed:', result.error);
 * }
 *
 * // Query indexed eprint
 * const eprint = await service.getEprint(uri);
 * ```
 *
 * @packageDocumentation
 * @public
 */

import type { TagManager } from '../../storage/neo4j/tag-manager.js';
import type { AtUri, CID, DID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError } from '../../types/errors.js';
import type { IGraphDatabase } from '../../types/interfaces/graph.interface.js';
import type { IIdentityResolver } from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IRepository } from '../../types/interfaces/repository.interface.js';
import type { ISearchEngine } from '../../types/interfaces/search.interface.js';
import type {
  IStorageBackend,
  EprintQueryOptions,
  StoredEprint,
} from '../../types/interfaces/storage.interface.js';
import type { Eprint, EprintVersion } from '../../types/models/eprint.ts';
import type { Result } from '../../types/result.js';
import { extractPlainText } from '../../utils/rich-text.js';

import { VersionManager } from './version-manager.js';

/**
 * Metadata accompanying a firehose record.
 *
 * @public
 */
export interface RecordMetadata {
  readonly uri: AtUri;
  readonly cid: CID;
  readonly pdsUrl: string;
  readonly indexedAt: Date;
}

/**
 * Eprint service configuration.
 *
 * @public
 */
export interface EprintServiceOptions {
  readonly storage: IStorageBackend;
  readonly search: ISearchEngine;
  readonly repository: IRepository;
  readonly identity: IIdentityResolver;
  readonly logger: ILogger;
  /**
   * Optional TagManager for auto-generating tags from keywords.
   * If provided, keywords from eprints will be indexed as user tags.
   */
  readonly tagManager?: TagManager;
  /**
   * Optional graph database for resolving field labels.
   * If provided, field URIs will be resolved to human-readable labels.
   */
  readonly graph?: IGraphDatabase;
}

/**
 * Eprint view with enriched metadata.
 *
 * @public
 */
export interface EprintView extends StoredEprint {
  readonly versions: readonly EprintVersion[];
  readonly metrics?: {
    readonly views: number;
    readonly downloads: number;
    readonly endorsements: number;
  };
}

/**
 * Paginated eprint list.
 *
 * @public
 */
export interface EprintList {
  readonly eprints: readonly EprintView[];
  readonly total: number;
  readonly cursor?: string;
}

/**
 * Staleness check result.
 *
 * @public
 */
export interface StalenessStatus {
  readonly isStale: boolean;
  readonly indexedCid: CID;
  readonly currentCid?: CID;
  readonly lastSyncedAt: Date;
}

/**
 * Eprint service implementation.
 *
 * @public
 */
export class EprintService {
  private readonly storage: IStorageBackend;
  private readonly search: ISearchEngine;
  private readonly repository: IRepository;
  private readonly identity: IIdentityResolver;
  private readonly logger: ILogger;
  private readonly versionManager: VersionManager;
  private readonly tagManager: TagManager | null;
  private readonly graph: IGraphDatabase | null;

  constructor(options: EprintServiceOptions) {
    this.storage = options.storage;
    this.search = options.search;
    this.repository = options.repository;
    this.identity = options.identity;
    this.logger = options.logger;
    this.versionManager = new VersionManager({ storage: options.storage });
    this.tagManager = options.tagManager ?? null;
    this.graph = options.graph ?? null;
  }

  async indexEprint(
    record: Eprint,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      const abstractPlainText = extractPlainText(record.abstract);

      // Resolve field labels from knowledge graph if available
      let resolvedFields = record.fields;
      if (this.graph && record.fields && record.fields.length > 0) {
        resolvedFields = await this.resolveFieldLabels(record.fields);
      }

      const storeResult = await this.storage.storeEprint({
        uri: metadata.uri,
        cid: metadata.cid,
        authors: record.authors,
        submittedBy: record.submittedBy,
        paperDid: record.paperDid,
        title: record.title,
        abstract: record.abstract,
        abstractPlainText,
        documentBlobRef: record.documentBlobRef,
        documentFormat: record.documentFormat,
        supplementaryMaterials: record.supplementaryMaterials,
        previousVersionUri: record.previousVersionUri,
        version: record.version,
        versionNotes: record.versionNotes,
        keywords: record.keywords,
        fields: resolvedFields,
        license: record.license,
        publicationStatus: record.publicationStatus,
        publishedVersion: record.publishedVersion,
        externalIds: record.externalIds,
        relatedWorks: record.relatedWorks,
        repositories: record.repositories,
        funding: record.funding,
        conferencePresentation: record.conferencePresentation,
        pdsUrl: metadata.pdsUrl,
        indexedAt: metadata.indexedAt,
        createdAt: new Date(record.createdAt),
      });

      if (!storeResult.ok) {
        return {
          ok: false,
          error: new DatabaseError('INDEX', storeResult.error.message),
        };
      }

      await this.storage.trackPDSSource(metadata.uri, metadata.pdsUrl, metadata.indexedAt);

      // Get primary author (first in list, or by order)
      const primaryAuthor = record.authors.find((a) => a.order === 1) ?? record.authors[0];
      const authorDid = primaryAuthor?.did ?? record.submittedBy;
      const authorDoc = authorDid ? await this.identity.resolveDID(authorDid) : undefined;
      const authorName = authorDoc?.alsoKnownAs?.[0] ?? primaryAuthor?.name ?? record.submittedBy;

      const subjects = record.facets
        .filter((f) => f.dimension === 'matter' || f.dimension === 'personality')
        .map((f) => f.value);

      await this.search.indexEprint({
        uri: metadata.uri,
        author: authorDid ?? record.submittedBy,
        authorName,
        title: record.title,
        abstract: abstractPlainText,
        keywords: record.keywords as string[],
        subjects,
        createdAt: new Date(record.createdAt),
        indexedAt: metadata.indexedAt,
      });

      // Auto-generate tags from keywords
      if (this.tagManager && record.keywords && record.keywords.length > 0) {
        const submitterDid = record.submittedBy;
        let tagsIndexed = 0;

        for (const keyword of record.keywords) {
          if (typeof keyword === 'string' && keyword.trim().length > 0) {
            try {
              await this.tagManager.addTag(metadata.uri, keyword.trim(), submitterDid);
              tagsIndexed++;
            } catch (tagError) {
              // Log but don't fail the indexing if tag creation fails
              this.logger.debug('Failed to create tag from keyword', {
                keyword,
                uri: metadata.uri,
                error: tagError instanceof Error ? tagError.message : String(tagError),
              });
            }
          }
        }

        if (tagsIndexed > 0) {
          this.logger.debug('Created tags from keywords', {
            uri: metadata.uri,
            tagsIndexed,
            totalKeywords: record.keywords.length,
          });
        }
      }

      this.logger.info('Indexed eprint', { uri: metadata.uri });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to index eprint', error instanceof Error ? error : undefined, {
        uri: metadata.uri,
      });
      return {
        ok: false,
        error: new DatabaseError('INDEX', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  async indexEprintUpdate(
    _uri: AtUri,
    record: Eprint,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    return this.indexEprint(record, metadata);
  }

  async indexEprintDelete(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      await this.search.deleteDocument(uri);

      this.logger.info('Deleted eprint from indexes', { uri });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to delete eprint', error instanceof Error ? error : undefined, {
        uri,
      });
      return {
        ok: false,
        error: new DatabaseError('DELETE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  async getEprint(uri: AtUri): Promise<EprintView | null> {
    const stored = await this.storage.getEprint(uri);
    if (!stored) {
      return null;
    }

    const versions = await this.versionManager.getVersionChain(uri);

    return {
      ...stored,
      versions: versions.versions,
      metrics: {
        views: 0,
        downloads: 0,
        endorsements: 0,
      },
    };
  }

  async getEprintsByAuthor(did: DID, options?: EprintQueryOptions): Promise<EprintList> {
    const eprints = await this.storage.getEprintsByAuthor(did, options);

    const enriched = eprints.map((p) => ({
      ...p,
      versions: [],
      metrics: { views: 0, downloads: 0, endorsements: 0 },
    }));

    return {
      eprints: enriched,
      total: eprints.length,
    };
  }

  async countEprintsByAuthor(did: DID): Promise<number> {
    return this.storage.countEprintsByAuthor(did);
  }

  async getVersionHistory(uri: AtUri): Promise<readonly EprintVersion[]> {
    const chain = await this.versionManager.getVersionChain(uri);
    return chain.versions;
  }

  async checkStaleness(uri: AtUri): Promise<StalenessStatus> {
    const isStale = await this.storage.isStale(uri);
    const stored = await this.storage.getEprint(uri);

    if (!stored) {
      throw new NotFoundError('Eprint', uri);
    }

    return {
      isStale,
      indexedCid: stored.cid,
      lastSyncedAt: stored.indexedAt,
    };
  }

  async refreshFromPDS(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      const record = await this.repository.getRecord<Eprint>(uri);

      if (!record) {
        return { ok: false, error: new DatabaseError('QUERY', `Eprint not found: ${uri}`) };
      }

      // Determine which DID owns the record (paper's DID if set, otherwise submitter's)
      const recordOwner = record.value.paperDid ?? record.value.submittedBy;
      const pdsUrl = await this.identity.getPDSEndpoint(recordOwner);
      if (!pdsUrl) {
        return {
          ok: false,
          error: new DatabaseError('QUERY', `PDS endpoint not found for: ${recordOwner}`),
        };
      }

      return await this.indexEprint(record.value, {
        uri: record.uri,
        cid: record.cid,
        pdsUrl,
        indexedAt: new Date(),
      });
    } catch (error) {
      return {
        ok: false,
        error: new DatabaseError(
          'QUERY',
          error instanceof Error ? error.message : `Failed to refresh eprint: ${uri}`
        ),
      };
    }
  }

  /**
   * Finds an eprint by external identifiers.
   *
   * @param externalIds - External service identifiers to search
   * @returns First matching eprint or null
   *
   * @remarks
   * Used for duplicate detection when claiming papers.
   * Searches by DOI, arXiv ID, Semantic Scholar ID, etc.
   *
   * @example
   * ```typescript
   * const existing = await eprintService.findByExternalIds({
   *   doi: '10.1234/example',
   *   arxivId: '2301.12345',
   * });
   *
   * if (existing) {
   *   console.log('Paper already exists:', existing.uri);
   * }
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
  }): Promise<EprintView | null> {
    const stored = await this.storage.findByExternalIds(externalIds);
    if (!stored) {
      return null;
    }

    const versions = await this.versionManager.getVersionChain(stored.uri);

    return {
      ...stored,
      versions: versions.versions,
      metrics: {
        views: 0,
        downloads: 0,
        endorsements: 0,
      },
    };
  }

  /**
   * Resolves field URIs to their human-readable labels from the knowledge graph.
   *
   * @param fields - Fields with URIs (labels may be set to URIs by transformer)
   * @returns Fields with resolved labels
   *
   * @internal
   */
  private async resolveFieldLabels(
    fields: readonly { uri: string; label: string; id?: string }[]
  ): Promise<readonly { uri: string; label: string; id?: string }[]> {
    if (!this.graph) {
      return fields;
    }

    // Extract field IDs (URIs are UUIDs in this context)
    const fieldIds = fields.map((f) => f.uri);

    try {
      // Batch fetch all field nodes from the knowledge graph
      const nodeMap = await this.graph.getNodesByIds(fieldIds, 'field');

      // Map fields with resolved labels
      return fields.map((field) => {
        const node = nodeMap.get(field.uri);
        if (node) {
          return {
            uri: field.uri,
            label: node.label,
            id: field.id ?? field.uri,
          };
        }
        // Keep original if node not found (fallback to URI)
        return field;
      });
    } catch (error) {
      this.logger.warn('Failed to resolve field labels, using URIs as fallback', {
        fieldCount: fields.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return fields;
    }
  }
}
