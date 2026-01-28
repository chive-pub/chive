/**
 * Knowledge graph service managing Neo4j operations.
 *
 * @remarks
 * Indexes graph records (node proposals, edge proposals, votes) and
 * provides graph query operations.
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import { AtUri as AtUriParser } from '@atproto/api';

import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type { Facet, IGraphDatabase, GraphNode } from '../../types/interfaces/graph.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IStorageBackend } from '../../types/interfaces/storage.interface.js';
import type { EprintAuthor } from '../../types/models/author.js';
import type { Result } from '../../types/result.js';
import { extractRkeyOrPassthrough, normalizeFieldUri } from '../../utils/at-uri.js';
import { extractPlainText } from '../../utils/rich-text.js';
import type { RecordMetadata } from '../eprint/eprint-service.js';

/**
 * Knowledge graph service configuration.
 *
 * @public
 * @since 0.1.0
 */
export interface KnowledgeGraphServiceOptions {
  readonly graph: IGraphDatabase;
  readonly storage: IStorageBackend;
  readonly logger: ILogger;
}

/**
 * Source PDS information for faceted browse results.
 *
 * @public
 * @since 0.2.0
 */
export interface FacetedSource {
  readonly pdsEndpoint: string;
  readonly recordUrl: string;
  readonly blobUrl?: string;
  readonly lastVerifiedAt?: Date;
  readonly stale: boolean;
}

/**
 * Faceted browse eprint summary.
 *
 * @remarks
 * Uses the unified EprintAuthor model for compatibility with SearchResults component.
 *
 * @public
 * @since 0.1.0
 */
export interface FacetedEprintSummary {
  readonly uri: AtUri;
  readonly cid: string;
  readonly title: string;
  readonly abstract: string;
  readonly authors: readonly EprintAuthor[];
  readonly submittedBy: DID;
  readonly paperDid?: DID;
  readonly fields?: readonly { uri: string; label: string; id?: string; parentUri?: string }[];
  readonly license: string;
  readonly keywords?: readonly string[];
  readonly createdAt: Date;
  readonly indexedAt: Date;
  readonly source: FacetedSource;
  readonly score?: number;
}

/**
 * Facet value with count.
 *
 * @public
 * @since 0.1.0
 */
export interface FacetValue {
  readonly value: string;
  readonly label?: string;
  readonly count: number;
}

/**
 * Faceted browse response.
 *
 * @remarks
 * Uses dynamic facets keyed by slug. Facets are fetched from the knowledge graph
 * where subkind='facet'.
 *
 * @public
 * @since 0.1.0
 */
export interface FacetedBrowseResponse {
  readonly eprints: readonly FacetedEprintSummary[];
  /** Facet values keyed by facet slug */
  readonly availableFacets: Record<string, readonly FacetValue[]>;
  readonly cursor?: string;
  readonly hasMore: boolean;
  readonly total: number;
}

/**
 * Faceted browse query.
 *
 * @remarks
 * Facets are dynamic and keyed by slug. This allows users to propose new facets
 * through governance. Each facet accepts an array of values for multi-select filtering.
 *
 * @public
 * @since 0.1.0
 */
export interface FacetedBrowseQuery {
  /** Optional text query */
  readonly q?: string;
  /** Facet filters keyed by facet slug */
  readonly facets: Record<string, readonly string[]>;
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Knowledge graph service implementation.
 *
 * @example
 * ```typescript
 * const service = new KnowledgeGraphService({ graph, storage, logger });
 *
 * // Index node proposal from firehose
 * await service.indexNodeProposal(proposal, metadata);
 *
 * // Browse faceted
 * const results = await service.browseFaceted({ facets: { personality: ['cs'] } });
 * ```
 *
 * @public
 * @since 0.1.0
 */
export class KnowledgeGraphService {
  private readonly graph: IGraphDatabase;
  /** Storage backend for eprint metadata queries in faceted browsing. */
  private readonly _storage: IStorageBackend;
  private readonly logger: ILogger;

  constructor(options: KnowledgeGraphServiceOptions) {
    this.graph = options.graph;
    this._storage = options.storage;
    this.logger = options.logger;
  }

  /**
   * Gets a node by URI.
   *
   * @param uri - Node AT-URI
   * @returns Node or null if not found
   *
   * @public
   */
  async getNode(uri: string): Promise<GraphNode | null> {
    try {
      return await this.graph.getNodeByUri(uri as AtUri);
    } catch (error) {
      this.logger.error('Failed to get node', error instanceof Error ? error : undefined, { uri });
      return null;
    }
  }

