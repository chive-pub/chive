/**
 * Preprint service orchestrating indexing and query operations.
 *
 * @remarks
 * Application-layer service that coordinates preprint operations across
 * storage, search, and repository infrastructure adapters.
 *
 * **Service Responsibilities:**
 * - Index preprints from firehose events (read-only from PDSes)
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
 * const service = new PreprintService({
 *   storage,
 *   search,
 *   repository,
 *   identity,
 *   logger
 * });
 *
 * // Index from firehose event
 * const result = await service.indexPreprint(record, metadata);
 * if (!result.ok) {
 *   logger.error('Indexing failed:', result.error);
 * }
 *
 * // Query indexed preprint
 * const preprint = await service.getPreprint(uri);
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
  PreprintQueryOptions,
  StoredPreprint,
} from '../../types/interfaces/storage.interface.js';
import type { Preprint, PreprintVersion } from '../../types/models/preprint.ts';
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
 * Preprint service configuration.
 *
 * @public
 */
export interface PreprintServiceOptions {
  readonly storage: IStorageBackend;
  readonly search: ISearchEngine;
  readonly repository: IRepository;
  readonly identity: IIdentityResolver;
  readonly logger: ILogger;
}

/**
 * Preprint view with enriched metadata.
 *
 * @public
 */
export interface PreprintView extends StoredPreprint {
  readonly versions: readonly PreprintVersion[];
  readonly metrics?: {
    readonly views: number;
    readonly downloads: number;
    readonly endorsements: number;
  };
}

/**
 * Paginated preprint list.
 *
 * @public
 */
export interface PreprintList {
  readonly preprints: readonly PreprintView[];
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
 * Preprint service implementation.
 *
 * @public
 */
export class PreprintService {
  private readonly storage: IStorageBackend;
  private readonly search: ISearchEngine;
  private readonly repository: IRepository;
  private readonly identity: IIdentityResolver;
  private readonly logger: ILogger;
  private readonly versionManager: VersionManager;

  constructor(options: PreprintServiceOptions) {
    this.storage = options.storage;
    this.search = options.search;
    this.repository = options.repository;
    this.identity = options.identity;
    this.logger = options.logger;
    this.versionManager = new VersionManager({ storage: options.storage });
  }

  async indexPreprint(
    record: Preprint,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      const storeResult = await this.storage.storePreprint({
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

      await this.search.indexPreprint({
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

      this.logger.info('Indexed preprint', { uri: metadata.uri });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to index preprint', error instanceof Error ? error : undefined, {
        uri: metadata.uri,
      });
      return {
        ok: false,
        error: new DatabaseError('INDEX', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  async indexPreprintUpdate(
    _uri: AtUri,
    record: Preprint,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    return this.indexPreprint(record, metadata);
  }

  async indexPreprintDelete(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      await this.search.deleteDocument(uri);

      this.logger.info('Deleted preprint from indexes', { uri });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to delete preprint', error instanceof Error ? error : undefined, {
        uri,
      });
      return {
        ok: false,
        error: new DatabaseError('DELETE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  async getPreprint(uri: AtUri): Promise<PreprintView | null> {
    const stored = await this.storage.getPreprint(uri);
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

  async getPreprintsByAuthor(did: DID, options?: PreprintQueryOptions): Promise<PreprintList> {
    const preprints = await this.storage.getPreprintsByAuthor(did, options);

    const enriched = preprints.map((p) => ({
      ...p,
      versions: [],
      metrics: { views: 0, downloads: 0, endorsements: 0 },
    }));

    return {
      preprints: enriched,
      total: preprints.length,
    };
  }

  async getVersionHistory(uri: AtUri): Promise<readonly PreprintVersion[]> {
    const chain = await this.versionManager.getVersionChain(uri);
    return chain.versions;
  }

  async checkStaleness(uri: AtUri): Promise<StalenessStatus> {
    const isStale = await this.storage.isStale(uri);
    const stored = await this.storage.getPreprint(uri);

    if (!stored) {
      throw new NotFoundError('Preprint', uri);
    }

    return {
      isStale,
      indexedCid: stored.cid,
      lastSyncedAt: stored.indexedAt,
    };
  }

  async refreshFromPDS(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      const record = await this.repository.getRecord<Preprint>(uri);

      if (!record) {
        return { ok: false, error: new DatabaseError('QUERY', `Preprint not found: ${uri}`) };
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

      return await this.indexPreprint(record.value, {
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
          error instanceof Error ? error.message : `Failed to refresh preprint: ${uri}`
        ),
      };
    }
  }
}
