/**
 * Neo4j repository for unified graph node operations.
 *
 * @remarks
 * Manages all knowledge graph nodes as read-only indexes.
 * Nodes replace the separate Concept, Organization, Authority, Field, and Facet types.
 *
 * @packageDocumentation
 * @public
 */

import neo4j from 'neo4j-driver';
import { singleton } from 'tsyringe';

import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';

import { Neo4jConnection } from './connection.js';
import type {
  GraphNode,
  NodeKind,
  NodeStatus,
  NodeInput,
  NodeUpdate,
  NodeSearchResult,
  NodeHierarchy,
  ExternalId,
  NodeMetadata,
} from './types.js';

/**
 * Subkind label mapping - converts slug to Neo4j label
 */
function subkindToLabel(slug: string): string {
  // Convert kebab-case to PascalCase
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Neo4j repository for unified graph node operations.
 *
 * @example
 * ```typescript
 * const repo = container.resolve(NodeRepository);
 *
 * // Create a node
 * await repo.createNode({
 *   id: '33b86a72-193b-5c4f-a585-98eb6c77ca71',
 *   uri: 'at://did:plc:graph-pds/pub.chive.graph.node/33b86a72-193b-5c4f-a585-98eb6c77ca71',
 *   kind: 'object',
 *   subkind: 'field',
 *   label: 'Machine Learning',
 *   status: 'established',
 * });
 *
 * // List nodes by kind and subkind
 * const fields = await repo.listNodes({ kind: 'object', subkind: 'field' });
 *
 * // Search nodes
 * const results = await repo.searchNodes('machine learning', { subkind: 'field' });
 * ```
 *
 * @public
 */
@singleton()
export class NodeRepository {
  constructor(private connection: Neo4jConnection) {}

  /**
   * Create a new graph node.
   *
   * @param node - Node data
   * @returns AT-URI of created node
   * @throws {ValidationError} If node with same ID already exists
   */
  async createNode(node: NodeInput): Promise<AtUri> {
    // Build labels: :Node:Type/:Object:SubkindLabel
    const kindLabel = node.kind === 'type' ? 'Type' : 'Object';
    const subkindLabel = node.subkind ? subkindToLabel(node.subkind) : '';
    const labels = subkindLabel ? `Node:${kindLabel}:${subkindLabel}` : `Node:${kindLabel}`;

    const query = `
      CREATE (n:${labels} {
        id: $id,
        slug: $slug,
        uri: $uri,
        kind: $kind,
        subkind: $subkind,
        subkindUri: $subkindUri,
        label: $label,
        alternateLabels: $alternateLabels,
        description: $description,
        externalIds: $externalIds,
        metadata: $metadata,
        status: $status,
        deprecatedBy: $deprecatedBy,
        proposalUri: $proposalUri,
        createdAt: datetime(),
        createdBy: $createdBy,
        updatedAt: datetime()
      })
      RETURN n.uri as uri
    `;

    try {
      const result = await this.connection.executeQuery<{ uri: AtUri }>(query, {
        id: node.id,
        slug: node.slug ?? null,
        uri: node.uri,
        kind: node.kind,
        subkind: node.subkind ?? null,
        subkindUri: node.subkindUri ?? null,
        label: node.label,
        alternateLabels: node.alternateLabels ?? null,
        description: node.description ?? null,
        externalIds: node.externalIds ? JSON.stringify(node.externalIds) : null,
        metadata: node.metadata ? JSON.stringify(node.metadata) : null,
        status: node.status,
        deprecatedBy: node.deprecatedBy ?? null,
        proposalUri: node.proposalUri ?? null,
        createdBy: node.createdBy ?? null,
      });

      const record = result.records[0];
      if (!record) {
        throw new DatabaseError(
          'CREATE',
          'Failed to create node: no record returned from database'
        );
      }

      return record.get('uri');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message.includes('already exists')) {
        throw new ValidationError(`Node with ID ${node.id} already exists`, 'id', 'unique');
      }
      throw error;
    }
  }

  /**
   * Get a node by URI.
   *
   * @param uri - Node AT-URI
   * @returns Node or null if not found
   */
  async getNode(uri: AtUri): Promise<GraphNode | null> {
    const query = `
      MATCH (n:Node {uri: $uri})
      RETURN n
    `;

    const result = await this.connection.executeQuery<{ n: GraphNode }>(query, { uri });
    const record = result.records[0];

    if (!record) {
      return null;
    }

    return this.mapRecordToNode(record.get('n'));
  }

  /**
   * Get a node by ID.
   *
   * @param id - Node ID (UUID)
   * @returns Node or null if not found
   */
  async getNodeById(id: string): Promise<GraphNode | null> {
    const query = `
      MATCH (n:Node {id: $id})
      RETURN n
    `;

    const result = await this.connection.executeQuery<{ n: GraphNode }>(query, { id });
    const record = result.records[0];

    if (!record) {
      return null;
    }

    return this.mapRecordToNode(record.get('n'));
  }

  /**
   * Update a node.
   *
   * @param uri - Node AT-URI
   * @param updates - Fields to update
   * @throws {NotFoundError} If node not found
   */
  async updateNode(uri: AtUri, updates: NodeUpdate): Promise<void> {
    const setClauses: string[] = ['n.updatedAt = datetime()'];
    const params: Record<string, string | null> = { uri };

    if (updates.label !== undefined) {
      setClauses.push('n.label = $label');
      params.label = updates.label;
    }

    if (updates.alternateLabels !== undefined) {
      setClauses.push('n.alternateLabels = $alternateLabels');
      params.alternateLabels = updates.alternateLabels
        ? JSON.stringify(updates.alternateLabels)
        : null;
    }

    if (updates.description !== undefined) {
      setClauses.push('n.description = $description');
      params.description = updates.description ?? null;
    }

    if (updates.status !== undefined) {
      setClauses.push('n.status = $status');
      params.status = updates.status;
    }

    if (updates.externalIds !== undefined) {
      setClauses.push('n.externalIds = $externalIds');
      params.externalIds = updates.externalIds ? JSON.stringify(updates.externalIds) : null;
    }

    if (updates.metadata !== undefined) {
      setClauses.push('n.metadata = $metadata');
      params.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
    }

    if (updates.deprecatedBy !== undefined) {
      setClauses.push('n.deprecatedBy = $deprecatedBy');
      params.deprecatedBy = updates.deprecatedBy ?? null;
    }

    const query = `
      MATCH (n:Node {uri: $uri})
      SET ${setClauses.join(', ')}
      RETURN n
    `;

    const result = await this.connection.executeQuery<{ n: GraphNode }>(query, params);

    if (result.records.length === 0) {
      throw new NotFoundError('Node', uri);
    }
  }

  /**
   * Delete a node.
   *
   * @param uri - Node AT-URI
   */
  async deleteNode(uri: AtUri): Promise<void> {
    const query = `
      MATCH (n:Node {uri: $uri})
      DETACH DELETE n
    `;

    await this.connection.executeQuery<Record<string, never>>(query, { uri });
  }

  /**
   * Search nodes by text.
   *
   * @param searchText - Search query
   * @param options - Search options
   * @returns Search results
   */
  async searchNodes(
    searchText: string,
    options?: {
      kind?: NodeKind;
      subkind?: string;
      status?: NodeStatus;
      limit?: number;
      cursor?: string;
    }
  ): Promise<NodeSearchResult> {
    const limit = options?.limit ?? 50;
    const filters: string[] = [];
    const params: Record<string, string | number | neo4j.Integer> = {
      searchText: `${searchText}*`,
      limit: neo4j.int(limit + 1),
    };

    if (options?.kind) {
      filters.push('node.kind = $kind');
      params.kind = options.kind;
    }

    if (options?.subkind) {
      filters.push('node.subkind = $subkind');
      params.subkind = options.subkind;
    }

    if (options?.status) {
      filters.push('node.status = $status');
      params.status = options.status;
    } else {
      filters.push("node.status <> 'deprecated'");
    }

    if (options?.cursor) {
      filters.push('node.label > $cursor');
      params.cursor = options.cursor;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    // Try full-text search first
    const fullTextQuery = `
      CALL db.index.fulltext.queryNodes('nodeTextIndex', $searchText)
      YIELD node, score
      ${whereClause}
      WITH node, score
      ORDER BY score DESC, node.label
      LIMIT $limit
      RETURN node
    `;

    try {
      const result = await this.connection.executeQuery<{ node: GraphNode }>(fullTextQuery, params);

      const nodes = result.records.map((record) => this.mapRecordToNode(record.get('node')));
      const hasMore = nodes.length > limit;
      if (hasMore) {
        nodes.pop();
      }

      return {
        nodes,
        total: nodes.length,
        hasMore,
        cursor: hasMore ? nodes[nodes.length - 1]?.label : undefined,
      };
    } catch {
      // Fall back to CONTAINS if full-text index not available
      const fallbackQuery = `
        MATCH (node:Node)
        WHERE toLower(node.label) CONTAINS toLower($searchTextPlain)
        ${filters.length > 0 ? `AND ${filters.join(' AND ')}` : ''}
        RETURN node
        ORDER BY node.label
        LIMIT $limit
      `;

      params.searchTextPlain = searchText;

      const result = await this.connection.executeQuery<{ node: GraphNode }>(fallbackQuery, params);

      const nodes = result.records.map((record) => this.mapRecordToNode(record.get('node')));
      const hasMore = nodes.length > limit;
      if (hasMore) {
        nodes.pop();
      }

      return {
        nodes,
        total: nodes.length,
        hasMore,
        cursor: hasMore ? nodes[nodes.length - 1]?.label : undefined,
      };
    }
  }

  /**
   * List nodes with filtering.
   *
   * @param options - List options
   * @returns List of nodes
   */
  async listNodes(options?: {
    kind?: NodeKind;
    subkind?: string;
    status?: NodeStatus;
    limit?: number;
    cursor?: string;
  }): Promise<NodeSearchResult> {
    const limit = options?.limit ?? 50;
    const filters: string[] = [];
    const params: Record<string, string | number | neo4j.Integer> = {
      limit: neo4j.int(limit + 1),
    };

    // Use label-based filtering for performance when subkind is specified
    let matchClause = 'MATCH (n:Node)';
    if (options?.subkind) {
      const subkindLabel = subkindToLabel(options.subkind);
      matchClause = `MATCH (n:Node:${subkindLabel})`;
    }

    if (options?.kind) {
      const kindLabel = options.kind === 'type' ? 'Type' : 'Object';
      // If we already have a subkind filter, just add kind check in WHERE
      if (options?.subkind) {
        filters.push('n.kind = $kind');
        params.kind = options.kind;
      } else {
        matchClause = `MATCH (n:Node:${kindLabel})`;
      }
    }

    if (options?.status) {
      filters.push('n.status = $status');
      params.status = options.status;
    } else {
      filters.push("n.status <> 'deprecated'");
    }

    if (options?.cursor) {
      filters.push('n.label > $cursor');
      params.cursor = options.cursor;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const query = `
      ${matchClause}
      ${whereClause}
      RETURN n
      ORDER BY n.label
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{ n: GraphNode }>(query, params);

    const nodes = result.records.map((record) => this.mapRecordToNode(record.get('n')));
    const hasMore = nodes.length > limit;
    if (hasMore) {
      nodes.pop();
    }

    // Get total count
    const countQuery = `
      ${matchClause}
      ${whereClause}
      RETURN count(n) as total
    `;

    const countResult = await this.connection.executeQuery<{ total: number }>(countQuery, params);
    const rawTotal = countResult.records[0]?.get('total');
    const total =
      typeof rawTotal === 'object' && rawTotal !== null && 'toNumber' in rawTotal
        ? (rawTotal as { toNumber: () => number }).toNumber()
        : (rawTotal ?? 0);

    return {
      nodes,
      total,
      hasMore,
      cursor: hasMore ? nodes[nodes.length - 1]?.label : undefined,
    };
  }

  /**
   * Get available subkinds (type nodes with subkind='subkind').
   *
   * @returns List of subkind definitions
   */
  async getSubkinds(): Promise<GraphNode[]> {
    const query = `
      MATCH (n:Node:Type:Subkind)
      WHERE n.status <> 'deprecated'
      RETURN n
      ORDER BY n.label
    `;

    const result = await this.connection.executeQuery<{ n: GraphNode }>(query);

    return result.records.map((record) => this.mapRecordToNode(record.get('n')));
  }

  /**
   * Get nodes connected to a given node via a specific relation.
   *
   * @param nodeUri - Source node URI
   * @param relationSlug - Relation type slug
   * @param direction - Relationship direction
   * @returns Connected nodes
   */
  async getConnectedNodes(
    nodeUri: AtUri,
    relationSlug: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'outgoing'
  ): Promise<GraphNode[]> {
    let pattern: string;
    if (direction === 'outgoing') {
      pattern = '(source)-[e:EDGE {relationSlug: $relationSlug}]->(target)';
    } else if (direction === 'incoming') {
      pattern = '(source)<-[e:EDGE {relationSlug: $relationSlug}]-(target)';
    } else {
      pattern = '(source)-[e:EDGE {relationSlug: $relationSlug}]-(target)';
    }

    const query = `
      MATCH (source:Node {uri: $nodeUri})
      MATCH ${pattern}
      WHERE target:Node AND e.status <> 'deprecated'
      RETURN DISTINCT target
      ORDER BY target.label
    `;

    const result = await this.connection.executeQuery<{ target: GraphNode }>(query, {
      nodeUri,
      relationSlug,
    });

    return result.records.map((record) => this.mapRecordToNode(record.get('target')));
  }

  /**
   * Get hierarchy for a subkind (using broader/narrower edges).
   *
   * @param subkind - Subkind to get hierarchy for
   * @param rootUri - Optional root node URI (omit for full hierarchy)
   * @param maxDepth - Maximum depth to traverse
   * @returns Hierarchical node structure
   */
  async getHierarchy(subkind: string, rootUri?: AtUri, maxDepth = 10): Promise<NodeHierarchy[]> {
    const subkindLabel = subkindToLabel(subkind);

    if (rootUri) {
      // Get hierarchy from specific root
      const query = `
        MATCH (root:Node:${subkindLabel} {uri: $rootUri})
        CALL apoc.path.subgraphNodes(root, {
          relationshipFilter: 'EDGE>',
          minLevel: 0,
          maxLevel: $maxDepth,
          labelFilter: '+Node',
          filterStartNode: false
        }) YIELD node
        WITH root, node
        OPTIONAL MATCH (node)<-[e:EDGE {relationSlug: 'narrower'}]-(parent:Node)
        RETURN node, parent.uri as parentUri
        ORDER BY node.label
      `;

      const result = await this.connection.executeQuery<{
        node: GraphNode;
        parentUri: string | null;
      }>(query, { rootUri, maxDepth: neo4j.int(maxDepth) });

      return this.buildHierarchyFromFlat(result.records, rootUri);
    } else {
      // Get all roots (nodes without broader relations)
      const query = `
        MATCH (n:Node:${subkindLabel})
        WHERE n.status <> 'deprecated'
        AND NOT EXISTS {
          MATCH (n)-[:EDGE {relationSlug: 'broader'}]->(:Node)
        }
        RETURN n
        ORDER BY n.label
      `;

      const result = await this.connection.executeQuery<{ n: GraphNode }>(query);

      // Build hierarchy for each root
      const roots: NodeHierarchy[] = [];
      for (const record of result.records) {
        const rootNode = this.mapRecordToNode(record.get('n'));
        const children = await this.getHierarchy(subkind, rootNode.uri, maxDepth);
        roots.push({
          node: rootNode,
          children: children.length > 0 ? (children[0]?.children ?? []) : [],
          depth: 0,
        });
      }

      return roots;
    }
  }

  /**
   * Build hierarchy from flat query results.
   */
  private buildHierarchyFromFlat(
    records: { get: (key: string) => GraphNode | string | null }[],
    rootUri: AtUri
  ): NodeHierarchy[] {
    const nodeMap = new Map<string, GraphNode>();
    const childrenMap = new Map<string, string[]>();

    // First pass: collect all nodes and parent relationships
    for (const record of records) {
      const node = this.mapRecordToNode(record.get('node') as GraphNode);
      const parentUri = record.get('parentUri') as string | null;

      nodeMap.set(node.uri, node);

      if (parentUri) {
        const children = childrenMap.get(parentUri) ?? [];
        children.push(node.uri);
        childrenMap.set(parentUri, children);
      }
    }

    // Build tree recursively
    const buildTree = (uri: string, depth: number): NodeHierarchy | null => {
      const node = nodeMap.get(uri);
      if (!node) return null;

      const childUris = childrenMap.get(uri) ?? [];
      const children = childUris
        .map((childUri) => buildTree(childUri, depth + 1))
        .filter((child): child is NodeHierarchy => child !== null);

      return {
        node,
        children,
        depth,
      };
    };

    const root = buildTree(rootUri, 0);
    return root ? [root] : [];
  }

  /**
   * Convert Neo4j datetime value to JavaScript Date.
   */
  private toDate(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string') {
      return new Date(value);
    }
    // Handle Neo4j DateTime objects
    if (typeof value === 'object' && value !== null && 'toStandardDate' in value) {
      return (value as { toStandardDate: () => Date }).toStandardDate();
    }
    // Handle Neo4j DateTime with year/month/day properties
    if (typeof value === 'object' && value !== null && 'year' in value) {
      const dt = value as {
        year: number;
        month: number;
        day: number;
        hour?: number;
        minute?: number;
        second?: number;
      };
      return new Date(dt.year, dt.month - 1, dt.day, dt.hour ?? 0, dt.minute ?? 0, dt.second ?? 0);
    }
    return new Date(String(value));
  }

  /**
   * Map Neo4j record to GraphNode.
   */
  private mapRecordToNode(record: unknown): GraphNode {
    const node = record as Record<string, unknown>;

    // Handle Neo4j node objects with .properties
    const props = (node.properties ?? node) as Record<string, unknown>;

    // Parse JSON fields with proper type validation
    let externalIds: ExternalId[] | undefined;
    if (props.externalIds && typeof props.externalIds === 'string') {
      try {
        const parsed: unknown = JSON.parse(props.externalIds);
        if (Array.isArray(parsed)) {
          externalIds = parsed as ExternalId[];
        }
      } catch {
        // Ignore parse errors
      }
    }

    let metadata: NodeMetadata | undefined;
    if (props.metadata && typeof props.metadata === 'string') {
      try {
        const parsed: unknown = JSON.parse(props.metadata);
        if (typeof parsed === 'object' && parsed !== null) {
          metadata = parsed as NodeMetadata;
        }
      } catch {
        // Ignore parse errors
      }
    }

    let alternateLabels: string[] | undefined;
    if (props.alternateLabels) {
      if (typeof props.alternateLabels === 'string') {
        try {
          const parsed: unknown = JSON.parse(props.alternateLabels);
          if (Array.isArray(parsed)) {
            alternateLabels = parsed as string[];
          }
        } catch {
          // Ignore parse errors
        }
      } else if (Array.isArray(props.alternateLabels)) {
        alternateLabels = props.alternateLabels as string[];
      }
    }

    return {
      id: props.id as string,
      slug: props.slug ? (props.slug as string) : undefined,
      uri: props.uri as AtUri,
      kind: props.kind as GraphNode['kind'],
      subkind: props.subkind ? (props.subkind as string) : undefined,
      subkindUri: props.subkindUri ? (props.subkindUri as AtUri) : undefined,
      label: props.label as string,
      alternateLabels,
      description: props.description ? (props.description as string) : undefined,
      externalIds,
      metadata,
      status: props.status as GraphNode['status'],
      deprecatedBy: props.deprecatedBy ? (props.deprecatedBy as AtUri) : undefined,
      proposalUri: props.proposalUri ? (props.proposalUri as AtUri) : undefined,
      createdAt: this.toDate(props.createdAt),
      createdBy: props.createdBy ? (props.createdBy as DID) : undefined,
      updatedAt: props.updatedAt ? this.toDate(props.updatedAt) : undefined,
    };
  }
}
