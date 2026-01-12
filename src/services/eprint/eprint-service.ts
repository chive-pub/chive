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

import type { AtUri, CID, DID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError } from '../../types/errors.js';
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

  constructor(options: EprintServiceOptions) {
    this.storage = options.storage;
    this.search = options.search;
    this.repository = options.repository;
    this.identity = options.identity;
    this.logger = options.logger;
    this.versionManager = new VersionManager({ storage: options.storage });
  }

  async indexEprint(
    record: Eprint,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      const storeResult = await this.storage.storeEprint({
        uri: metadata.uri,
        cid: metadata.cid,
        authors: record.authors,
        submittedBy: record.submittedBy,
        paperDid: record.paperDid,
        title: record.title,
        abstract: record.abstract,
        documentBlobRef: record.documentBlobRef,
        documentFormat: record.documentFormat,
        supplementaryMaterials: record.supplementaryMaterials,
        previousVersionUri: record.previousVersionUri,
        versionNotes: record.versionNotes,
        keywords: record.keywords,
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
        abstract: record.abstract,
        keywords: record.keywords as string[],
        subjects,
        createdAt: new Date(record.createdAt),
        indexedAt: metadata.indexedAt,
      });

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
}
