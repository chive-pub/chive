/**
 * Knowledge graph service managing Neo4j operations.
 *
 * @remarks
 * Indexes graph records (proposals, votes, authority records, facets) and
 * provides graph query operations.
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type { Facet, IGraphDatabase } from '../../types/interfaces/graph.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IStorageBackend } from '../../types/interfaces/storage.interface.js';
import type { Result } from '../../types/result.js';
import type { RecordMetadata } from '../preprint/preprint-service.js';

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
 * Field detail with extended information.
 *
 * @public
 * @since 0.1.0
 */
export interface FieldDetail {
  readonly id: string;
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly parentId?: string;
  readonly status: 'proposed' | 'approved' | 'deprecated';
  readonly preprintCount: number;
  readonly externalIds?: readonly {
    readonly source: string;
    readonly id: string;
    readonly url?: string;
  }[];
  readonly createdAt: Date;
  readonly updatedAt?: Date;
}

/**
 * Child field summary.
 *
 * @public
 * @since 0.1.0
 */
export interface ChildField {
  readonly id: string;
  readonly name: string;
  readonly preprintCount: number;
}

/**
 * Ancestor field reference.
 *
 * @public
 * @since 0.1.0
 */
export interface AncestorField {
  readonly id: string;
  readonly name: string;
}

/**
 * Field relationship.
 *
 * @public
 * @since 0.1.0
 */
export interface FieldRelationship {
  readonly type: string;
  readonly targetId: string;
  readonly targetName: string;
  readonly strength?: number;
}

/**
 * Authority record for search results.
 *
 * @public
 * @since 0.1.0
 */
export interface AuthoritySearchResult {
  readonly id: string;
  readonly uri: string;
  readonly name: string;
  readonly type: 'person' | 'organization' | 'concept' | 'place';
  readonly alternateNames?: readonly string[];
  readonly description?: string;
  readonly externalIds?: readonly {
    readonly source: 'wikidata' | 'lcsh' | 'fast' | 'mesh' | 'arxiv';
    readonly id: string;
    readonly url?: string;
  }[];
  readonly status: 'proposed' | 'under_review' | 'approved' | 'deprecated';
  readonly createdAt: Date;
  readonly updatedAt?: Date;
}

/**
 * Authority search response.
 *
 * @public
 * @since 0.1.0
 */
export interface AuthoritySearchResponse {
  readonly authorities: readonly AuthoritySearchResult[];
  readonly cursor?: string;
  readonly hasMore: boolean;
  readonly total: number;
}

/**
 * Authority search query.
 *
 * @public
 * @since 0.1.0
 */