  /**
   * Gets the hierarchy for a node including all children.
   *
   * @param rootUri - Root node AT-URI
   * @param maxDepth - Maximum depth to traverse (default 3)
   * @returns Node hierarchy or null if not found
   *
   * @public
   */
  async getHierarchy(
    rootUri: string,
    maxDepth = 3
  ): Promise<{ node: GraphNode; children: unknown[]; depth: number } | null> {
    try {
      // Normalize URI to AT-URI format before hierarchy lookup
      const normalizedUri = normalizeFieldUri(rootUri);
      return await this.graph.getHierarchy(normalizedUri, maxDepth);
    } catch (error) {
      this.logger.warn('Failed to get node hierarchy', { rootUri, error });
      return null;
    }
  }

  /**
   * Indexes node proposal from user PDS.
   *
   * @remarks
   * Node proposals allow users to suggest new nodes for the knowledge graph.
   * Proposals go through community voting before being approved by trusted editors.
   *
   * @param record - Node proposal record from firehose
   * @param metadata - Record metadata including URI and PDS source
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexNodeProposal(
    record: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    const proposalRecord = record as {
      proposalType?: 'create' | 'update' | 'merge' | 'deprecate';
      kind?: 'type' | 'object';
      subkind?: string;
      targetUri?: string;
      mergeIntoUri?: string;
      proposedNode?: {
        label?: string;
        alternateLabels?: readonly string[];
        description?: string;
        externalIds?: readonly {
          system: string;
          identifier: string;
          uri?: string;
          matchType?: string;
        }[];
        metadata?: Record<string, unknown>;
      };
      rationale?: string;
      evidence?: readonly { url?: string; description?: string }[];
      createdAt?: string;
    };

    if (!proposalRecord.proposalType || !proposalRecord.rationale) {
      this.logger.warn('Invalid node proposal: missing required fields', {
        uri: metadata.uri,
        hasProposalType: !!proposalRecord.proposalType,
        hasRationale: !!proposalRecord.rationale,
      });
      return { ok: true, value: undefined };
    }

    try {
      const parsedUri = new AtUriParser(metadata.uri);
      const proposerDid = parsedUri.hostname as import('../../types/atproto.js').DID;

      await this.graph.createProposal({
        uri: metadata.uri,
        proposalType: proposalRecord.proposalType,
        kind: proposalRecord.kind ?? 'type',
        subkind: proposalRecord.subkind,
        targetUri: proposalRecord.targetUri as AtUri | undefined,
        proposedNode: proposalRecord.proposedNode as Partial<GraphNode> | undefined,
        rationale: proposalRecord.rationale,
        proposerDid,
        createdAt: metadata.indexedAt,
      });

      this.logger.info('Indexed node proposal', {
        uri: metadata.uri,
        proposalType: proposalRecord.proposalType,
        kind: proposalRecord.kind,
        subkind: proposalRecord.subkind,
        label: proposalRecord.proposedNode?.label,
        pdsUrl: metadata.pdsUrl,
      });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error(
        'Failed to index node proposal',
        error instanceof Error ? error : undefined,
        { uri: metadata.uri }
      );
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Indexes edge proposal from user PDS.
   *
   * @remarks
   * Edge proposals allow users to suggest new relationships between nodes.
   * Proposals go through community voting before being approved by trusted editors.
   *
   * @param record - Edge proposal record from firehose
   * @param metadata - Record metadata including URI and PDS source
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexEdgeProposal(
    record: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    const proposalRecord = record as {
      proposalType?: 'create' | 'update' | 'deprecate';
      targetEdgeUri?: string;
      proposedEdge?: {
        sourceUri?: string;
        targetUri?: string;
        relationUri?: string;
        relationSlug?: string;
        weight?: number;
        metadata?: Record<string, unknown>;
      };
      rationale?: string;
      evidence?: readonly { url?: string; description?: string }[];
      createdAt?: string;
    };

    if (!proposalRecord.proposalType || !proposalRecord.rationale) {
      this.logger.warn('Invalid edge proposal: missing required fields', {
        uri: metadata.uri,
        hasProposalType: !!proposalRecord.proposalType,
        hasRationale: !!proposalRecord.rationale,
      });
      return { ok: true, value: undefined };
    }

    try {
      const parsedUri = new AtUriParser(metadata.uri);
      const proposerDid = parsedUri.hostname as import('../../types/atproto.js').DID;

      await this.graph.createProposal({
        uri: metadata.uri,
        proposalType: proposalRecord.proposalType,
        kind: 'type', // Edge proposals don't have node kind
        targetUri: proposalRecord.targetEdgeUri as AtUri | undefined,
        proposedNode: proposalRecord.proposedEdge as Partial<GraphNode> | undefined,
        rationale: proposalRecord.rationale,
        proposerDid,
        createdAt: metadata.indexedAt,
      });

      this.logger.info('Indexed edge proposal', {
        uri: metadata.uri,
        proposalType: proposalRecord.proposalType,
        sourceUri: proposalRecord.proposedEdge?.sourceUri,
        targetUri: proposalRecord.proposedEdge?.targetUri,
        relationSlug: proposalRecord.proposedEdge?.relationSlug,
        pdsUrl: metadata.pdsUrl,
      });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error(
        'Failed to index edge proposal',
        error instanceof Error ? error : undefined,
        { uri: metadata.uri }
      );
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Indexes a vote on a proposal from user PDS.
   *
   * @param record - Vote record from firehose
   * @param metadata - Record metadata including URI and PDS source
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexVote(record: unknown, metadata: RecordMetadata): Promise<Result<void, DatabaseError>> {
    const voteRecord = record as {
      proposalUri?: string;
      vote?: 'approve' | 'reject' | 'abstain' | 'request-changes';
      comment?: string;
      createdAt?: string;
    };

    if (!voteRecord.proposalUri || !voteRecord.vote) {
      this.logger.warn('Invalid vote: missing required fields', {
        uri: metadata.uri,
        hasProposalUri: !!voteRecord.proposalUri,
        hasVote: !!voteRecord.vote,
      });
      return { ok: true, value: undefined };
    }

    try {
      const parsedUri = new AtUriParser(metadata.uri);
      const voterDid = parsedUri.hostname as import('../../types/atproto.js').DID;

      await this.graph.createVote({
        id: parsedUri.rkey,
        uri: metadata.uri,
        proposalUri: voteRecord.proposalUri as AtUri,
        voterDid,
        voterRole: 'community-member', // Default role; actual role determined by governance service
        vote: voteRecord.vote,
        comment: voteRecord.comment,
        createdAt: metadata.indexedAt,
      });

      this.logger.info('Indexed vote', {
        uri: metadata.uri,
        proposalUri: voteRecord.proposalUri,
        vote: voteRecord.vote,
        pdsUrl: metadata.pdsUrl,
      });

      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error('Failed to index vote', error instanceof Error ? error : undefined, {
        uri: metadata.uri,
      });
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Browses eprints using faceted classification.
   *
   * @remarks
   * Queries Neo4j for eprints matching PMEST facets and enriches with
   * metadata from storage. Aggregates available facet refinements for UI.
   *
   * The 5-dimensional PMEST facets are:
   * - **Personality**: Disciplinary perspective (field nodes)
   * - **Matter**: Subject matter, phenomena
   * - **Energy**: Processes, methods
   * - **Space**: Geographic/spatial context
   * - **Time**: Temporal period
   *
   * @param query - Faceted browse query
   * @returns Matching eprints with available facet refinements
   *
   * @public
   */
  async browseFaceted(query: FacetedBrowseQuery): Promise<FacetedBrowseResponse> {
    try {
      const limit = query.limit ?? 20;
      const offset = query.cursor ? parseInt(query.cursor, 10) : 0;

      // Build facet filter from dynamic facet dimensions
      // Each dimension can have multiple values for OR-style filtering within the dimension
      const facets: Facet[] = [];

      for (const [dimension, values] of Object.entries(query.facets)) {
        if (values && values.length > 0) {
          for (const value of values) {
            facets.push({ dimension, value });
          }
        }
      }

      this.logger.info('Browsing faceted', { facets, limit, offset });

      // Query eprint URIs; if no facets specified, get all eprints.
      let matchingEprintUris: readonly string[];
      if (facets.length === 0) {
        // No facets: return all eprints from storage (paginated)
        this.logger.info('No facets specified, listing all eprints from storage');
        matchingEprintUris = await this._storage.listEprintUris({ limit: 1000 });
        this.logger.info('Storage returned URIs', { uris: matchingEprintUris });
      } else {
        // Facet values are field AT-URIs; extract rkeys (UUIDs) for PostgreSQL query
        // PostgreSQL stores field references as UUIDs, not full AT-URIs
        const fieldIds = facets
          .map((f) => f.value)
          .filter((v) => v.startsWith('at://'))
          .map((uri) => extractRkeyOrPassthrough(uri));

        if (fieldIds.length > 0) {
          this.logger.info('Querying by field IDs', { fieldIds });
          matchingEprintUris = await this._storage.listEprintUrisByFieldUri(fieldIds, {
            limit: 1000,
          });
        } else {
          this.logger.warn('No valid field URIs in facet values', { facets });
          matchingEprintUris = [];
        }
      }

      this.logger.info('Found matching eprints', {
        count: matchingEprintUris.length,
        hasFacets: facets.length > 0,
      });

      // Apply pagination to URIs
      const paginatedUris = matchingEprintUris.slice(offset, offset + limit + 1);
      const hasMore = paginatedUris.length > limit;
      if (hasMore) {
        paginatedUris.pop();
      }

      // Fetch eprint metadata from storage
      const eprints: FacetedEprintSummary[] = [];
      for (const uri of paginatedUris) {
        const eprint = await this._storage.getEprint(uri as AtUri);
        if (eprint) {
          // Determine which DID owns the record (paper's DID if set, otherwise submitter's)
          const recordOwner = eprint.paperDid ?? eprint.submittedBy;
          // Build record URL from AT URI
          const recordUrl = `${eprint.pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${recordOwner}&collection=pub.chive.eprint.submission&rkey=${(eprint.uri as string).split('/').pop()}`;

          eprints.push({
            uri: eprint.uri,
            cid: eprint.cid,
            title: eprint.title,
            abstract: eprint.abstractPlainText ?? extractPlainText(eprint.abstract),
            authors: eprint.authors,
            submittedBy: eprint.submittedBy,
            paperDid: eprint.paperDid,
            fields: eprint.fields?.map((f) => ({
              uri: f.uri,
              label: f.label,
              id: f.id,
              parentUri: f.parentUri,
            })),
            license: eprint.license ?? 'CC-BY-4.0',
            keywords: eprint.keywords,
            createdAt: eprint.createdAt,
            indexedAt: eprint.indexedAt,
            source: {
              pdsEndpoint: eprint.pdsUrl,
              recordUrl,
              stale: false, // Could be computed from lastVerifiedAt
            },
          });
        }
      }

      // Aggregate available facet refinements
      const aggregations = await this.graph.aggregateFacets(facets);

      // Group by dimension - availableFacets is dynamic, keyed by facet slug
      const availableFacets: Record<string, FacetValue[]> = {};
      for (const agg of aggregations) {
        const values = agg.values.map((v) => ({
          value: v.value,
          label: v.value,
          count: v.count,
        }));
        availableFacets[agg.dimension] = values;
      }

      const nextCursor = hasMore ? String(offset + limit) : undefined;

      return {
        eprints,
        availableFacets,
        cursor: nextCursor,
        hasMore,
        total: matchingEprintUris.length,
      };
    } catch (error) {
      this.logger.error('Failed to browse faceted', error instanceof Error ? error : undefined, {
        facets: query.facets,
      });
      return {
        eprints: [],
        availableFacets: {},
        cursor: undefined,
        hasMore: false,
        total: 0,
      };
    }
  }

