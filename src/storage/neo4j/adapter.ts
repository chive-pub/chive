/**
 * Neo4j graph database adapter implementing IGraphDatabase.
 *
 * @remarks
 * Provides read-only index operations for the knowledge graph.
 * All data is indexed from ATProto records in the firehose.
 *
 * @packageDocumentation
 * @public
 */

import neo4j, { Integer } from 'neo4j-driver';
import { singleton } from 'tsyringe';

import { toAtUri, toDID } from '../../types/atproto-validators.js';
import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError } from '../../types/errors.js';
import type {
  IGraphDatabase,
  NodeInput,
  EdgeInput,
  FacetFilter,
  NodeSearchOptions,
  ProposalFilters,
  FacetAggregation,
} from '../../types/interfaces/graph.interface.js';

import { Neo4jConnection } from './connection.js';
import type {
  GraphNode,
  GraphEdge,
  NodeProposal,
  Vote,
  ConsensusResult,
  NodeSearchResult,
  NodeHierarchy,
  RelationshipSlug,
  NodeKind,
  NodeStatus,
  ExternalId,
  NodeMetadata,
  ProposalStatus,
  UserRole,
  VoteType,
} from './types.js';

/**
 * Map subkind slugs to Neo4j labels (PascalCase).
 */
function subkindToLabel(subkind: string): string {
  return subkind
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Neo4j adapter implementing the IGraphDatabase interface.
 *
 * Uses a unified node/edge model where all entities are GraphNode
 * distinguished by kind (type/object) and subkind.
 *
 * Neo4j nodes have multiple labels for efficient filtering:
 * - :Node - Base label for all nodes
 * - :Type or :Object - Kind label
 * - Subkind-specific label - e.g., :Field, :Institution
 *
 * @public
 */
@singleton()
export class Neo4jAdapter implements IGraphDatabase {
  constructor(private connection: Neo4jConnection) {}

  /**
   * Upserts a node.
   */
  async upsertNode(node: NodeInput): Promise<void> {
    const kindLabel = node.kind === 'type' ? 'Type' : 'Object';
    const subkindLabel = node.subkind ? subkindToLabel(node.subkind) : null;

    // Build label string: :Node:Type:Field or :Node:Object:Institution
    const labels = subkindLabel ? `Node:${kindLabel}:${subkindLabel}` : `Node:${kindLabel}`;

    const query = `
      MERGE (n:${labels} {id: $id})
      ON CREATE SET n.createdAt = datetime()
      SET n.uri = $uri,
          n.kind = $kind,
          n.subkind = $subkind,
          n.label = $label,
          n.alternateLabels = $alternateLabels,
          n.description = $description,
          n.externalIds = $externalIds,
          n.metadata = $metadata,
          n.status = $status,
          n.updatedAt = datetime()
      RETURN n
    `;

    await this.connection.executeQuery(query, {
      id: node.id,
      uri: node.uri ?? null,
      kind: node.kind,
      subkind: node.subkind ?? null,
      label: node.label,
      alternateLabels: node.alternateLabels ? [...node.alternateLabels] : null,
      description: node.description ?? null,
      externalIds: node.externalIds ? JSON.stringify(node.externalIds) : null,
      metadata: node.metadata ? JSON.stringify(node.metadata) : null,
      status: node.status,
    });
  }

  /**
   * Gets a node by URI.
   */
  async getNodeByUri(uri: AtUri): Promise<GraphNode | null> {
    const query = `
      MATCH (n:Node {uri: $uri})
      RETURN n
    `;

    const result = await this.connection.executeQuery<{
      n: Neo4jNode;
    }>(query, { uri });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapNeo4jNode(record.get('n'));
  }

  /**
   * Gets a node by ID and optional subkind.
   */
  async getNode(id: string, subkind?: string): Promise<GraphNode | null> {
    const labelFilter = subkind ? `:${subkindToLabel(subkind)}` : '';

    const query = `
      MATCH (n:Node${labelFilter} {id: $id})
      RETURN n
    `;

    const result = await this.connection.executeQuery<{
      n: Neo4jNode;
    }>(query, { id });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapNeo4jNode(record.get('n'));
  }

  /**
   * Lists nodes with filtering.
   */
  async listNodes(options: NodeSearchOptions): Promise<NodeSearchResult> {
    const { kind, subkind, status, limit = 50, cursor } = options;

    // Build label filter
    let labelFilter = ':Node';
    if (kind) {
      labelFilter += `:${kind === 'type' ? 'Type' : 'Object'}`;
    }
    if (subkind) {
      labelFilter += `:${subkindToLabel(subkind)}`;
    }

    const conditions: string[] = [];
    const params: Record<string, unknown> = {
      limit: neo4j.int(limit + 1),
      skip: neo4j.int(cursor ? parseInt(cursor, 10) : 0),
    };

    if (status) {
      conditions.push('n.status = $status');
      params.status = status;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      MATCH (n${labelFilter})
      ${whereClause}
      RETURN n
      ORDER BY n.label ASC
      SKIP $skip
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{ n: Neo4jNode }>(query, params);

    const nodes = result.records.map((record) => this.mapNeo4jNode(record.get('n')));
    const hasMore = nodes.length > limit;
    if (hasMore) {
      nodes.pop();
    }

    const skipValue = cursor ? parseInt(cursor, 10) : 0;
    const nextCursor = hasMore ? String(skipValue + nodes.length) : undefined;

    // Get total count
    const countQuery = `
      MATCH (n${labelFilter})
      ${whereClause}
      RETURN count(n) as total
    `;
    const countResult = await this.connection.executeQuery<{ total: Integer }>(countQuery, params);
    const total = this.toNumber(countResult.records[0]?.get('total'));

    return {
      nodes,
      total,
      hasMore,
      cursor: nextCursor,
    };
  }

  /**
   * Searches nodes by text query.
   */
  async searchNodes(query: string, options?: NodeSearchOptions): Promise<NodeSearchResult> {
    const { kind, subkind, status, limit = 50, cursor } = options ?? {};

    const conditions: string[] = [];
    const params: Record<string, unknown> = {
      searchText: query,
      limit: neo4j.int(limit + 1),
      skip: neo4j.int(cursor ? parseInt(cursor, 10) : 0),
    };

    if (kind) {
      conditions.push('n.kind = $kind');
      params.kind = kind;
    }

    if (subkind) {
      conditions.push('n.subkind = $subkind');
      params.subkind = subkind;
    }

    if (status) {
      conditions.push('n.status = $status');
      params.status = status;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const searchQuery = `
      CALL db.index.fulltext.queryNodes('node_search', $searchText)
      YIELD node as n, score
      ${whereClause}
      RETURN n, score
      ORDER BY score DESC
      SKIP $skip
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{ n: Neo4jNode; score: number }>(
      searchQuery,
      params
    );

    const nodes = result.records.map((record) => this.mapNeo4jNode(record.get('n')));
    const hasMore = nodes.length > limit;
    if (hasMore) {
      nodes.pop();
    }

    const skipValue = cursor ? parseInt(cursor, 10) : 0;
    const nextCursor = hasMore ? String(skipValue + nodes.length) : undefined;

    // Get total count
    const countQuery = `
      CALL db.index.fulltext.queryNodes('node_search', $searchText)
      YIELD node as n
      ${whereClause}
      RETURN count(n) as total
    `;
    const countResult = await this.connection.executeQuery<{ total: Integer }>(countQuery, params);
    const total = this.toNumber(countResult.records[0]?.get('total'));

    return {
      nodes,
      total,
      hasMore,
      cursor: nextCursor,
    };
  }

  /**
   * Creates an edge between nodes.
   */
  async createEdge(edge: EdgeInput): Promise<void> {
    const query = `
      MATCH (source:Node {uri: $sourceUri})
      MATCH (target:Node {uri: $targetUri})
      MERGE (source)-[e:EDGE {sourceUri: $sourceUri, targetUri: $targetUri, relationSlug: $relationSlug}]->(target)
      ON CREATE SET e.createdAt = datetime()
      SET e.id = $id,
          e.uri = $uri,
          e.relationUri = $relationUri,
          e.weight = $weight,
          e.metadata = $metadata,
          e.status = $status,
          e.proposalUri = $proposalUri,
          e.createdBy = $createdBy,
          e.updatedAt = datetime()
      RETURN e
    `;

    await this.connection.executeQuery(query, {
      id: edge.id ?? null,
      uri: edge.uri ?? null,
      sourceUri: edge.sourceUri,
      targetUri: edge.targetUri,
      relationUri: edge.relationUri ?? null,
      relationSlug: edge.relationSlug,
      weight: edge.weight ?? 1.0,
      metadata: edge.metadata ? JSON.stringify(edge.metadata) : null,
      status: edge.status ?? 'established',
      proposalUri: edge.proposalUri ?? null,
      createdBy: edge.createdBy ?? null,
    });
  }

  /**
   * Gets edges from a node, optionally filtered by relation.
   */
  async getEdges(nodeUri: AtUri, relationSlug?: RelationshipSlug): Promise<readonly GraphEdge[]> {
    const relationFilter = relationSlug ? '{relationSlug: $relationSlug}' : '';

    const query = `
      MATCH (source:Node {uri: $nodeUri})-[e:EDGE ${relationFilter}]->(target:Node)
      RETURN e, source.uri as sourceUri, target.uri as targetUri
      ORDER BY e.createdAt DESC
    `;

    const result = await this.connection.executeQuery<{
      e: Neo4jEdge;
      sourceUri: string;
      targetUri: string;
    }>(query, { nodeUri, relationSlug: relationSlug ?? null });

    return result.records.map((record) =>
      this.mapNeo4jEdge(record.get('e'), record.get('sourceUri'), record.get('targetUri'))
    );
  }

  /**
   * Finds related nodes by traversing edges.
   */
  async findRelatedNodes(nodeUri: AtUri, maxDepth = 2): Promise<readonly GraphNode[]> {
    const query = `
      MATCH (start:Node {uri: $nodeUri})
      CALL apoc.path.expandConfig(start, {
        minLevel: 1,
        maxLevel: $maxDepth,
        labelFilter: '+Node',
        uniqueness: 'NODE_GLOBAL'
      }) YIELD path
      WITH last(nodes(path)) as related, min(length(path)) as distance
      RETURN DISTINCT related as n
      ORDER BY distance, related.label
      LIMIT 50
    `;

    const result = await this.connection.executeQuery<{ n: Neo4jNode }>(query, {
      nodeUri,
      maxDepth: neo4j.int(maxDepth),
    });

    return result.records.map((record) => this.mapNeo4jNode(record.get('n')));
  }

  /**
   * Gets node hierarchy for tree views.
   */
  async getHierarchy(rootUri: AtUri, maxDepth = 5): Promise<NodeHierarchy> {
    const query = `
      MATCH path = (root:Node {uri: $rootUri})<-[:EDGE {relationSlug: 'narrower'}*0..${maxDepth}]-(child:Node)
      WITH root, child, length(path) as depth
      ORDER BY depth, child.label
      RETURN root, collect({child: child, depth: depth}) as children
    `;

    const result = await this.connection.executeQuery<{
      root: Neo4jNode;
      children: { child: Neo4jNode; depth: Integer }[];
    }>(query, { rootUri });

    if (result.records.length === 0) {
      throw new NotFoundError('Node', rootUri);
    }

    const record = result.records[0];
    if (!record) {
      throw new NotFoundError('Node', rootUri);
    }

    const root = this.mapNeo4jNode(record.get('root'));
    const children = record.get('children');

    return this.buildHierarchy(root, children);
  }

  /**
   * Queries eprints by facets.
   */
  async queryByFacets(facets: readonly FacetFilter[]): Promise<readonly string[]> {
    if (facets.length === 0) {
      return [];
    }

    const facetMatches = facets.map(
      (_, i) => `
      MATCH (p)-[:HAS_FACET]->(f${i}:Node:Facet)
      WHERE f${i}.label = $facet${i}Value
        AND f${i}.metadata CONTAINS $facet${i}Dimension
    `
    );

    const query = `
      MATCH (p:Eprint)
      ${facetMatches.join('\n')}
      RETURN DISTINCT p.uri as uri
      LIMIT $limit
    `;

    const params: Record<string, string | Integer> = {
      limit: neo4j.int(1000),
    };
    facets.forEach((facet, i) => {
      params[`facet${i}Dimension`] = facet.dimension;
      params[`facet${i}Value`] = facet.value;
    });

    const result = await this.connection.executeQuery<{ uri: string }>(query, params);

    return result.records.map((record) => record.get('uri'));
  }

  /**
   * Aggregates facet values with counts.
   */
  async aggregateFacets(
    currentFacets?: readonly FacetFilter[]
  ): Promise<readonly FacetAggregation[]> {
    const facetMatches =
      currentFacets && currentFacets.length > 0
        ? currentFacets
            .map(
              (_, i) => `
      MATCH (p)-[:HAS_FACET]->(cf${i}:Node:Facet)
      WHERE cf${i}.label = $currentFacet${i}Value
    `
            )
            .join('\n')
        : '';

    const params: Record<string, string> = {};
    if (currentFacets) {
      currentFacets.forEach((facet, i) => {
        params[`currentFacet${i}Value`] = facet.value;
      });
    }

    const query = `
      MATCH (p:Eprint)
      ${facetMatches}
      MATCH (p)-[:HAS_FACET]->(f:Node:Facet)
      WITH f.metadata as metadata, f.label as value, count(DISTINCT p) as count
      WHERE count > 0
      RETURN metadata, value, count
      ORDER BY count DESC
    `;

    const result = await this.connection.executeQuery<{
      metadata: string;
      value: string;
      count: Integer;
    }>(query, params);

    // Group by dimension
    const dimensionMap = new Map<string, { value: string; count: number }[]>();

    for (const record of result.records) {
      const metadata = record.get('metadata');
      const value = record.get('value');
      const count = this.toNumber(record.get('count'));

      let dimension = 'unknown';
      if (metadata) {
        try {
          const parsed = JSON.parse(metadata) as { dimension?: string };
          dimension = parsed.dimension ?? 'unknown';
        } catch {
          // Use default
        }
      }

      const values = dimensionMap.get(dimension) ?? [];
      values.push({ value, count });
      dimensionMap.set(dimension, values);
    }

    return Array.from(dimensionMap.entries()).map(([dimension, values]) => ({
      dimension,
      values,
    }));
  }

  /**
   * Gets pending proposals for a node.
   */
  async getProposalsForNode(nodeUri: AtUri): Promise<readonly NodeProposal[]> {
    const query = `
      MATCH (p:Proposal)
      WHERE p.targetUri = $nodeUri AND p.status = 'pending'
      RETURN p
      ORDER BY p.createdAt DESC
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{ p: Neo4jProposal }>(query, {
      nodeUri,
      limit: neo4j.int(50),
    });

    return result.records.map((record) => this.mapNeo4jProposal(record.get('p')));
  }

  /**
   * Lists proposals with filtering.
   */
  async listProposals(filters: ProposalFilters): Promise<{
    readonly proposals: readonly NodeProposal[];
    readonly total: number;
    readonly hasMore: boolean;
    readonly offset: number;
  }> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filters.status && filters.status.length > 0) {
      conditions.push('p.status IN $statuses');
      params.statuses = [...filters.status];
    }

    if (filters.proposalType && filters.proposalType.length > 0) {
      conditions.push('p.proposalType IN $proposalTypes');
      params.proposalTypes = [...filters.proposalType];
    }

    if (filters.proposerDid) {
      conditions.push('p.proposerDid = $proposerDid');
      params.proposerDid = filters.proposerDid;
    }

    if (filters.nodeUri) {
      conditions.push('p.targetUri = $nodeUri');
      params.nodeUri = filters.nodeUri;
    }

    if (filters.subkind) {
      conditions.push('p.subkind = $subkind');
      params.subkind = filters.subkind;
    }

    if (filters.createdAfter) {
      conditions.push('p.createdAt >= $createdAfter');
      params.createdAfter = filters.createdAfter;
    }

    if (filters.createdBefore) {
      conditions.push('p.createdAt <= $createdBefore');
      params.createdBefore = filters.createdBefore;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.offset = neo4j.int(filters.offset ?? 0);
    params.limit = neo4j.int((filters.limit ?? 50) + 1);

    const query = `
      MATCH (p:Proposal)
      ${whereClause}
      RETURN p
      ORDER BY p.createdAt DESC
      SKIP $offset
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{ p: Neo4jProposal }>(query, params);

    const proposals = result.records.map((record) => this.mapNeo4jProposal(record.get('p')));
    const hasMore = proposals.length > (filters.limit ?? 50);
    if (hasMore) {
      proposals.pop();
    }

    // Get total count
    const countQuery = `
      MATCH (p:Proposal)
      ${whereClause}
      RETURN count(p) as total
    `;
    const countResult = await this.connection.executeQuery<{ total: Integer }>(countQuery, params);
    const total = this.toNumber(countResult.records[0]?.get('total'));

    return {
      proposals,
      total,
      hasMore,
      offset: filters.offset ?? 0,
    };
  }

  /**
   * Gets a proposal by URI.
   */
  async getProposal(uri: AtUri): Promise<NodeProposal | null> {
    const query = `
      MATCH (p:Proposal {uri: $uri})
      RETURN p
    `;

    const result = await this.connection.executeQuery<{ p: Neo4jProposal }>(query, { uri });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapNeo4jProposal(record.get('p'));
  }

  /**
   * Creates a vote on a proposal.
   */
  async createVote(vote: Vote): Promise<void> {
    const query = `
      MERGE (v:Vote {uri: $uri})
      ON CREATE SET v.createdAt = datetime()
      SET v.proposalUri = $proposalUri,
          v.voterDid = $voterDid,
          v.voterRole = $voterRole,
          v.vote = $vote,
          v.comment = $comment,
          v.updatedAt = datetime()
      WITH v
      OPTIONAL MATCH (p:Proposal {uri: $proposalUri})
      FOREACH (ignored IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END |
        MERGE (v)-[:VOTES_ON]->(p)
      )
      RETURN v
    `;

    await this.connection.executeQuery(query, {
      uri: vote.uri,
      proposalUri: vote.proposalUri,
      voterDid: vote.voterDid,
      voterRole: vote.voterRole,
      vote: vote.vote,
      comment: vote.comment ?? null,
    });
  }

  /**
   * Gets votes for a proposal.
   */
  async getVotesForProposal(proposalUri: AtUri): Promise<readonly Vote[]> {
    const query = `
      MATCH (v:Vote {proposalUri: $proposalUri})
      RETURN v
      ORDER BY v.createdAt DESC
    `;

    const result = await this.connection.executeQuery<{ v: Neo4jVote }>(query, { proposalUri });

    return result.records.map((record) => this.mapNeo4jVote(record.get('v')));
  }

  /**
   * Calculates consensus for a proposal.
   */
  async calculateConsensus(proposalUri: AtUri): Promise<ConsensusResult> {
    const votes = await this.getVotesForProposal(proposalUri);

    let approveCount = 0;
    let rejectCount = 0;
    let weightedApprove = 0;
    let weightedReject = 0;

    const roleWeights: Record<UserRole, number> = {
      'community-member': 1.0,
      'trusted-editor': 2.0,
      'graph-editor': 3.0,
      'domain-expert': 3.0,
      administrator: 5.0,
    };

    for (const vote of votes) {
      const weight = roleWeights[vote.voterRole];

      if (vote.vote === 'approve') {
        approveCount++;
        weightedApprove += weight;
      } else if (vote.vote === 'reject') {
        rejectCount++;
        weightedReject += weight;
      }
    }

    const totalVotes = approveCount + rejectCount;
    const approvalRatio = totalVotes > 0 ? weightedApprove / (weightedApprove + weightedReject) : 0;

    const threshold = 0.67;
    const minVotes = 5;

    const reached = totalVotes >= minVotes && approvalRatio >= threshold;

    return {
      reached,
      approveVotes: approveCount,
      rejectVotes: rejectCount,
      weightedApprove,
      weightedReject,
      approvalRatio,
      threshold,
    };
  }

  /**
   * Creates a proposal.
   */
  async createProposal(proposal: {
    readonly uri: AtUri;
    readonly proposalType: 'create' | 'update' | 'merge' | 'deprecate';
    readonly kind: NodeKind;
    readonly subkind?: string;
    readonly targetUri?: AtUri;
    readonly proposedNode?: Partial<GraphNode>;
    readonly rationale: string;
    readonly proposerDid: DID;
    readonly createdAt: Date;
  }): Promise<void> {
    const query = `
      MERGE (p:Proposal {uri: $uri})
      ON CREATE SET
        p.proposalType = $proposalType,
        p.kind = $kind,
        p.subkind = $subkind,
        p.targetUri = $targetUri,
        p.proposedNode = $proposedNode,
        p.rationale = $rationale,
        p.proposerDid = $proposerDid,
        p.status = 'pending',
        p.createdAt = datetime($createdAt),
        p.updatedAt = datetime()
      ON MATCH SET
        p.proposedNode = $proposedNode,
        p.rationale = $rationale,
        p.updatedAt = datetime()
    `;

    await this.connection.executeQuery(query, {
      uri: proposal.uri,
      proposalType: proposal.proposalType,
      kind: proposal.kind,
      subkind: proposal.subkind ?? null,
      targetUri: proposal.targetUri ?? null,
      proposedNode: proposal.proposedNode ? JSON.stringify(proposal.proposedNode) : null,
      rationale: proposal.rationale,
      proposerDid: proposal.proposerDid,
      createdAt: proposal.createdAt.toISOString(),
    });
  }

  /**
   * Deletes a node.
   */
  async deleteNode(uri: AtUri): Promise<void> {
    const query = `
      MATCH (n:Node {uri: $uri})
      DETACH DELETE n
    `;

    await this.connection.executeQuery(query, { uri });
  }

  /**
   * Build hierarchical structure from flat list.
   */
  private buildHierarchy(
    root: GraphNode,
    children: { child: Neo4jNode; depth: Integer }[]
  ): NodeHierarchy {
    const childNodes = children
      .filter((c) => this.toNumber(c.depth) === 1)
      .map((c) => {
        const childNode = this.mapNeo4jNode(c.child);
        const grandchildren = children.filter(
          (gc) =>
            this.toNumber(gc.depth) > 1 && gc.child.properties?.uri === c.child.properties?.uri
        );
        return this.buildHierarchy(childNode, grandchildren);
      });

    return {
      node: root,
      children: childNodes,
      depth: 0,
    };
  }

  /**
   * Convert Neo4j Integer to number.
   */
  private toNumber(value: Integer | number | undefined | null): number {
    if (value === undefined || value === null) {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'object' && 'toNumber' in value) {
      return value.toNumber();
    }
    return 0;
  }

  /**
   * Parse Neo4j DateTime or timestamp to JavaScript Date.
   */
  private parseNeo4jDate(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'number') {
      return new Date(value);
    }
    if (typeof value === 'string') {
      return new Date(value);
    }
    // Handle Neo4j temporal types using driver utilities
    if (neo4j.isDateTime(value) || neo4j.isLocalDateTime(value) || neo4j.isDate(value)) {
      return value.toStandardDate();
    }
    return new Date();
  }

  /**
   * Map Neo4j node to GraphNode.
   */
  private mapNeo4jNode(node: Neo4jNode): GraphNode {
    const props = node.properties ?? node;

    const id = props.id as string;
    const uriStr = props.uri as string | undefined;
    const kind = props.kind as NodeKind;
    const subkind = props.subkind as string | undefined;
    const label = props.label as string;
    const alternateLabels = props.alternateLabels as string[] | undefined;
    const description = props.description as string | undefined;
    const status = (props.status as NodeStatus) ?? 'established';
    const createdAtRaw = props.createdAt;
    const updatedAtRaw = props.updatedAt;

    let externalIds: ExternalId[] | undefined;
    if (props.externalIds) {
      try {
        externalIds = JSON.parse(props.externalIds as string) as ExternalId[];
      } catch {
        // Ignore parse errors
      }
    }

    let metadata: NodeMetadata | undefined;
    if (props.metadata) {
      try {
        metadata = JSON.parse(props.metadata as string) as NodeMetadata;
      } catch {
        // Ignore parse errors
      }
    }

    const uri = uriStr
      ? (toAtUri(uriStr) ?? (uriStr as AtUri))
      : (`at://unknown/node/${id}` as AtUri);
    const createdAt = this.parseNeo4jDate(createdAtRaw);
    const updatedAt = updatedAtRaw ? this.parseNeo4jDate(updatedAtRaw) : undefined;

    if (!id || !label) {
      throw new DatabaseError(
        'READ',
        `Invalid node: missing required properties. Got: ${JSON.stringify(props)}`
      );
    }

    return {
      id,
      uri,
      kind: kind ?? 'type',
      subkind,
      label,
      alternateLabels,
      description,
      externalIds,
      metadata,
      status,
      createdAt,
      updatedAt,
    };
  }

  /**
   * Map Neo4j edge to GraphEdge.
   */
  private mapNeo4jEdge(edge: Neo4jEdge, sourceUri: string, targetUri: string): GraphEdge {
    const props = edge.properties ?? edge;

    const id = (props.id as string) ?? `edge-${Date.now()}`;
    const uri = (props.uri as AtUri) ?? (`at://unknown/edge/${id}` as AtUri);
    const relationSlug = props.relationSlug as RelationshipSlug;
    const weight = props.weight as number | undefined;
    const status = (props.status as 'proposed' | 'established' | 'deprecated') ?? 'established';
    const createdAtRaw = props.createdAt;

    const createdAt = this.parseNeo4jDate(createdAtRaw ?? Date.now());

    return {
      id,
      uri,
      sourceUri: sourceUri as AtUri,
      targetUri: targetUri as AtUri,
      relationSlug,
      weight,
      status,
      createdAt,
    };
  }

  /**
   * Map Neo4j proposal to NodeProposal.
   */
  private mapNeo4jProposal(proposal: Neo4jProposal): NodeProposal {
    const props = proposal.properties ?? proposal;

    const uriVal = props.uri as string | undefined;
    const id = (props.id as string) ?? uriVal?.split('/').pop() ?? '';
    const uri = props.uri as AtUri;
    const proposalType = props.proposalType as 'create' | 'update' | 'merge' | 'deprecate';
    const kind = props.kind as NodeKind;
    const subkind = props.subkind as string | undefined;
    const targetUri = props.targetUri as AtUri | undefined;
    const rationale = props.rationale as string;
    const status = props.status as ProposalStatus;
    const proposerDidStr = props.proposerDid as string;
    const createdAtRaw = props.createdAt;

    let proposedNode: Partial<GraphNode> | undefined;
    if (props.proposedNode) {
      try {
        proposedNode = JSON.parse(props.proposedNode as string) as Partial<GraphNode>;
      } catch {
        // Ignore parse errors
      }
    }

    const proposerDid = toDID(proposerDidStr);
    if (!proposerDid) {
      throw new DatabaseError('READ', `Invalid DID in proposal: ${proposerDidStr}`);
    }

    const createdAt = createdAtRaw instanceof Date ? createdAtRaw : new Date(String(createdAtRaw));

    return {
      id,
      uri,
      proposalType,
      kind,
      subkind,
      targetUri,
      proposedNode,
      rationale,
      status,
      proposerDid,
      createdAt,
    };
  }

  /**
   * Map Neo4j vote to Vote.
   */
  private mapNeo4jVote(vote: Neo4jVote): Vote {
    const props = vote.properties ?? vote;

    const uriVal = props.uri as string | undefined;
    const id = (props.id as string) ?? uriVal?.split('/').pop() ?? '';
    const uri = props.uri as AtUri;
    const proposalUri = props.proposalUri as AtUri;
    const voterDidStr = props.voterDid as string;
    const voterRole = props.voterRole as UserRole;
    const voteValue = props.vote as VoteType;
    const comment = props.comment as string | undefined;
    const createdAtRaw = props.createdAt;

    const voterDid = toDID(voterDidStr);
    if (!voterDid) {
      throw new DatabaseError('READ', `Invalid DID in vote: ${voterDidStr}`);
    }

    const createdAt = createdAtRaw instanceof Date ? createdAtRaw : new Date(String(createdAtRaw));

    return {
      id,
      uri,
      proposalUri,
      voterDid,
      voterRole,
      vote: voteValue,
      comment,
      createdAt,
    };
  }
}

/**
 * Neo4j node structure.
 */
interface Neo4jNode {
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Neo4j edge structure.
 */
interface Neo4jEdge {
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Neo4j proposal structure.
 */
interface Neo4jProposal {
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Neo4j vote structure.
 */
interface Neo4jVote {
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}
