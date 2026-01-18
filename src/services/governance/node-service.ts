/**
 * Node service for managing unified knowledge graph nodes.
 *
 * @remarks
 * Provides high-level operations for nodes in the knowledge graph.
 * All entities (types, objects, fields, facets, institutions, etc.)
 * are represented as unified nodes with kind + subkind classification.
 *
 * **ATProto Compliance**:
 * - Neo4j is an index, not source of truth
 * - Nodes in Governance PDS are authoritative
 * - This service coordinates indexing from PDS to Neo4j
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';
import { singleton } from 'tsyringe';

import type { NodeRepository } from '../../storage/neo4j/node-repository.js';
import type {
  GraphNode,
  NodeKind,
  NodeStatus,
  NodeSearchResult,
  NodeHierarchy,
  ExternalId,
  NodeMetadata,
} from '../../storage/neo4j/types.js';
import type { AtUri, DID } from '../../types/atproto.js';
import { NotFoundError, ValidationError } from '../../types/errors.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Node suggestion for API responses.
 */
export interface NodeSuggestion {
  id: string;
  uri: AtUri;
  label: string;
  description?: string;
  kind: NodeKind;
  subkind?: string;
  externalIds?: ExternalId[];
}

/**
 * Node service options.
 */
export interface NodeServiceOptions {
  readonly nodeRepository: NodeRepository;
  readonly logger: ILogger;
  readonly cache?: Redis;
  readonly cacheTtlSeconds?: number;
}

/**
 * Node index input from PDS record.
 */
export interface NodeIndexInput {
  id: string;
  uri: AtUri;
  kind: NodeKind;
  subkind?: string;
  subkindUri?: AtUri;
  label: string;
  alternateLabels?: string[];
  description?: string;
  externalIds?: ExternalId[];
  metadata?: NodeMetadata;
  status: NodeStatus;
  deprecatedBy?: AtUri;
  proposalUri?: AtUri;
  createdBy?: DID;
}

/**
 * Node service for unified knowledge graph management.
 *
 * @example
 * ```typescript
 * const service = new NodeService({
 *   nodeRepository,
 *   logger,
 *   cache: redis,
 * });
 *
 * // Search nodes by subkind
 * const results = await service.searchNodes('machine learning', { subkind: 'field' });
 *
 * // Get node hierarchy
 * const hierarchy = await service.getNodeHierarchy('field', 'broader');
 * ```
 *
 * @public
 */
@singleton()
export class NodeService {
  private readonly nodeRepository: NodeRepository;
  private readonly logger: ILogger;
  private readonly cache?: Redis;
  private readonly cacheTtlSeconds: number;

  constructor(options: NodeServiceOptions) {
    this.nodeRepository = options.nodeRepository;
    this.logger = options.logger;
    this.cache = options.cache;
    this.cacheTtlSeconds = options.cacheTtlSeconds ?? 3600;
  }

  /**
   * Index a node from Governance PDS.
   *
   * @param input - Node data from PDS record
   * @returns AT-URI of indexed node
   */
  async indexNode(input: NodeIndexInput): Promise<AtUri> {
    this.logger.debug('Indexing node from PDS', { id: input.id, uri: input.uri });

    try {
      const existing = await this.nodeRepository.getNode(input.uri);

      if (existing) {
        await this.nodeRepository.updateNode(input.uri, {
          label: input.label,
          alternateLabels: input.alternateLabels,
          description: input.description,
          externalIds: input.externalIds,
          metadata: input.metadata,
          status: input.status,
          deprecatedBy: input.deprecatedBy,
        });

        await this.invalidateNodeCache(input.uri);
        this.logger.info('Updated existing node in index', { uri: input.uri });
        return input.uri;
      }

      const uri = await this.nodeRepository.createNode({
        id: input.id,
        uri: input.uri,
        kind: input.kind,
        subkind: input.subkind,
        subkindUri: input.subkindUri,
        label: input.label,
        alternateLabels: input.alternateLabels,
        description: input.description,
        externalIds: input.externalIds,
        metadata: input.metadata,
        status: input.status,
        deprecatedBy: input.deprecatedBy,
        proposalUri: input.proposalUri,
        createdBy: input.createdBy,
      });

      this.logger.info('Indexed new node', { uri, id: input.id, subkind: input.subkind });
      return uri;
    } catch (error) {
      this.logger.error('Failed to index node', error instanceof Error ? error : undefined, {
        id: input.id,
        uri: input.uri,
      });
      throw error;
    }
  }

