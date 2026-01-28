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
  ChangelogQueryOptions as StorageChangelogQueryOptions,
  ChangelogListResult,
  IndexedUserTag,
} from '../../types/interfaces/storage.interface.js';
import type { Eprint, EprintVersion } from '../../types/models/eprint.ts';
import type { Result } from '../../types/result.js';
import { extractRkeyOrPassthrough, normalizeFieldUri } from '../../utils/at-uri.js';
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
  /**
   * Indicates the source record uses a legacy abstract format.
   *
   * @remarks
   * Set by the transformer when the source PDS record has a plain string
   * abstract instead of the current rich text array format.
   */
  readonly needsAbstractMigration?: boolean;
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
 * Changelog section with category and items.
 *
 * @public
 */
export interface ChangelogSection {
  readonly category: string;
  readonly items: readonly ChangelogItem[];
}

/**
 * Individual change item in a changelog section.
 *
 * @public
 */
export interface ChangelogItem {
  readonly description: string;
  readonly changeType?: string;
  readonly location?: string;
  readonly reviewReference?: string;
}

/**
 * Semantic version for structured versioning.
 *
 * @public
 */
export interface SemanticVersionView {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: string;
}

/**
 * Changelog view with full metadata.
 *
 * @public
 */
export interface ChangelogView {
  readonly uri: AtUri;
  readonly cid: CID;
  readonly eprintUri: AtUri;
  readonly version: SemanticVersionView;
  readonly previousVersion?: SemanticVersionView;
  readonly summary?: string;
  readonly sections: readonly ChangelogSection[];
  readonly reviewerResponse?: string;
  readonly createdAt: string;
}

/**
 * Paginated changelog list.
 *
 * @public
 */
export interface ChangelogList {
  readonly changelogs: readonly ChangelogView[];
  readonly total: number;
  readonly cursor?: string;
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
    // Track completed indexing stages for rollback on failure (saga pattern)
    const completedStages: ('postgres' | 'elasticsearch' | 'neo4j')[] = [];