export interface AuthoritySearchQuery {
  readonly query?: string;
  readonly type?: 'person' | 'organization' | 'concept' | 'place';
  readonly status?: 'proposed' | 'under_review' | 'approved' | 'deprecated';
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Author information for faceted browse results.
 *
 * @public
 * @since 0.2.0
 */
export interface FacetedAuthor {
  readonly did: string;
  readonly handle?: string;
  readonly displayName?: string;
  readonly avatar?: string;
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
 * Faceted browse preprint summary.
 *
 * @remarks
 * Matches the frontend PreprintSummary shape for compatibility with SearchResults component.
 *
 * @public
 * @since 0.1.0
 */
export interface FacetedPreprintSummary {
  readonly uri: AtUri;
  readonly cid: string;
  readonly title: string;
  readonly abstract: string;
  readonly author: FacetedAuthor;
  readonly fields?: readonly { uri: string; name: string; id?: string; parentUri?: string }[];
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
 * @public
 * @since 0.1.0
 */
export interface FacetedBrowseResponse {
  readonly preprints: readonly FacetedPreprintSummary[];
  readonly availableFacets: {
    readonly personality?: readonly FacetValue[];
    readonly matter?: readonly FacetValue[];
    readonly energy?: readonly FacetValue[];
    readonly space?: readonly FacetValue[];
    readonly time?: readonly FacetValue[];
  };
  readonly cursor?: string;
  readonly hasMore: boolean;
  readonly total: number;
}

/**
 * Faceted browse query.
 *
 * @remarks
 * Each facet dimension accepts an array of values for multi-select filtering,
 * following industry standard faceted search API design (Algolia, Azure AI Search).
 *
 * @public
 * @since 0.1.0
 */
export interface FacetedBrowseQuery {
  readonly facets: {
    readonly personality?: readonly string[];
    readonly matter?: readonly string[];
    readonly energy?: readonly string[];
    readonly space?: readonly string[];
    readonly time?: readonly string[];
  };
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
 * // Index field proposal from firehose
 * await service.indexFieldProposal(proposal, metadata);
 *
 * // Query graph
 * const field = await service.getField(fieldId);
 * const related = await service.getRelatedFields(fieldId, 2);
 * ```
 *
 * @public
 * @since 0.1.0
 */
export class KnowledgeGraphService {
  private readonly graph: IGraphDatabase;
  /**
   * Storage backend for preprint metadata queries in faceted browsing.
   * Used when browseFaceted is fully implemented.
   * @see browseFaceted method for usage context
   */
  private readonly _storage: IStorageBackend;
  private readonly logger: ILogger;

  constructor(options: KnowledgeGraphServiceOptions) {
    this.graph = options.graph;
    this._storage = options.storage;
    this.logger = options.logger;
  }

  /**
   * Indexes field proposal from firehose.
   *
   * @param record - Field proposal record
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexFieldProposal(
    record: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      // Extract field data from record
      const fieldRecord = record as {
        id?: string;
        label?: string;
        type?: 'field' | 'subfield' | 'topic';
        description?: string;
        wikidataId?: string;
      };

      if (fieldRecord.id && fieldRecord.label && fieldRecord.type) {
        await this.graph.upsertField({
          id: fieldRecord.id,
          label: fieldRecord.label,
          type: fieldRecord.type,
          description: fieldRecord.description,
          wikidataId: fieldRecord.wikidataId,
        });
      }

      this.logger.info('Indexed field proposal', { uri: metadata.uri });
      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error(
        'Failed to index field proposal',
        error instanceof Error ? error : undefined,
        {
          uri: metadata.uri,
        }
      );
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Indexes vote from firehose.
   *
   * @remarks
   * Records a community vote on a field proposal. Votes are weighted by user role
   * for consensus calculation:
   * - community-member: 1.0x
   * - trusted-editor: 2.0x
   * - authority-editor: 3.0x
   * - domain-expert: 3.0x
   * - administrator: 5.0x
   *
   * @param record - Vote record from user PDS
   * @param metadata - Record metadata including URI and PDS source
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexVote(record: unknown, metadata: RecordMetadata): Promise<Result<void, DatabaseError>> {
    // Extract vote data from record
    const voteRecord = record as {
      proposalUri?: string;
      vote?: 'approve' | 'reject' | 'abstain' | 'request-changes';
      rationale?: string;
      voterRole?: string;
    };

    // Validate required fields
    if (!voteRecord.proposalUri || !voteRecord.vote) {
      this.logger.warn('Invalid vote record: missing required fields', {
        uri: metadata.uri,
        hasProposalUri: !!voteRecord.proposalUri,
        hasVote: !!voteRecord.vote,
      });
      return { ok: true, value: undefined }; // Skip invalid records
    }

    try {
      // Extract voter DID from AT URI (format: at://did:plc:xxx/collection/rkey)
      const voterDid = metadata.uri.split('/')[2] as import('../../types/atproto.js').DID;

      // Persist to Neo4j
      await this.graph.createVote({
        uri: metadata.uri,
        proposalUri: voteRecord.proposalUri,
        voterDid,
        voterRole: (voteRecord.voterRole ?? 'community-member') as
          | 'community-member'
          | 'reviewer'
          | 'domain-expert'
          | 'administrator',
        vote: voteRecord.vote,
        rationale: voteRecord.rationale,
        createdAt: metadata.indexedAt,
      });

      this.logger.info('Indexed vote', {
        uri: metadata.uri,
        proposalUri: voteRecord.proposalUri,
        vote: voteRecord.vote,
        voterRole: voteRecord.voterRole ?? 'community-member',
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
   * Indexes authority record from Governance PDS.
   *
   * @param record - Authority record
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexAuthorityRecord(
    record: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError>> {
    try {
      const authorityRecord = record as {
        id?: string;
        authorizedHeading?: string;
        alternateHeadings?: readonly string[];
        scope?: string;
        source?: 'wikidata' | 'fast' | 'community';
        wikidataId?: string;
      };

      if (authorityRecord.id && authorityRecord.authorizedHeading) {
        await this.graph.createAuthorityRecord({
          id: authorityRecord.id,
          authorizedHeading: authorityRecord.authorizedHeading,
          alternateHeadings: authorityRecord.alternateHeadings ?? [],
          scope: authorityRecord.scope,
          source: authorityRecord.source ?? 'community',
          wikidataId: authorityRecord.wikidataId,
        });
      }

      this.logger.info('Indexed authority record', { uri: metadata.uri });
      return { ok: true, value: undefined };
    } catch (error) {
      this.logger.error(
        'Failed to index authority record',
        error instanceof Error ? error : undefined,
        {
          uri: metadata.uri,
        }
      );
      return {
        ok: false,
        error: new DatabaseError('WRITE', error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * Gets field node by ID.
   *
   * @param id - Field ID
   * @returns Field detail or null
   *
   * @public
   */
  async getField(id: string): Promise<FieldDetail | null> {
    try {
      // Query Neo4j for field by ID
      const fieldNode = await this.graph.getFieldById(id);

      if (!fieldNode) {
        return null;
      }

      return {
        id: fieldNode.id,
        uri: `at://chive.governance/pub.chive.graph.field/${fieldNode.id}`,
        name: fieldNode.label,
        description: fieldNode.description,
        parentId: undefined, // Would be derived from broader relationships
        status: 'approved',
        preprintCount: 0, // Would be computed from preprint-field associations
        externalIds: fieldNode.wikidataId
          ? [
              {
                source: 'wikidata',
                id: fieldNode.wikidataId,
                url: `https://www.wikidata.org/wiki/${fieldNode.wikidataId}`,
              },
            ]
          : undefined,
        createdAt: new Date(),
        updatedAt: undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get field', error instanceof Error ? error : undefined, { id });
      return null;
    }
  }

