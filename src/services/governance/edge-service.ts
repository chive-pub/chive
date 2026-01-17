/**
 * Edge service for managing typed relationships between nodes.
 *
 * @remarks
 * Provides high-level operations for edges in the knowledge graph.
 * Relation types are themselves nodes with subkind=relation.
 *
 * **ATProto Compliance**:
 * - Neo4j is an index, not source of truth
 * - Edges in Governance PDS are authoritative
 * - This service coordinates indexing from PDS to Neo4j
 *
 * @packageDocumentation
 * @public
 */

import { singleton } from 'tsyringe';

import type { EdgeRepository } from '../../storage/neo4j/edge-repository.js';
import type {
  GraphEdge,
  EdgeStatus,
  EdgeSearchResult,
  EdgeMetadata,
} from '../../storage/neo4j/types.js';
import type { AtUri, DID } from '../../types/atproto.js';
import { NotFoundError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Edge service options.
 */
export interface EdgeServiceOptions {
  readonly edgeRepository: EdgeRepository;
  readonly logger: ILogger;
}

/**
 * Edge index input from PDS record.
 */
export interface EdgeIndexInput {
  id: string;
  uri: AtUri;
  sourceUri: AtUri;
  targetUri: AtUri;
  relationUri?: AtUri;
  relationSlug: string;
  weight?: number;
  metadata?: EdgeMetadata;
  status: EdgeStatus;
  proposalUri?: AtUri;
  createdBy?: DID;
}

/**
 * Edge service for knowledge graph relationships.
 *
 * @example
 * ```typescript
 * const service = new EdgeService({
 *   edgeRepository,
 *   logger,
 *   cache: redis,
 * });
 *
 * // Get edges from a node
 * const edges = await service.listEdges({ sourceUri });
 *
 * // Get relation types
 * const relations = await service.getRelationTypes();
 * ```
 *
 * @public
 */
@singleton()
export class EdgeService {
  private readonly edgeRepository: EdgeRepository;
  private readonly logger: ILogger;

  constructor(options: EdgeServiceOptions) {
    this.edgeRepository = options.edgeRepository;
    this.logger = options.logger;
  }

  /**
   * Index an edge from Governance PDS.
   */
  async indexEdge(input: EdgeIndexInput): Promise<AtUri> {
    this.logger.debug('Indexing edge from PDS', { id: input.id, uri: input.uri });

    try {
      const existing = await this.edgeRepository.getEdge(input.uri);

      if (existing) {
        await this.edgeRepository.updateEdge(input.uri, {
          relationUri: input.relationUri,
          relationSlug: input.relationSlug,
          weight: input.weight,
          metadata: input.metadata,
          status: input.status,
        });

        this.logger.info('Updated existing edge in index', { uri: input.uri });
        return input.uri;
      }

      const uri = await this.edgeRepository.createEdge({
        id: input.id,
        uri: input.uri,
        sourceUri: input.sourceUri,
        targetUri: input.targetUri,
        relationUri: input.relationUri,
        relationSlug: input.relationSlug,
        weight: input.weight,
        metadata: input.metadata,
        status: input.status,
        proposalUri: input.proposalUri,
        createdBy: input.createdBy,
      });

      this.logger.info('Indexed new edge', { uri, id: input.id, relationSlug: input.relationSlug });
      return uri;
    } catch (error) {
      this.logger.error('Failed to index edge', error instanceof Error ? error : undefined, {
        id: input.id,
        uri: input.uri,
      });
      throw error;
    }
  }

  /**
   * Get an edge by URI.
   */
  async getEdge(uri: AtUri): Promise<GraphEdge | null> {
    return this.edgeRepository.getEdge(uri);
  }

  /**
   * Get an edge by ID.
   */
  async getEdgeById(id: string): Promise<GraphEdge | null> {
    return this.edgeRepository.getEdgeById(id);
  }

  /**
   * List edges with filtering.
   */
  async listEdges(options?: {
    sourceUri?: AtUri;
    targetUri?: AtUri;
    relationSlug?: string;
    status?: EdgeStatus;
    limit?: number;
    cursor?: string;
  }): Promise<EdgeSearchResult> {
    return this.edgeRepository.listEdges(options);
  }

  /**
   * Get all edges between two nodes.
   */
  async getEdgesBetween(sourceUri: AtUri, targetUri: AtUri): Promise<GraphEdge[]> {
    return this.edgeRepository.getEdgesBetween(sourceUri, targetUri);
  }

  /**
   * Check if an edge exists.
   */
  async edgeExists(sourceUri: AtUri, targetUri: AtUri, relationSlug: string): Promise<boolean> {
    return this.edgeRepository.edgeExists(sourceUri, targetUri, relationSlug);
  }

  /**
   * Get available relation types (nodes with subkind=relation).
   */
  async getRelationTypes(): Promise<
    { slug: string; label: string; description?: string; inverseSlug?: string }[]
  > {
    return this.edgeRepository.getRelationTypes();
  }

  /**
   * Deprecate an edge.
   */
  async deprecateEdge(uri: AtUri): Promise<void> {
    const edge = await this.edgeRepository.getEdge(uri);
    if (!edge) {
      throw new NotFoundError('Edge', uri);
    }

    await this.edgeRepository.updateEdge(uri, { status: 'deprecated' });
    this.logger.info('Deprecated edge', { uri });
  }

  /**
   * Delete an edge from the index.
   */
  async deleteEdge(uri: AtUri): Promise<void> {
    await this.edgeRepository.deleteEdge(uri);
    this.logger.info('Deleted edge from index', { uri });
  }
}
