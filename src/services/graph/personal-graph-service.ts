/**
 * Personal graph service for user-owned nodes and edges.
 *
 * @remarks
 * Indexes personal graph nodes and edges from the firehose. Personal nodes
 * are user-created entities (e.g., reading lists, custom categories) that
 * live in user PDSes, distinct from governance-managed knowledge graph nodes.
 *
 * **ATProto Compliance:**
 * - Read-only indexing from firehose events
 * - Never writes to user PDSes
 * - Tracks PDS source for staleness detection
 * - All indexes rebuildable from firehose
 *
 * @packageDocumentation
 * @public
 */

import type { Pool } from 'pg';

import type { Main as EdgeRecord } from '../../lexicons/generated/types/pub/chive/graph/edge.js';
import type { Main as NodeRecord } from '../../lexicons/generated/types/pub/chive/graph/node.js';
import type { NodeMetadata } from '../../storage/neo4j/types.js';
import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError, ValidationError } from '../../types/errors.js';
import type { GraphNode } from '../../types/interfaces/graph.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import { Err, Ok, type Result } from '../../types/result.js';
import type { RecordMetadata } from '../eprint/eprint-service.js';

/**
 * Extracts DID from an AT URI.
 *
 * @param uri - AT URI in format at://did:xxx/collection/rkey
 * @returns DID portion of the URI
 *
 * @internal
 */
function extractDidFromUri(uri: AtUri): DID {
  const parts = (uri as string).split('/');
  return parts[2] as DID;
}

/**
 * A node in a subgraph expansion result.
 *
 * @public
 */
export interface SubgraphNode {
  readonly uri: string;
  readonly label: string;
  readonly kind: string;
  readonly subkind?: string;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * An edge in a subgraph expansion result.
 *
 * @public
 */
export interface SubgraphEdge {
  readonly uri: string;
  readonly sourceUri: string;
  readonly targetUri: string;
  readonly relationSlug: string;
  readonly label?: string;
  readonly weight?: number;
}

/**
 * Result of a BFS subgraph expansion.
 *
 * @public
 */
export interface ExpandSubgraphResult {
  readonly nodes: SubgraphNode[];
  readonly edges: SubgraphEdge[];
  readonly truncated: boolean;
}

/**
 * Options for BFS subgraph expansion.
 *
 * @public
 */
export interface ExpandSubgraphOptions {
  readonly depth?: number;
  readonly edgeTypes?: string[];
  readonly maxNodes?: number;
}

/**
 * Personal graph service configuration.
 *
 * @public
 */
export interface PersonalGraphServiceOptions {
  readonly pool: Pool;
  readonly logger: ILogger;
}

/**
 * Personal graph service for indexing user-owned graph nodes and edges.
 *
 * @example
 * ```typescript
 * const service = new PersonalGraphService({ pool, logger });
 *
 * // Index node from firehose
 * await service.indexNode(nodeRecord, metadata);
 *
 * // Search user's personal nodes
 * const nodes = await service.searchPersonalNodes(did, 'reading list');
 * ```
 *
 * @public
 */
export class PersonalGraphService {
  private readonly pool: Pool;
  private readonly logger: ILogger;

  constructor(options: PersonalGraphServiceOptions) {
    this.pool = options.pool;
    this.logger = options.logger;
  }