  /**
   * Get a node by URI.
   */
  async getNode(uri: AtUri): Promise<GraphNode | null> {
    if (this.cache) {
      const cached = await this.cache.get(this.cacheKey(uri));
      if (cached) {
        this.logger.debug('Cache hit for node', { uri });
        return JSON.parse(cached) as GraphNode;
      }
    }

    const node = await this.nodeRepository.getNode(uri);

    if (node && this.cache) {
      await this.cache.setex(this.cacheKey(uri), this.cacheTtlSeconds, JSON.stringify(node));
    }

    return node;
  }

  /**
   * Get a node by ID.
   */
  async getNodeById(id: string): Promise<GraphNode | null> {
    return this.nodeRepository.getNodeById(id);
  }

  /**
   * Search nodes by text.
   */
  async searchNodes(
    query: string,
    options?: {
      kind?: NodeKind;
      subkind?: string;
      status?: NodeStatus;
      limit?: number;
      cursor?: string;
    }
  ): Promise<NodeSearchResult> {
    this.logger.debug('Searching nodes', { query, ...options });

    const result = await this.nodeRepository.searchNodes(query, {
      kind: options?.kind,
      subkind: options?.subkind,
      status: options?.status,
      limit: options?.limit ?? 20,
      cursor: options?.cursor,
    });

    this.logger.debug('Node search completed', {
      query,
      resultCount: result.total,
    });

    return result;
  }

  /**
   * List nodes by kind and/or subkind.
   */
  async listNodes(options?: {
    kind?: NodeKind;
    subkind?: string;
    status?: NodeStatus;
    limit?: number;
    cursor?: string;
  }): Promise<NodeSearchResult> {
    return this.nodeRepository.listNodes(options);
  }

  /**
   * Get nodes connected to a given node via a specific relation.
   */
  async getConnectedNodes(
    nodeUri: AtUri,
    relationSlug: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): Promise<GraphNode[]> {
    return this.nodeRepository.getConnectedNodes(nodeUri, relationSlug, direction);
  }

  /**
   * Get hierarchy for nodes of a specific subkind.
   */
  async getHierarchy(subkind: string, rootUri?: AtUri, maxDepth = 10): Promise<NodeHierarchy[]> {
    return this.nodeRepository.getHierarchy(subkind, rootUri, maxDepth);
  }

  /**
   * Get available subkinds (type nodes with subkind=subkind).
   */
  async getSubkinds(): Promise<GraphNode[]> {
    return this.nodeRepository.getSubkinds();
  }

  /**
   * Get node suggestions for autocomplete.
   */
  async getNodeSuggestions(query: string, subkind?: string, limit = 10): Promise<NodeSuggestion[]> {
    const result = await this.searchNodes(query, { subkind, limit });

    return result.nodes.map((node) => ({
      id: node.id,
      uri: node.uri,
      label: node.label,
      description: node.description,
      kind: node.kind,
      subkind: node.subkind,
      externalIds: node.externalIds,
    }));
  }

  /**
   * Deprecate a node.
   */
  async deprecateNode(uri: AtUri, replacementUri?: AtUri): Promise<void> {
    const node = await this.nodeRepository.getNode(uri);
    if (!node) {
      throw new NotFoundError('Node', uri);
    }

    if (replacementUri) {
      const replacement = await this.nodeRepository.getNode(replacementUri);
      if (!replacement) {
        throw new ValidationError(
          `Replacement node ${replacementUri} not found`,
          'replacementUri',
          'not-found'
        );
      }
    }

    await this.nodeRepository.updateNode(uri, {
      status: 'deprecated',
      deprecatedBy: replacementUri,
    });

    await this.invalidateNodeCache(uri);
    this.logger.info('Deprecated node', { uri, replacementUri });
  }

  /**
   * Delete a node from the index.
   */
  async deleteNode(uri: AtUri): Promise<void> {
    await this.nodeRepository.deleteNode(uri);
    await this.invalidateNodeCache(uri);
    this.logger.info('Deleted node from index', { uri });
  }

  private async invalidateNodeCache(uri: AtUri): Promise<void> {
    if (!this.cache) {
      return;
    }

    await this.cache.del(this.cacheKey(uri));
    this.logger.debug('Invalidated node cache', { uri });
  }

  private cacheKey(uri: AtUri): string {
    return `chive:node:${uri}`;
  }
}
