/**
 * Neo4j repository for graph edge operations.
 *
 * @remarks
 * Manages typed relationships between knowledge graph nodes.
 * Relation types are themselves nodes with subkind=relation.
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
  GraphEdge,
  EdgeStatus,
  EdgeInput,
  EdgeUpdate,
  EdgeSearchResult,
  EdgeMetadata,
} from './types.js';

/**
 * Neo4j record representation for edges
 */
interface Neo4jEdgeRecord {
  id: string;
  uri: string;
  sourceUri: string;
  targetUri: string;
  relationUri: string | null;
  relationSlug: string;
  weight: number | null;
  metadata: string | null;
  status: string;
  proposalUri: string | null;
  createdAt: unknown;
  createdBy: string | null;
  updatedAt: unknown;
}

/**
 * Neo4j repository for graph edge operations.
 *
 * @example
 * ```typescript
 * const repo = container.resolve(EdgeRepository);
 *
 * // Create an edge
 * await repo.createEdge({
 *   id: crypto.randomUUID(),
 *   uri: 'at://did:plc:graph-pds/pub.chive.graph.edge/0b1c2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e',
 *   sourceUri: 'at://did:plc:graph-pds/pub.chive.graph.node/33b86a72-193b-5c4f-a585-98eb6c77ca71',
 *   targetUri: 'at://did:plc:graph-pds/pub.chive.graph.node/1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f',
 *   relationSlug: 'broader',
 *   status: 'established',
 * });
 *
 * // List edges from a node
 * const edges = await repo.listEdges({ sourceUri: 'at://did:plc:graph-pds/pub.chive.graph.node/33b86a72-193b-5c4f-a585-98eb6c77ca71' });
 * ```
 *
 * @public
 */
@singleton()
export class EdgeRepository {
  constructor(private connection: Neo4jConnection) {}