  /**
   * Lists governance proposals with optional filtering.
   *
   * @param options - Filter and pagination options
   * @returns Paginated proposals
   *
   * @public
   */
  async listProposals(options: {
    status?: 'pending' | 'approved' | 'rejected';
    type?: 'create' | 'update' | 'merge' | 'deprecate';
    nodeUri?: string;
    proposedBy?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    proposals: ProposalView[];
    cursor?: string;
    hasMore: boolean;
    total: number;
  }> {
    try {
      const limit = options.limit ?? 50;
      const offset = options.cursor ? parseInt(options.cursor, 10) : 0;

      const result = await this.graph.listProposals({
        status: options.status ? [options.status] : undefined,
        proposalType: options.type ? [options.type] : undefined,
        nodeUri: options.nodeUri as AtUri | undefined,
        proposerDid: options.proposedBy as DID | undefined,
        limit,
        offset,
      });

      const proposals: ProposalView[] = result.proposals.map((p) => ({
        id: p.id,
        uri: p.uri as string,
        nodeUri: (p.targetUri ?? '') as string,
        type: p.proposalType as 'create' | 'update' | 'merge' | 'deprecate',
        changes: (p.proposedNode ?? {}) as Record<string, unknown>,
        rationale: p.rationale,
        status: p.status as 'pending' | 'approved' | 'rejected',
        proposedBy: p.proposerDid,
        votes: {
          approve: 0, // Would need to calculate from votes
          reject: 0,
          abstain: 0,
        },
        createdAt: p.createdAt,
      }));

      const nextCursor = result.hasMore ? String(offset + limit) : undefined;

      return {
        proposals,
        cursor: nextCursor,
        hasMore: result.hasMore,
        total: result.total,
      };
    } catch (error) {
      this.logger.error('Failed to list proposals', error instanceof Error ? error : undefined);
      return {
        proposals: [],
        hasMore: false,
        total: 0,
      };
    }
  }

  /**
   * Gets a proposal by ID.
   *
   * @param proposalId - Proposal identifier
   * @returns Proposal view or null if not found
   *
   * @public
   */
  async getProposalById(proposalId: string): Promise<ProposalView | null> {
    try {
      const proposal = await this.graph.getProposal(proposalId as AtUri);

      if (!proposal) {
        return null;
      }

      return {
        id: proposal.id,
        uri: proposal.uri as string,
        nodeUri: (proposal.targetUri ?? '') as string,
        type: proposal.proposalType as 'create' | 'update' | 'merge' | 'deprecate',
        changes: (proposal.proposedNode ?? {}) as Record<string, unknown>,
        rationale: proposal.rationale,
        status: proposal.status as 'pending' | 'approved' | 'rejected',
        proposedBy: proposal.proposerDid,
        votes: {
          approve: 0,
          reject: 0,
          abstain: 0,
        },
        createdAt: proposal.createdAt,
      };
    } catch (error) {
      this.logger.error('Failed to get proposal', error instanceof Error ? error : undefined, {
        proposalId,
      });
      return null;
    }
  }

  /**
   * Gets votes for a proposal.
   *
   * @param proposalUri - Proposal AT-URI
   * @returns Array of votes
   *
   * @public
   */
  async getVotesForProposal(proposalUri: string): Promise<VoteView[]> {
    try {
      const votes = await this.graph.getVotesForProposal(proposalUri as AtUri);

      return votes.map((v) => ({
        id: v.id,
        uri: v.uri,
        proposalUri: v.proposalUri,
        voterDid: v.voterDid,
        voterRole: v.voterRole,
        vote: v.vote,
        weight: this.getVoteWeight(v.voterRole),
        rationale: v.comment,
        createdAt: v.createdAt,
      }));
    } catch (error) {
      this.logger.error('Failed to get votes', error instanceof Error ? error : undefined, {
        proposalUri,
      });
      return [];
    }
  }

  /**
   * Gets vote weight by role.
   * Returns integer 0-1000 (normalized weight scaled for lexicon compliance).
   *
   * @internal
   */
  private getVoteWeight(role: string): number {
    // Raw role weights (1-5 scale)
    let rawWeight: number;
    switch (role) {
      case 'administrator':
        rawWeight = 5.0;
        break;
      case 'domain-expert':
        rawWeight = 3.0;
        break;
      case 'graph-editor':
      case 'trusted-editor':
        rawWeight = 2.0;
        break;
      case 'community-member':
      default:
        rawWeight = 1.0;
    }
    // Normalize to 0-1 range (divide by max weight 5) and scale to 0-1000 for lexicon
    return Math.round((rawWeight / 5.0) * 1000);
  }
}

/**
 * View model for proposals.
 *
 * @public
 */
export interface ProposalView {
  readonly id: string;
  readonly uri: string;
  readonly nodeUri: string;
  readonly type: 'create' | 'update' | 'merge' | 'deprecate';
  readonly changes: Record<string, unknown>;
  readonly rationale: string;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly proposedBy: DID;
  readonly votes: {
    readonly approve: number;
    readonly reject: number;
    readonly abstain: number;
  };
  readonly createdAt: Date;
}

/**
 * View model for votes.
 *
 * @public
 */
export interface VoteView {
  readonly id: string;
  readonly uri: string;
  readonly proposalUri: string;
  readonly voterDid: DID;
  readonly voterRole: string;
  readonly vote: string;
  readonly weight: number;
  readonly rationale?: string;
  readonly createdAt: Date;
}