  /**
   * Gets related fields via graph traversal.
   *
   * @param fieldId - Field ID
   * @param maxDepth - Maximum traversal depth
   * @returns Related field relationships
   *
   * @public
   */
  async getRelatedFields(fieldId: string, maxDepth = 2): Promise<readonly FieldRelationship[]> {
    try {
      const relatedNodes = await this.graph.findRelatedFields(fieldId, maxDepth);

      return relatedNodes
        .filter((node) => node.id !== fieldId) // Exclude self
        .map((node) => ({
          type: 'related',
          targetId: node.id,
          targetName: node.label,
          strength: undefined,
        }));
    } catch (error) {
      this.logger.error(
        'Failed to get related fields',
        error instanceof Error ? error : undefined,
        {
          fieldId,
        }
      );
      return [];
    }
  }

  /**
   * Gets child fields of a parent field.
   *
   * @param fieldId - Parent field ID
   * @returns Child field summaries
   *
   * @public
   */
  async getChildFields(fieldId: string): Promise<readonly ChildField[]> {
    try {
      // Query for fields that have this field as their broader concept
      const relatedFields = await this.graph.findRelatedFields(fieldId, 1);

      // Filter to only narrower relationships (children)
      // In a full implementation, we'd query for specific relationship types
      return relatedFields
        .filter((node) => node.type === 'subfield' || node.type === 'topic')
        .map((node) => ({
          id: node.id,
          name: node.label,
          preprintCount: 0, // Would be computed from associations
        }));
    } catch (error) {
      this.logger.error('Failed to get child fields', error instanceof Error ? error : undefined, {
        fieldId,
      });
      return [];
    }
  }