  /**
   * Indexes a personal graph node from the firehose.
   *
   * @param nodeRecord - Node record from user PDS
   * @param metadata - Record metadata including URI, CID, and PDS source
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexNode(
    nodeRecord: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    const record = nodeRecord as NodeRecord;

    if (!record.label || !record.kind) {
      const validationError = new ValidationError(
        'Personal graph node requires label and kind',
        'record',
        'schema'
      );
      this.logger.warn('Invalid personal graph node record', { uri: metadata.uri });
      return Err(validationError);
    }

    try {
      const ownerDid = extractDidFromUri(metadata.uri);

      await this.pool.query(
        `INSERT INTO personal_graph_nodes_index (
          uri, cid, owner_did, node_id, kind, subkind, label,
          alternate_labels, description, status, metadata,
          created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          label = EXCLUDED.label,
          alternate_labels = EXCLUDED.alternate_labels,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          updated_at = NOW(),
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          ownerDid,
          record.id,
          record.kind,
          record.subkind ?? null,
          record.label,
          record.alternateLabels ? JSON.stringify(record.alternateLabels) : null,
          record.description ?? null,
          record.status ?? 'established',
          record.metadata ? JSON.stringify(record.metadata) : '{}',
          record.createdAt ? new Date(record.createdAt) : metadata.indexedAt,
          metadata.pdsUrl,
        ]
      );

      this.logger.info('Indexed personal graph node', {
        uri: metadata.uri,
        ownerDid,
        kind: record.kind,
        subkind: record.subkind,
        label: record.label,
      });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index personal graph node: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index personal graph node', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Indexes a personal graph edge from the firehose.
   *
   * @param edgeRecord - Edge record from user PDS
   * @param metadata - Record metadata including URI, CID, and PDS source
   * @returns Result indicating success or failure
   *
   * @public
   */
  async indexEdge(
    edgeRecord: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    const record = edgeRecord as EdgeRecord;

    if (!record.sourceUri || !record.targetUri || !record.relationSlug) {
      const validationError = new ValidationError(
        'Personal graph edge requires sourceUri, targetUri, and relationSlug',
        'record',
        'schema'
      );
      this.logger.warn('Invalid personal graph edge record', { uri: metadata.uri });
      return Err(validationError);
    }

    try {
      const ownerDid = extractDidFromUri(metadata.uri);

      await this.pool.query(
        `INSERT INTO personal_graph_edges_index (
          uri, cid, owner_did, edge_id, source_uri, target_uri,
          relation_slug, weight, status,
          created_at, pds_url, indexed_at, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT (uri) DO UPDATE SET
          cid = EXCLUDED.cid,
          relation_slug = EXCLUDED.relation_slug,
          weight = EXCLUDED.weight,
          status = EXCLUDED.status,
          updated_at = NOW(),
          last_synced_at = NOW()`,
        [
          metadata.uri,
          metadata.cid,
          ownerDid,
          record.id,
          record.sourceUri,
          record.targetUri,
          record.relationSlug,
          record.weight ?? null,
          record.status ?? 'established',
          record.createdAt ? new Date(record.createdAt) : metadata.indexedAt,
          metadata.pdsUrl,
        ]
      );

      this.logger.info('Indexed personal graph edge', {
        uri: metadata.uri,
        ownerDid,
        sourceUri: record.sourceUri,
        targetUri: record.targetUri,
        relationSlug: record.relationSlug,
      });

      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'WRITE',
        `Failed to index personal graph edge: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to index personal graph edge', dbError, { uri: metadata.uri });
      return Err(dbError);
    }
  }

  /**
   * Updates an existing personal graph node in the index.
   *
   * @param uri - AT URI of the node to update
   * @param nodeRecord - Updated node record from user PDS
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async updateNode(
    uri: AtUri,
    nodeRecord: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    return this.indexNode(nodeRecord, { ...metadata, uri });
  }

  /**
   * Updates an existing personal graph edge in the index.
   *
   * @param uri - AT URI of the edge to update
   * @param edgeRecord - Updated edge record from user PDS
   * @param metadata - Record metadata
   * @returns Result indicating success or failure
   *
   * @public
   */
  async updateEdge(
    uri: AtUri,
    edgeRecord: unknown,
    metadata: RecordMetadata
  ): Promise<Result<void, DatabaseError | ValidationError>> {
    return this.indexEdge(edgeRecord, { ...metadata, uri });
  }

  /**
   * Deletes a personal graph node from the index.
   *
   * @param uri - AT URI of the node to delete
   * @returns Result indicating success or failure
   *
   * @public
   */
  async deleteNode(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query('DELETE FROM personal_graph_nodes_index WHERE uri = $1', [uri]);

      this.logger.info('Deleted personal graph node', { uri });
      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'DELETE',
        `Failed to delete personal graph node: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to delete personal graph node', dbError, { uri });
      return Err(dbError);
    }
  }

