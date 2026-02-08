/**
 * Graph database interface for Chive's knowledge graph.
 *
 * @remarks
 * Uses a unified node/edge model where all entities are `GraphNode`
 * distinguished by `kind` (type/object) and `subkind` (field, institution, etc.).
 *
 * @packageDocumentation
 * @public
 */

import type {
  GraphNode,
  GraphEdge,
  NodeKind,
  NodeStatus,
  EdgeStatus,
  NodeProposal,
  Vote,
  ConsensusResult,
  NodeSearchResult,
  NodeHierarchy,
  RelationshipSlug,
  ExternalId,
} from '../../storage/neo4j/types.js';
import type { AtUri, DID } from '../atproto.js';

// Re-export unified types for convenience
export type {
  GraphNode,
  GraphEdge,
  NodeKind,
  NodeStatus,
  NodeProposal,
  EdgeProposal,
  Vote,
  ConsensusResult,
  NodeSearchResult,
  EdgeSearchResult,
  NodeHierarchy,
  RelationshipSlug,
  ExternalId,
} from '../../storage/neo4j/types.js';

/**
 * Input for creating or updating a node.
 */
export interface NodeInput {
  readonly id: string;
  readonly uri?: AtUri;
  readonly kind: NodeKind;
  readonly subkind?: string;
  readonly label: string;
  readonly alternateLabels?: readonly string[];
  readonly description?: string;
  readonly externalIds?: readonly ExternalId[];
  readonly metadata?: Record<string, string | string[] | number | undefined>;
  readonly status: NodeStatus;
}

/**
 * Input for creating an edge between nodes.
 */
export interface EdgeInput {
  readonly id?: string;
  readonly uri?: AtUri;
  readonly sourceUri: AtUri;
  readonly targetUri: AtUri;
  readonly relationUri?: AtUri;
  readonly relationSlug: RelationshipSlug;
  readonly weight?: number;
  readonly metadata?: Record<string, string | number | boolean | undefined>;
  readonly status?: EdgeStatus;
  readonly proposalUri?: AtUri;
  readonly createdBy?: DID;
  readonly createdAt?: Date;
}

/**
 * Facet query filter for searching by dimension/value pairs.
 */
export interface FacetFilter {
  readonly dimension: string;
  readonly value: string;
  /** Node URI if this facet value is linked to a knowledge graph node. */
  readonly nodeUri?: string;
}

/**
 * Facet type alias for facet queries.
 * Facets are nodes with subkind='facet'. This type is for query parameters.
 */
export type Facet = FacetFilter;

/**
 * Node search options.
 */
export interface NodeSearchOptions {
  readonly kind?: NodeKind;
  readonly subkind?: string;
  readonly status?: NodeStatus;
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Proposal search filters.
 */
export interface ProposalFilters {
  readonly status?: readonly string[];
  readonly proposalType?: readonly string[];
  readonly proposerDid?: DID;
  readonly nodeUri?: AtUri;
  readonly subkind?: string;
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
  readonly offset?: number;
  readonly limit?: number;
}

/**
 * Facet aggregation result for a dimension.
 */
export interface FacetAggregation {
  readonly dimension: string;
  readonly values: readonly { value: string; count: number }[];
}

/**
 * Graph database interface for Neo4j.
 *
 * @public
 */
export interface IGraphDatabase {
  /**
   * Upserts a node.
   */
  upsertNode(node: NodeInput): Promise<void>;

  /**
   * Gets a node by URI.
   */
  getNodeByUri(uri: AtUri): Promise<GraphNode | null>;

  /**
   * Gets a node by ID and optional subkind.
   */
  getNode(id: string, subkind?: string): Promise<GraphNode | null>;

  /**
   * Gets multiple nodes by IDs in a single query.
   *
   * @param ids - Node identifiers to fetch
   * @param subkind - Optional subkind filter
   * @returns Map of id to GraphNode (missing nodes are not included)
   */
  getNodesByIds(ids: readonly string[], subkind?: string): Promise<Map<string, GraphNode>>;

  /**
   * Lists nodes with filtering.
   */
  listNodes(options: NodeSearchOptions): Promise<NodeSearchResult>;

  /**
   * Searches nodes by text query.
   */
  searchNodes(query: string, options?: NodeSearchOptions): Promise<NodeSearchResult>;

  /**
   * Creates an edge between nodes.
   */
  createEdge(edge: EdgeInput): Promise<void>;

  /**
   * Gets edges from a node, optionally filtered by relation.
   */
  getEdges(nodeUri: AtUri, relationSlug?: RelationshipSlug): Promise<readonly GraphEdge[]>;

  /**
   * Finds related nodes by traversing edges.
   */
  findRelatedNodes(nodeUri: AtUri, maxDepth?: number): Promise<readonly GraphNode[]>;

  /**
   * Gets node hierarchy for tree views.
   */
  getHierarchy(rootUri: AtUri, maxDepth?: number): Promise<NodeHierarchy>;

  /**
   * Gets ancestor field nodes for multiple field IDs by traversing narrower edges in reverse.
   * Used to expand field hierarchies for search indexing.
   *
   * @param fieldIds - UUIDs of field nodes to get ancestors for
   * @param maxDepth - Maximum hierarchy depth to traverse (default 10)
   * @returns Map of field ID to array of ancestor field nodes (excluding the field itself)
   */
  getFieldAncestors(
    fieldIds: readonly string[],
    maxDepth?: number
  ): Promise<Map<string, readonly GraphNode[]>>;

  /**
   * Queries eprints by facets.
   */
  queryByFacets(facets: readonly FacetFilter[]): Promise<readonly string[]>;

  /**
   * Aggregates facet values with counts.
   */
  aggregateFacets(currentFacets?: readonly FacetFilter[]): Promise<readonly FacetAggregation[]>;

  /**
   * Gets pending proposals for a node.
   */
  getProposalsForNode(nodeUri: AtUri): Promise<readonly NodeProposal[]>;

  /**
   * Lists proposals with filtering.
   */
  listProposals(filters: ProposalFilters): Promise<{
    readonly proposals: readonly NodeProposal[];
    readonly total: number;
    readonly hasMore: boolean;
    readonly offset: number;
  }>;

  /**
   * Gets a proposal by URI.
   */
  getProposal(uri: AtUri): Promise<NodeProposal | null>;

  /**
   * Creates a vote on a proposal.
   */
  createVote(vote: Vote): Promise<void>;

  /**
   * Gets votes for a proposal.
   */
  getVotesForProposal(proposalUri: AtUri): Promise<readonly Vote[]>;

  /**
   * Calculates consensus for a proposal.
   */
  calculateConsensus(proposalUri: AtUri): Promise<ConsensusResult>;

  /**
   * Creates a proposal.
   */
  createProposal(proposal: {
    readonly uri: AtUri;
    readonly proposalType: 'create' | 'update' | 'merge' | 'deprecate';
    readonly kind: NodeKind;
    readonly subkind?: string;
    readonly targetUri?: AtUri;
    readonly proposedNode?: Partial<GraphNode>;
    readonly rationale: string;
    readonly proposerDid: DID;
    readonly createdAt: Date;
  }): Promise<void>;

  /**
   * Deletes a node.
   */
  deleteNode(uri: AtUri): Promise<void>;
}