  /**
   * Gets ancestor path from root to this field.
   *
   * @param fieldId - Field ID
   * @returns Ancestor fields ordered from root to parent
   *
   * @public
   */
  async getAncestorPath(fieldId: string): Promise<readonly AncestorField[]> {
    try {
      // Build ancestor path by traversing broader relationships
      const ancestors: AncestorField[] = [];
      let currentId = fieldId;
      const visited = new Set<string>();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);

        const relatedFields = await this.graph.findRelatedFields(currentId, 1);

        // Find broader (parent) field
        const parent = relatedFields.find((node) => node.id !== currentId && node.type === 'field');

        if (parent) {
          ancestors.unshift({
            id: parent.id,
            name: parent.label,
          });
          currentId = parent.id;
        } else {
          break;
        }
      }

      return ancestors;
    } catch (error) {
      this.logger.error('Failed to get ancestor path', error instanceof Error ? error : undefined, {
        fieldId,
      });
      return [];
    }
  }

  /**
   * Lists fields with optional filtering.
   *
   * @param options - List options (status, parentId, limit, cursor)
   * @returns Paginated list of fields
   *
   * @public
   */
  async listFields(options: {
    status?: 'proposed' | 'under_review' | 'approved' | 'deprecated';
    parentId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    fields: FieldDetail[];
    total: number;
    hasMore: boolean;
    cursor?: string;
  }> {
    try {
      const result = await this.graph.listFields(options);

      const fields: FieldDetail[] = result.fields.map((f) => ({
        id: f.id,
        uri: `at://chive.governance/pub.chive.graph.field/${f.id}`,
        name: f.label,
        description: f.description,
        parentId: undefined,
        status: 'approved',
        preprintCount: 0,
        externalIds: f.wikidataId
          ? [
              {
                source: 'wikidata',
                id: f.wikidataId,
                url: `https://www.wikidata.org/wiki/${f.wikidataId}`,
              },
            ]
          : undefined,
        createdAt: new Date(),
        updatedAt: undefined,
      }));

      return {
        fields,
        total: result.total,
        hasMore: result.hasMore,
        cursor: result.cursor,
      };
    } catch (error) {
      this.logger.error('Failed to list fields', error instanceof Error ? error : undefined, {
        options,
      });
      return { fields: [], total: 0, hasMore: false };
    }
  }

  /**
   * Searches authority records.
   *
   * @remarks
   * Queries Neo4j for authority records matching the query text.
   * Supports filtering by type (person, organization, concept, place) and status.
   * Uses cursor-based pagination with offset encoding.
   *
   * @param query - Search query with optional filters
   * @returns Paginated authority search results
   *
   * @public
   */
  async searchAuthorities(query: AuthoritySearchQuery): Promise<AuthoritySearchResponse> {
    try {
      const limit = query.limit ?? 20;
      const offset = query.cursor ? parseInt(query.cursor, 10) : 0;

      // If no query text provided, return empty results
      if (!query.query || query.query.trim() === '') {
        return {
          authorities: [],
          cursor: undefined,
          hasMore: false,
          total: 0,
        };
      }

      this.logger.debug('Searching authorities', {
        query: query.query,
        type: query.type,
        status: query.status,
        limit,
        offset,
      });

      // Query Neo4j using the graph adapter
      const result = await this.graph.searchAuthorityRecords(query.query, {
        type: query.type,
        status: query.status,
        limit,
        offset,
      });

      // Map authority records to search results
      const authorities: AuthoritySearchResult[] = result.records.map((record) => ({
        id: record.id,
        uri: `at://chive.governance/pub.chive.graph.authorityRecord/${record.id}` as const,
        name: record.authorizedHeading,
        type: 'concept', // Default type; would be stored in record in production
        alternateNames: record.alternateHeadings,
        description: record.scope,
        externalIds: record.wikidataId
          ? [
              {
                source: 'wikidata' as const,
                id: record.wikidataId,
                url: `https://www.wikidata.org/wiki/${record.wikidataId}`,
              },
            ]
          : undefined,
        status: 'approved' as const, // Would be stored in record
        createdAt: new Date(),
      }));

      const nextCursor = result.hasMore ? String(offset + limit) : undefined;

      return {
        authorities,
        cursor: nextCursor,
        hasMore: result.hasMore,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(
        'Failed to search authorities',
        error instanceof Error ? error : undefined,
        {
          query: query.query,
        }
      );
      return {
        authorities: [],
        cursor: undefined,
        hasMore: false,
        total: 0,
      };
    }
  }

  /**
   * Browses preprints using faceted classification.
   *
   * @remarks
   * Queries Neo4j for preprints matching PMEST facets and enriches with
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
   * @returns Matching preprints with available facet refinements
   *
   * @public
   */
  async browseFaceted(query: FacetedBrowseQuery): Promise<FacetedBrowseResponse> {
    try {
      const limit = query.limit ?? 20;
      const offset = query.cursor ? parseInt(query.cursor, 10) : 0;

      // Build facet filter from PMEST dimensions
      // Each dimension can have multiple values for OR-style filtering within the dimension
      const facets: Facet[] = [];

      if (query.facets.personality && query.facets.personality.length > 0) {
        for (const value of query.facets.personality) {
          facets.push({ dimension: 'personality', value });
        }
      }
      if (query.facets.matter && query.facets.matter.length > 0) {
        for (const value of query.facets.matter) {
          facets.push({ dimension: 'matter', value });
        }
      }
      if (query.facets.energy && query.facets.energy.length > 0) {
        for (const value of query.facets.energy) {
          facets.push({ dimension: 'energy', value });
        }
      }
      if (query.facets.space && query.facets.space.length > 0) {
        for (const value of query.facets.space) {
          facets.push({ dimension: 'space', value });
        }
      }
      if (query.facets.time && query.facets.time.length > 0) {
        for (const value of query.facets.time) {
          facets.push({ dimension: 'time', value });
        }
      }

      this.logger.info('Browsing faceted', { facets, limit, offset });

      // Query preprint URIs; if no facets specified, get all preprints.
      let matchingPreprintUris: readonly string[];
      if (facets.length === 0) {
        // No facets: return all preprints from storage (paginated)
        this.logger.info('No facets specified, listing all preprints from storage');
        matchingPreprintUris = await this._storage.listPreprintUris({ limit: 1000 });
        this.logger.info('Storage returned URIs', { uris: matchingPreprintUris });
      } else {
        // Facets specified: filter by facets in graph
        matchingPreprintUris = await this.graph.queryByFacets(facets);
      }

      this.logger.info('Found matching preprints', {
        count: matchingPreprintUris.length,
        hasFacets: facets.length > 0,
      });

      // Apply pagination to URIs
      const paginatedUris = matchingPreprintUris.slice(offset, offset + limit + 1);
      const hasMore = paginatedUris.length > limit;
      if (hasMore) {
        paginatedUris.pop();
      }

      // Fetch preprint metadata from storage
      const preprints: FacetedPreprintSummary[] = [];
      for (const uri of paginatedUris) {
        const preprint = await this._storage.getPreprint(uri as AtUri);
        if (preprint) {
          // Build record URL from AT URI
          const recordUrl = `${preprint.pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${preprint.author}&collection=pub.chive.preprint.submission&rkey=${(preprint.uri as string).split('/').pop()}`;

          preprints.push({
            uri: preprint.uri,
            cid: preprint.cid,
            title: preprint.title,
            abstract: preprint.abstract,
            author: {
              did: preprint.author,
              // handle and displayName would be resolved from profile service
              // For now, we omit them and let the frontend handle missing values
            },
            license: preprint.license ?? 'CC-BY-4.0',
            createdAt: preprint.createdAt,
            indexedAt: preprint.indexedAt,
            source: {
              pdsEndpoint: preprint.pdsUrl,
              recordUrl,
              stale: false, // Could be computed from lastVerifiedAt
            },
          });
        }
      }

      // Aggregate available facet refinements
      const availableFacets = await this.graph.aggregateFacetRefinements(facets);

      // Convert to FacetValue format
      const formatFacets = (
        values?: readonly { value: string; count: number }[]
      ): FacetValue[] | undefined => {
        if (!values || values.length === 0) return undefined;
        return values.map((v) => ({
          value: v.value,
          label: v.value, // Label same as value; could be enriched from authority records
          count: v.count,
        }));
      };

      const nextCursor = hasMore ? String(offset + limit) : undefined;

      return {
        preprints,
        availableFacets: {
          personality: formatFacets(availableFacets.personality),
          matter: formatFacets(availableFacets.matter),
          energy: formatFacets(availableFacets.energy),
          space: formatFacets(availableFacets.space),
          time: formatFacets(availableFacets.time),
        },
        cursor: nextCursor,
        hasMore,
        total: matchingPreprintUris.length,
      };
    } catch (error) {
      this.logger.error('Failed to browse faceted', error instanceof Error ? error : undefined, {
        facets: query.facets,
      });
      return {
        preprints: [],
        availableFacets: {
          personality: undefined,
          matter: undefined,
          energy: undefined,
          space: undefined,
          time: undefined,
        },
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
    type?: 'create' | 'update' | 'merge' | 'delete';
    fieldId?: string;
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

      const result = await this.graph.getProposals({
        status: options.status ? [options.status] : undefined,
        proposalType: options.type ? [options.type] : undefined,
        fieldUri: options.fieldId,
        proposerDid: options.proposedBy as DID | undefined,
        limit,
        offset,
      });

      const proposals: ProposalView[] = result.proposals.map((p) => ({
        id: p.id,
        uri: `at://chive.governance/pub.chive.graph.fieldProposal/${p.id}`,
        fieldId: p.fieldId,
        type: p.proposalType,
        changes: p.changes as Record<string, unknown>,
        rationale: p.rationale,
        status: p.status,
        proposedBy: p.proposedBy,
        votes: {
          approve: p.votes.approve,
          reject: p.votes.reject,
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
      const proposal = await this.graph.getProposalById(proposalId);

      if (!proposal) {
        return null;
      }

      return {
        id: proposal.id,
        uri: `at://chive.governance/pub.chive.graph.fieldProposal/${proposal.id}`,
        fieldId: proposal.fieldId,
        type: proposal.proposalType,
        changes: proposal.changes as Record<string, unknown>,
        rationale: proposal.rationale,
        status: proposal.status,
        proposedBy: proposal.proposedBy,
        votes: {
          approve: proposal.votes.approve,
          reject: proposal.votes.reject,
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
      const votes = await this.graph.getVotesForProposal(proposalUri);

      return votes.map((v) => ({
        id: v.uri.split('/').pop() ?? '',
        uri: v.uri,
        proposalUri: v.proposalUri,
        voterDid: v.voterDid,
        voterRole: v.voterRole,
        vote: v.vote,
        weight: this.getVoteWeight(v.voterRole),
        rationale: v.rationale,
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
   *
   * @internal
   */
  private getVoteWeight(role: string): number {
    switch (role) {
      case 'administrator':
        return 5.0;
      case 'domain-expert':
        return 3.0;
      case 'reviewer':
        return 2.0;
      case 'community-member':
      default:
        return 1.0;
    }
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
  readonly fieldId: string;
  readonly type: 'create' | 'update' | 'merge' | 'delete';
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