  /**
   * Deletes a personal graph edge from the index.
   *
   * @param uri - AT URI of the edge to delete
   * @returns Result indicating success or failure
   *
   * @public
   */
  async deleteEdge(uri: AtUri): Promise<Result<void, DatabaseError>> {
    try {
      await this.pool.query('DELETE FROM personal_graph_edges_index WHERE uri = $1', [uri]);

      this.logger.info('Deleted personal graph edge', { uri });
      return Ok(undefined);
    } catch (error) {
      const dbError = new DatabaseError(
        'DELETE',
        `Failed to delete personal graph edge: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to delete personal graph edge', dbError, { uri });
      return Err(dbError);
    }
  }

  /**
   * Lists distinct node types (subkinds) for a user's personal graph.
   *
   * @param did - DID of the user
   * @returns Array of distinct subkind strings
   *
   * @public
   */
  async listPersonalNodeTypes(did: DID): Promise<string[]> {
    try {
      const result = await this.pool.query<{ subkind: string }>(
        `SELECT DISTINCT subkind
         FROM personal_graph_nodes_index
         WHERE owner_did = $1
           AND subkind IS NOT NULL
         ORDER BY subkind ASC`,
        [did]
      );

      return result.rows.map((row) => row.subkind);
    } catch (error) {
      this.logger.error(
        'Failed to list personal node types',
        error instanceof Error ? error : undefined,
        { did }
      );
      return [];
    }
  }

  /**
   * Lists distinct relation types used in a user's personal graph edges.
   *
   * @param did - DID of the user
   * @returns Array of distinct relation slug strings
   *
   * @public
   */
  async listPersonalRelationTypes(did: DID): Promise<string[]> {
    try {
      const result = await this.pool.query<{ relation_slug: string }>(
        `SELECT DISTINCT relation_slug
         FROM personal_graph_edges_index
         WHERE owner_did = $1
         ORDER BY relation_slug ASC`,
        [did]
      );

      return result.rows.map((row) => row.relation_slug);
    } catch (error) {
      this.logger.error(
        'Failed to list personal relation types',
        error instanceof Error ? error : undefined,
        { did }
      );
      return [];
    }
  }

  /**
   * Searches personal graph nodes for a user by text query.
   *
   * @param did - DID of the user
   * @param query - Text search query matched against label and description
   * @param options - Optional filtering by subkind and result limit
   * @returns Matching graph node summaries
   *
   * @public
   */
  async searchPersonalNodes(
    did: DID,
    query: string,
    options?: { subkind?: string; limit?: number }
  ): Promise<GraphNode[]> {
    const limit = Math.min(options?.limit ?? 50, 100);

    try {
      let sql = `SELECT uri, node_id, kind, subkind, label,
                        alternate_labels, description, status, metadata, created_at
                 FROM personal_graph_nodes_index
                 WHERE owner_did = $1
                   AND (label ILIKE $2 OR description ILIKE $2)`;
      const params: unknown[] = [did, `%${query}%`];

      if (options?.subkind) {
        sql += ` AND subkind = $3`;
        params.push(options.subkind);
      }

      sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await this.pool.query<{
        uri: string;
        node_id: string;
        kind: string;
        subkind: string | null;
        label: string;
        alternate_labels: string | null;
        description: string | null;
        status: string;
        metadata: Record<string, unknown> | string | null;
        created_at: Date;
      }>(sql, params);

      return result.rows.map((row) => this.rowToGraphNode(row));
    } catch (error) {
      this.logger.error(
        'Failed to search personal nodes',
        error instanceof Error ? error : undefined,
        { did, query }
      );
      return [];
    }
  }

  /**
   * Expands a subgraph from root URIs using breadth-first search.
   *
   * Traverses edges in both `personal_graph_edges_index` and
   * `collection_edges_index`, deduplicating by URI. Fetches node
   * metadata from `personal_graph_nodes_index` for discovered URIs.
   *
   * @param rootUris - Starting node URIs for BFS expansion
   * @param options - BFS depth, edge type filter, and max node cap
   * @returns Result containing discovered nodes, edges, and truncation flag
   *
   * @public
   */
  async expandSubgraph(
    rootUris: string[],
    options?: ExpandSubgraphOptions
  ): Promise<Result<ExpandSubgraphResult, DatabaseError>> {
    const maxDepth = Math.min(Math.max(options?.depth ?? 2, 1), 5);
    const maxNodes = Math.min(Math.max(options?.maxNodes ?? 100, 1), 200);
    const edgeTypes = options?.edgeTypes;

    try {
      const visited = new Set<string>(rootUris);
      let frontier = [...rootUris];
      const allEdges = new Map<string, SubgraphEdge>();
      let truncated = false;

      for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
        const edges = await this.fetchEdgesForUris(frontier, edgeTypes);

        const nextFrontier: string[] = [];

        for (const edge of edges) {
          allEdges.set(edge.uri, edge);

          for (const endpoint of [edge.sourceUri, edge.targetUri]) {
            if (!visited.has(endpoint)) {
              if (visited.size >= maxNodes) {
                truncated = true;
                break;
              }
              visited.add(endpoint);
              nextFrontier.push(endpoint);
            }
          }

          if (truncated) break;
        }

        if (truncated) break;
        frontier = nextFrontier;
      }

      const allUris = [...visited];
      const nodes = await this.fetchNodesForUris(allUris);

      return Ok({
        nodes,
        edges: [...allEdges.values()],
        truncated,
      });
    } catch (error) {
      const dbError = new DatabaseError(
        'READ',
        `Failed to expand subgraph: ${error instanceof Error ? error.message : String(error)}`
      );
      this.logger.error('Failed to expand subgraph', dbError, {
        rootUris,
        maxDepth,
        maxNodes,
      });
      return Err(dbError);
    }
  }

  /**
   * Fetches edges from both personal_graph_edges_index and
   * collection_edges_index for the given URIs.
   *
   * @param uris - Node URIs to fetch edges for
   * @param edgeTypes - Optional filter by relation slug
   * @returns Deduplicated edges from both tables
   *
   * @internal
   */
  private async fetchEdgesForUris(uris: string[], edgeTypes?: string[]): Promise<SubgraphEdge[]> {
    const edgeMap = new Map<string, SubgraphEdge>();

    const hasEdgeFilter = edgeTypes && edgeTypes.length > 0;
    const personalEdgeSql = hasEdgeFilter
      ? `SELECT uri, source_uri, target_uri, relation_slug, weight
         FROM personal_graph_edges_index
         WHERE (source_uri = ANY($1) OR target_uri = ANY($1))
           AND relation_slug = ANY($2)`
      : `SELECT uri, source_uri, target_uri, relation_slug, weight
         FROM personal_graph_edges_index
         WHERE (source_uri = ANY($1) OR target_uri = ANY($1))`;

    const collectionEdgeSql = hasEdgeFilter
      ? `SELECT uri, source_uri, target_uri, relation_slug, label, weight
         FROM collection_edges_index
         WHERE (source_uri = ANY($1) OR target_uri = ANY($1))
           AND relation_slug = ANY($2)`
      : `SELECT uri, source_uri, target_uri, relation_slug, label, weight
         FROM collection_edges_index
         WHERE (source_uri = ANY($1) OR target_uri = ANY($1))`;

    const params: unknown[] = hasEdgeFilter ? [uris, edgeTypes] : [uris];

    const [personalResult, collectionResult] = await Promise.all([
      this.pool.query<{
        uri: string;
        source_uri: string;
        target_uri: string;
        relation_slug: string;
        label?: string;
        weight: number | null;
      }>(personalEdgeSql, params),
      this.pool.query<{
        uri: string;
        source_uri: string;
        target_uri: string;
        relation_slug: string;
        label: string | null;
        weight: number | null;
      }>(collectionEdgeSql, params),
    ]);

    for (const row of personalResult.rows) {
      edgeMap.set(row.uri, {
        uri: row.uri,
        sourceUri: row.source_uri,
        targetUri: row.target_uri,
        relationSlug: row.relation_slug,
        weight: row.weight ?? undefined,
      });
    }

    for (const row of collectionResult.rows) {
      if (!edgeMap.has(row.uri)) {
        edgeMap.set(row.uri, {
          uri: row.uri,
          sourceUri: row.source_uri,
          targetUri: row.target_uri,
          relationSlug: row.relation_slug,
          label: row.label ?? undefined,
          weight: row.weight ?? undefined,
        });
      }
    }

    return [...edgeMap.values()];
  }

  /**
   * Fetches node metadata from personal_graph_nodes_index for the given URIs.
   *
   * @param uris - Node URIs to fetch metadata for
   * @returns Array of subgraph nodes with metadata
   *
   * @internal
   */
  private async fetchNodesForUris(uris: string[]): Promise<SubgraphNode[]> {
    if (uris.length === 0) return [];

    const result = await this.pool.query<{
      uri: string;
      label: string;
      kind: string;
      subkind: string | null;
      description: string | null;
      metadata: Record<string, unknown> | null;
    }>(
      `SELECT uri, label, kind, subkind, description, metadata
       FROM personal_graph_nodes_index
       WHERE uri = ANY($1)`,
      [uris]
    );

    const nodeMap = new Map<string, SubgraphNode>();

    const parseJsonb = <T>(val: unknown): T | undefined => {
      if (val == null) return undefined;
      if (typeof val === 'string') return JSON.parse(val) as T;
      return val as T;
    };

    for (const row of result.rows) {
      nodeMap.set(row.uri, {
        uri: row.uri,
        label: row.label,
        kind: row.kind,
        subkind: row.subkind ?? undefined,
        description: row.description ?? undefined,
        metadata: parseJsonb<Record<string, unknown>>(row.metadata),
      });
    }

    // Include stub nodes for URIs not in personal_graph_nodes_index
    // (e.g., eprint URIs that are edge targets but not graph nodes)
    for (const uri of uris) {
      if (!nodeMap.has(uri)) {
        nodeMap.set(uri, {
          uri,
          label: uri,
          kind: 'unknown',
        });
      }
    }

    return [...nodeMap.values()];
  }

  /**
   * Converts a database row to a GraphNode.
   *
   * @param row - Database row with node fields
   * @returns GraphNode representation
   *
   * @internal
   */
  private rowToGraphNode(row: {
    uri: string;
    node_id: string;
    kind: string;
    subkind: string | null;
    label: string;
    alternate_labels: string | null;
    description: string | null;
    status: string;
    metadata?: Record<string, unknown> | string | null;
    created_at: Date;
  }): GraphNode {
    const parseJsonb = <T>(val: unknown): T | undefined => {
      if (val == null) return undefined;
      if (typeof val === 'string') return JSON.parse(val) as T;
      return val as T;
    };

    return {
      id: row.node_id,
      uri: row.uri as AtUri,
      kind: row.kind as 'type' | 'object',
      subkind: row.subkind ?? undefined,
      label: row.label,
      alternateLabels: parseJsonb<string[]>(row.alternate_labels),
      description: row.description ?? undefined,
      metadata: parseJsonb<NodeMetadata>(row.metadata),
      status: row.status as 'proposed' | 'provisional' | 'established' | 'deprecated',
      createdAt: new Date(row.created_at),
    };
  }
}