    try {
      const abstractPlainText = extractPlainText(record.abstract);

      // Resolve field labels from knowledge graph if available
      let resolvedFields = record.fields;
      if (this.graph && record.fields && record.fields.length > 0) {
        resolvedFields = await this.resolveFieldLabels(record.fields);
      }

      // Stage 1: PostgreSQL
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
        needsAbstractMigration: metadata.needsAbstractMigration,
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
      completedStages.push('postgres');

      await this.storage.trackPDSSource(metadata.uri, metadata.pdsUrl, metadata.indexedAt);

      // Get primary author (first in list, or by order)
      const primaryAuthor = record.authors.find((a) => a.order === 1) ?? record.authors[0];
      const authorDid = primaryAuthor?.did ?? record.submittedBy;
      const authorDoc = authorDid ? await this.identity.resolveDID(authorDid) : undefined;
      const authorName = authorDoc?.alsoKnownAs?.[0] ?? primaryAuthor?.name ?? record.submittedBy;

      const subjects = (record.facets ?? [])
        .filter((f) => f.dimension === 'matter' || f.dimension === 'personality')
        .map((f) => f.value);

      // Map resolved fields to the format expected by search indexing
      // Filter out fields without IDs (should not happen, but be defensive)
      const fieldNodes = resolvedFields
        ?.filter((f): f is typeof f & { id: string } => f.id !== undefined)
        .map((f) => ({
          id: f.id,
          label: f.label,
        }));

      // Stage 2: Elasticsearch
      try {
        await this.search.indexEprint({
          uri: metadata.uri,
          author: authorDid ?? record.submittedBy,
          authorName,
          title: record.title,
          abstract: abstractPlainText,
          keywords: record.keywords as string[],
          subjects,
          fieldNodes,
          createdAt: new Date(record.createdAt),
          indexedAt: metadata.indexedAt,
        });
        completedStages.push('elasticsearch');
      } catch (esError) {
        // Elasticsearch failed after PostgreSQL succeeded; rollback
        this.logger.error(
          'Elasticsearch indexing failed, rolling back',
          esError instanceof Error ? esError : undefined,
          { uri: metadata.uri }
        );
        await this.rollbackIndexing(metadata.uri, completedStages);
        return {
          ok: false,
          error: new DatabaseError(
            'INDEX',
            `Elasticsearch indexing failed: ${esError instanceof Error ? esError.message : String(esError)}`
          ),
        };
      }

      // Stage 3: Neo4j (tags from keywords)
      // Track neo4j stage immediately once we start, so partial tags get rolled back on failure
      if (this.tagManager && record.keywords && record.keywords.length > 0) {
        const submitterDid = record.submittedBy;
        let tagsIndexed = 0;
        // Mark stage as started before any tag operations, so rollback cleans up any partial tags
        completedStages.push('neo4j');

        try {
          const skippedKeywords: string[] = [];

          for (const keyword of record.keywords) {
            if (typeof keyword === 'string' && keyword.trim().length > 0) {
              await this.tagManager.addTag(metadata.uri, keyword.trim(), submitterDid);
              tagsIndexed++;
            } else {
              // Track skipped keywords for warning
              skippedKeywords.push(String(keyword));
            }
          }

          if (skippedKeywords.length > 0) {
            this.logger.warn('Skipped invalid keywords during tag indexing', {
              uri: metadata.uri,
              skippedCount: skippedKeywords.length,
              skippedKeywords: skippedKeywords.slice(0, 5), // Limit to avoid log bloat
            });
          }

          if (tagsIndexed > 0) {
            this.logger.debug('Created tags from keywords', {
              uri: metadata.uri,
              tagsIndexed,
              totalKeywords: record.keywords.length,
            });
          }
        } catch (tagError) {
          // Neo4j failed after PostgreSQL and Elasticsearch succeeded; rollback
          this.logger.error(
            'Neo4j tag indexing failed, rolling back',
            tagError instanceof Error ? tagError : undefined,
            { uri: metadata.uri }
          );
          await this.rollbackIndexing(metadata.uri, completedStages);
          return {
            ok: false,
            error: new DatabaseError(
              'INDEX',
              `Neo4j tag indexing failed: ${tagError instanceof Error ? tagError.message : String(tagError)}`
            ),
          };
        }
      }

      this.logger.info('Indexed eprint', { uri: metadata.uri });

      return { ok: true, value: undefined };
    } catch (error) {
      // Unexpected error; rollback any completed stages
      this.logger.error('Failed to index eprint', error instanceof Error ? error : undefined, {
        uri: metadata.uri,
      });
      if (completedStages.length > 0) {
        await this.rollbackIndexing(metadata.uri, completedStages);
      }
      return {
        ok: false,
        error: new DatabaseError('INDEX', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Rolls back completed indexing stages on failure (compensation pattern).
   *
   * @param uri - AT URI of the eprint to rollback
   * @param stages - Completed stages to rollback (in order of completion)
   *
   * @remarks
   * This method is best-effort: it logs errors but does not throw.
   * Rollback proceeds in reverse order of completion to maintain consistency.
   *
   * @internal
   */
  private async rollbackIndexing(
    uri: AtUri,
    stages: ('postgres' | 'elasticsearch' | 'neo4j')[]
  ): Promise<void> {
    this.logger.info('Rolling back indexing', { uri, stages });

    // Rollback in reverse order of completion
    const reversedStages = [...stages].reverse();

    for (const stage of reversedStages) {
      try {
        switch (stage) {
          case 'neo4j':
            if (this.tagManager) {
              const removedCount = await this.tagManager.removeAllTagsForRecord(uri);
              this.logger.debug('Rolled back Neo4j tags', { uri, removedCount });
            }
            break;

          case 'elasticsearch':
            await this.search.deleteDocument(uri);
            this.logger.debug('Rolled back Elasticsearch document', { uri });
            break;

          case 'postgres':
            await this.storage.deleteEprint(uri);
            this.logger.debug('Rolled back PostgreSQL record', { uri });
            break;
        }
      } catch (rollbackError) {
        // Log but continue with other rollbacks (best-effort)
        this.logger.error(
          `Failed to rollback ${stage}`,
          rollbackError instanceof Error ? rollbackError : undefined,
          { uri, stage }
        );
      }
    }

    this.logger.info('Rollback complete', { uri, stages });
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
      // Delete from PostgreSQL first (source of truth for indexed data)
      const storageResult = await this.storage.deleteEprint(uri);
      if (!storageResult.ok) {
        this.logger.warn('PostgreSQL deletion failed', {
          uri,
          error: storageResult.error.message,
        });
        // Continue to try Elasticsearch deletion
      }

      // Delete from Elasticsearch
      try {
        await this.search.deleteDocument(uri);
      } catch (searchError) {
        this.logger.warn('Elasticsearch deletion failed, PostgreSQL may already be deleted', {
          uri,
          error: searchError instanceof Error ? searchError.message : String(searchError),
        });
        // Continue; PostgreSQL is the primary index
      }

      // Clean up Neo4j tag relationships
      // Errors here should not prevent overall deletion (log and continue)
      if (this.tagManager) {
        try {
          const removedCount = await this.tagManager.removeAllTagsForRecord(uri);
          if (removedCount > 0) {
            this.logger.debug('Removed tag relationships from Neo4j', {
              uri,
              removedCount,
            });
          }
        } catch (tagError) {
          this.logger.warn('Neo4j tag cleanup failed, PostgreSQL is source of truth', {
            uri,
            error: tagError instanceof Error ? tagError.message : String(tagError),
          });
          // Continue; PostgreSQL is the primary index
        }
      }

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
   * const changelog = await eprintService.getChangelog(
   *   'at://did:plc:abc/pub.chive.eprint.changelog/xyz'
   * );
   *
   * if (changelog) {
   *   console.log('Version:', changelog.version);
   *   console.log('Summary:', changelog.summary);
   * }
   * ```
   *
   * @public
   */
  async getChangelog(uri: AtUri): Promise<ChangelogView | null> {
    this.logger.debug('Getting changelog', { uri });

    // Changelogs are stored in PostgreSQL alongside eprints.
    // This method retrieves a single changelog by its AT-URI.
    const changelog = await this.storage.getChangelog(uri);

    if (!changelog) {
      return null;
    }

    // Convert StoredChangelog to ChangelogView
    return {
      uri: changelog.uri,
      cid: changelog.cid,
      eprintUri: changelog.eprintUri,
      version: changelog.version,
      previousVersion: changelog.previousVersion,
      summary: changelog.summary,
      sections: changelog.sections,
      reviewerResponse: changelog.reviewerResponse,
      createdAt: changelog.createdAt,
    };
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
   * Each changelog describes changes introduced in a specific version.
   *
   * @example
   * ```typescript
   * const result = await eprintService.listChangelogs(
   *   'at://did:plc:abc/pub.chive.eprint.submission/xyz',
   *   { limit: 10 }
   * );
   *
   * for (const changelog of result.changelogs) {
   *   console.log(`v${changelog.version.major}.${changelog.version.minor}: ${changelog.summary}`);
   * }
   * ```
   *
   * @public
   */
  async listChangelogs(eprintUri: AtUri, options?: ChangelogQueryOptions): Promise<ChangelogList> {
    this.logger.debug('Listing changelogs', { eprintUri, options });

    // Changelogs are stored in PostgreSQL and linked to eprints via eprintUri.
    // This method retrieves all changelogs for a specific eprint.
    const result: ChangelogListResult = await this.storage.listChangelogs(
      eprintUri,
      options as StorageChangelogQueryOptions
    );

    // Convert StoredChangelog[] to ChangelogView[]
    const changelogs: ChangelogView[] = result.changelogs.map((changelog) => ({
      uri: changelog.uri,
      cid: changelog.cid,
      eprintUri: changelog.eprintUri,
      version: changelog.version,
      previousVersion: changelog.previousVersion,
      summary: changelog.summary,
      sections: changelog.sections,
      reviewerResponse: changelog.reviewerResponse,
      createdAt: changelog.createdAt,
    }));

    return {
      changelogs,
      total: result.total,
    };
  }

  /**
   * Resolves field URIs to their human-readable labels from the knowledge graph.
   *
   * @param fields - Fields with URIs (labels may be set to URIs by transformer)
   * @returns Fields with resolved labels and normalized IDs
   *
   * @remarks
   * Fields may contain either AT-URIs or UUIDs. This method extracts UUIDs
   * from AT-URIs before querying Neo4j, which stores nodes by UUID.
   *
   * The `id` field is always set to the extracted UUID (from uri or existing id),
   * ensuring Elasticsearch indexing uses UUIDs consistently.
   *
   * @internal
   */
  private async resolveFieldLabels(
    fields: readonly { uri: string; label: string; id?: string }[]
  ): Promise<readonly { uri: string; label: string; id?: string }[]> {
    // Normalize all field URIs to AT-URI format before processing
    const normalizedFields = fields.map((field) => {
      const normalizedUri = normalizeFieldUri(field.uri);
      const fieldId = extractRkeyOrPassthrough(normalizedUri);
      return {
        uri: normalizedUri,
        label: field.label,
        id: fieldId,
      };
    });

    if (!this.graph) {
      // Even without graph, ensure URIs are normalized and id is set to UUID
      return normalizedFields;
    }

    // Extract UUIDs from normalized AT-URIs (Neo4j stores nodes by UUID, not full AT-URI)
    const fieldIds = normalizedFields.map((f) => f.id);

    try {
      // Batch fetch all field nodes from the knowledge graph
      const nodeMap = await this.graph.getNodesByIds(fieldIds, 'field');

      // Map fields with resolved labels and normalized URIs
      return normalizedFields.map((field) => {
        const node = nodeMap.get(field.id);
        if (node) {
          return {
            uri: field.uri,
            label: node.label,
            id: field.id,
          };
        }
        // Node not found: use normalized URI, keep original label
        return {
          uri: field.uri,
          label: field.label,
          id: field.id,
        };
      });
    } catch (error) {
      this.logger.warn('Failed to resolve field labels, using URIs as fallback', {
        fieldCount: normalizedFields.length,
        error: error instanceof Error ? error.message : String(error),
      });
      // On error, return normalized fields with original labels
      return normalizedFields;
    }
  }

  /**
   * Retrieves user tags for an eprint from the PostgreSQL index.
   *
   * @param eprintUri - AT-URI of the eprint
   * @returns Array of indexed user tags
   *
   * @remarks
   * Returns individual user tag records indexed from the firehose.
   * Each tag includes the tagger's DID, original tag text, and creation time.
   *
   * @example
   * ```typescript
   * const tags = await eprintService.getTagsForEprint(uri);
   * for (const tag of tags) {
   *   console.log(`${tag.taggerDid} tagged: ${tag.tag}`);
   * }
   * ```
   *
   * @public
   */
  async getTagsForEprint(eprintUri: AtUri): Promise<readonly IndexedUserTag[]> {
    return this.storage.getTagsForEprint(eprintUri);
  }
}