  /**
   * Create a new graph edge.
   *
   * @param edge - Edge data
   * @returns AT-URI of created edge
   * @throws {ValidationError} If edge with same ID already exists
   */
  async createEdge(edge: EdgeInput): Promise<AtUri> {
    const query = `
      MATCH (source:Node {uri: $sourceUri})
      MATCH (target:Node {uri: $targetUri})
      CREATE (source)-[e:EDGE {
        id: $id,
        uri: $uri,
        sourceUri: $sourceUri,
        targetUri: $targetUri,
        relationUri: $relationUri,
        relationSlug: $relationSlug,
        weight: $weight,
        metadata: $metadata,
        status: $status,
        proposalUri: $proposalUri,
        createdAt: datetime(),
        createdBy: $createdBy,
        updatedAt: datetime()
      }]->(target)
      RETURN e.uri as uri
    `;

    try {
      const result = await this.connection.executeQuery<{ uri: AtUri }>(query, {
        id: edge.id,
        uri: edge.uri,
        sourceUri: edge.sourceUri,
        targetUri: edge.targetUri,
        relationUri: edge.relationUri ?? null,
        relationSlug: edge.relationSlug,
        weight: edge.weight ?? null,
        metadata: edge.metadata ? JSON.stringify(edge.metadata) : null,
        status: edge.status,
        proposalUri: edge.proposalUri ?? null,
        createdBy: edge.createdBy ?? null,
      });

      const record = result.records[0];
      if (!record) {
        throw new DatabaseError('CREATE', 'Failed to create edge: source or target node not found');
      }

      return record.get('uri');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message.includes('already exists')) {
        throw new ValidationError(`Edge with ID ${edge.id} already exists`, 'id', 'unique');
      }
      throw error;
    }
  }

  /**
   * Get an edge by URI.
   *
   * @param uri - Edge AT-URI
   * @returns Edge or null if not found
   */
  async getEdge(uri: AtUri): Promise<GraphEdge | null> {
    const query = `
      MATCH ()-[e:EDGE {uri: $uri}]->()
      RETURN e
    `;

    const result = await this.connection.executeQuery<{ e: Neo4jEdgeRecord }>(query, { uri });
    const record = result.records[0];

    if (!record) {
      return null;
    }

    return this.mapRecordToEdge(record.get('e'));
  }

  /**
   * Get an edge by ID.
   *
   * @param id - Edge ID (UUID)
   * @returns Edge or null if not found
   */
  async getEdgeById(id: string): Promise<GraphEdge | null> {
    const query = `
      MATCH ()-[e:EDGE {id: $id}]->()
      RETURN e
    `;

    const result = await this.connection.executeQuery<{ e: Neo4jEdgeRecord }>(query, { id });
    const record = result.records[0];

    if (!record) {
      return null;
    }

    return this.mapRecordToEdge(record.get('e'));
  }

  /**
   * Update an edge.
   *
   * @param uri - Edge AT-URI
   * @param updates - Fields to update
   * @throws {NotFoundError} If edge not found
   */
  async updateEdge(uri: AtUri, updates: EdgeUpdate): Promise<void> {
    const setClauses: string[] = ['e.updatedAt = datetime()'];
    const params: Record<string, string | number | null> = { uri };

    if (updates.relationUri !== undefined) {
      setClauses.push('e.relationUri = $relationUri');
      params.relationUri = updates.relationUri ?? null;
    }

    if (updates.relationSlug !== undefined) {
      setClauses.push('e.relationSlug = $relationSlug');
      params.relationSlug = updates.relationSlug;
    }

    if (updates.weight !== undefined) {
      setClauses.push('e.weight = $weight');
      params.weight = updates.weight ?? null;
    }

    if (updates.status !== undefined) {
      setClauses.push('e.status = $status');
      params.status = updates.status;
    }

    if (updates.metadata !== undefined) {
      setClauses.push('e.metadata = $metadata');
      params.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
    }

    const query = `
      MATCH ()-[e:EDGE {uri: $uri}]->()
      SET ${setClauses.join(', ')}
      RETURN e
    `;

    const result = await this.connection.executeQuery<{ e: Neo4jEdgeRecord }>(query, params);

    if (result.records.length === 0) {
      throw new NotFoundError('Edge', uri);
    }
  }

  /**
   * Delete an edge.
   *
   * @param uri - Edge AT-URI
   */
  async deleteEdge(uri: AtUri): Promise<void> {
    const query = `
      MATCH ()-[e:EDGE {uri: $uri}]->()
      DELETE e
    `;

    await this.connection.executeQuery<Record<string, never>>(query, { uri });
  }

  /**
   * List edges with filtering.
   *
   * @param options - List options
   * @returns List of edges
   */
  async listEdges(options?: {
    sourceUri?: AtUri;
    targetUri?: AtUri;
    relationSlug?: string;
    status?: EdgeStatus;
    limit?: number;
    cursor?: string;
  }): Promise<EdgeSearchResult> {
    const limit = options?.limit ?? 50;
    const filters: string[] = [];
    const params: Record<string, string | number | neo4j.Integer> = {
      limit: neo4j.int(limit + 1),
    };

    if (options?.sourceUri) {
      filters.push('e.sourceUri = $sourceUri');
      params.sourceUri = options.sourceUri;
    }

    if (options?.targetUri) {
      filters.push('e.targetUri = $targetUri');
      params.targetUri = options.targetUri;
    }

    if (options?.relationSlug) {
      filters.push('e.relationSlug = $relationSlug');
      params.relationSlug = options.relationSlug;
    }

    if (options?.status) {
      filters.push('e.status = $status');
      params.status = options.status;
    } else {
      filters.push("e.status <> 'deprecated'");
    }

    if (options?.cursor) {
      filters.push('e.createdAt > datetime($cursor)');
      params.cursor = options.cursor;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const query = `
      MATCH ()-[e:EDGE]->()
      ${whereClause}
      RETURN e
      ORDER BY e.createdAt DESC
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{ e: Neo4jEdgeRecord }>(query, params);

    const edges = result.records.map((record) => this.mapRecordToEdge(record.get('e')));
    const hasMore = edges.length > limit;
    if (hasMore) {
      edges.pop();
    }

    // Get total count
    const countQuery = `
      MATCH ()-[e:EDGE]->()
      ${whereClause}
      RETURN count(e) as total
    `;

    const countResult = await this.connection.executeQuery<{ total: number }>(countQuery, params);
    const rawTotal = countResult.records[0]?.get('total');
    const total =
      typeof rawTotal === 'object' && rawTotal !== null && 'toNumber' in rawTotal
        ? (rawTotal as neo4j.Integer).toNumber()
        : Number(rawTotal ?? 0);

    return {
      edges,
      total,
      hasMore,
      cursor: hasMore ? edges[edges.length - 1]?.createdAt.toISOString() : undefined,
    };
  }

  /**
   * Get available relation types (nodes with subkind=relation).
   *
   * @returns List of relation type nodes
   */
  async getRelationTypes(): Promise<
    { slug: string; label: string; description?: string; inverseSlug?: string }[]
  > {
    const query = `
      MATCH (n:Node:Type:Relation)
      WHERE n.status <> 'deprecated'
      RETURN n.id as slug, n.label as label, n.description as description, n.metadata as metadata
      ORDER BY n.label
    `;

    const result = await this.connection.executeQuery<{
      slug: string;
      label: string;
      description: string | null;
      metadata: string | null;
    }>(query);

    return result.records.map((record) => {
      const metadata = record.get('metadata');
      let inverseSlug: string | undefined;
      if (metadata) {
        try {
          const parsed = JSON.parse(metadata) as { inverseSlug?: string };
          inverseSlug = parsed.inverseSlug;
        } catch {
          // Ignore parse errors
        }
      }

      return {
        slug: record.get('slug'),
        label: record.get('label'),
        description: record.get('description') ?? undefined,
        inverseSlug,
      };
    });
  }

  /**
   * Get all edges between two nodes.
   *
   * @param sourceUri - Source node URI
   * @param targetUri - Target node URI
   * @returns Edges between the nodes
   */
  async getEdgesBetween(sourceUri: AtUri, targetUri: AtUri): Promise<GraphEdge[]> {
    const query = `
      MATCH (source:Node {uri: $sourceUri})-[e:EDGE]-(target:Node {uri: $targetUri})
      WHERE e.status <> 'deprecated'
      RETURN e
    `;

    const result = await this.connection.executeQuery<{ e: Neo4jEdgeRecord }>(query, {
      sourceUri,
      targetUri,
    });

    return result.records.map((record) => this.mapRecordToEdge(record.get('e')));
  }

  /**
   * Check if an edge exists between two nodes with a specific relation.
   *
   * @param sourceUri - Source node URI
   * @param targetUri - Target node URI
   * @param relationSlug - Relation type slug
   * @returns True if edge exists
   */
  async edgeExists(sourceUri: AtUri, targetUri: AtUri, relationSlug: string): Promise<boolean> {
    const query = `
      MATCH (source:Node {uri: $sourceUri})-[e:EDGE {relationSlug: $relationSlug}]->(target:Node {uri: $targetUri})
      WHERE e.status <> 'deprecated'
      RETURN count(e) > 0 as exists
    `;

    const result = await this.connection.executeQuery<{ exists: boolean }>(query, {
      sourceUri,
      targetUri,
      relationSlug,
    });

    return result.records[0]?.get('exists') ?? false;
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
   * Map Neo4j record to GraphEdge.
   */
  private mapRecordToEdge(record: Neo4jEdgeRecord | { properties?: Neo4jEdgeRecord }): GraphEdge {
    // Handle Neo4j relationship objects with .properties
    let props: Neo4jEdgeRecord;
    if ('properties' in record && record.properties !== undefined) {
      props = record.properties;
    } else {
      props = record as Neo4jEdgeRecord;
    }

    // Parse metadata JSON
    let metadata: EdgeMetadata | undefined;
    if (props.metadata && typeof props.metadata === 'string') {
      try {
        metadata = JSON.parse(props.metadata) as EdgeMetadata;
      } catch {
        // Ignore parse errors
      }
    }

    return {
      id: props.id,
      uri: props.uri as AtUri,
      sourceUri: props.sourceUri as AtUri,
      targetUri: props.targetUri as AtUri,
      relationUri: props.relationUri ? (props.relationUri as AtUri) : undefined,
      relationSlug: props.relationSlug,
      weight: props.weight ?? undefined,
      metadata,
      status: props.status as EdgeStatus,
      proposalUri: props.proposalUri ? (props.proposalUri as AtUri) : undefined,
      createdAt: this.toDate(props.createdAt),
      createdBy: props.createdBy ? (props.createdBy as DID) : undefined,
      updatedAt: props.updatedAt ? this.toDate(props.updatedAt) : undefined,
    };
  }
}
