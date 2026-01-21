/**
 * Type definitions for Neo4j knowledge graph operations.
 *
 * This file provides strongly-typed interfaces for the unified node/edge model.
 *
 * @packageDocumentation
 */

import type { DID, AtUri } from '../../types/atproto.js';

/**
 * Node kind - distinguishes classifications from instances
 */
export type NodeKind = 'type' | 'object';

/**
 * Node status in the governance lifecycle
 */
export type NodeStatus = 'proposed' | 'provisional' | 'established' | 'deprecated';

/**
 * Edge status
 */
export type EdgeStatus = 'proposed' | 'established' | 'deprecated';

/**
 * External identifier system
 */
export type ExternalIdSystem =
  | 'wikidata'
  | 'ror'
  | 'orcid'
  | 'isni'
  | 'viaf'
  | 'lcsh'
  | 'fast'
  | 'credit'
  | 'spdx'
  | 'fundref'
  | 'mesh'
  | 'aat'
  | 'gnd'
  | 'anzsrc';

/**
 * SKOS match type for external ID mapping
 */
export type SkosMatchType = 'exact' | 'close' | 'broader' | 'narrower' | 'related';

/**
 * External identifier mapping
 */
export interface ExternalId {
  system: ExternalIdSystem;
  identifier: string;
  uri?: string;
  matchType?: SkosMatchType;
}

/**
 * Subkind-specific metadata for nodes
 */
export interface NodeMetadata {
  /** ISO 3166-1 alpha-2 country code (for institutions) */
  country?: string;
  /** City name (for institutions) */
  city?: string;
  /** Official website URL */
  website?: string;
  /** Organization operational status (for institutions) */
  organizationStatus?: 'active' | 'merged' | 'inactive' | 'defunct';
  /** MIME types (for document-format) */
  mimeTypes?: string[];
  /** SPDX license identifier (for licenses) */
  spdxId?: string;
  /** Display order for UI sorting */
  displayOrder?: number;
  /** Slug of inverse relation (for relation types) */
  inverseSlug?: string;
  /** Index signature for extensibility */
  [key: string]: string | string[] | number | undefined;
}

/**
 * Unified graph node representing all knowledge graph entities.
 */
export interface GraphNode {
  /** UUID identifier (used as rkey in AT-URI) */
  id: string;
  /** Human-readable slug identifier */
  slug?: string;
  /** AT-URI of the node */
  uri: AtUri;
  /** Content identifier (CID) when available from ATProto record */
  cid?: string;
  /** Node kind: 'type' for classifications, 'object' for instances */
  kind: NodeKind;
  /** Subkind slug (e.g., 'field', 'institution', 'contribution-type') */
  subkind?: string;
  /** AT-URI of the subkind type node */
  subkindUri?: AtUri;
  /** Primary display label */
  label: string;
  /** Alternate labels, synonyms, translations */
  alternateLabels?: string[];
  /** Detailed description or scope note */
  description?: string;
  /** External identifier mappings */
  externalIds?: ExternalId[];
  /** Subkind-specific metadata */
  metadata?: NodeMetadata;
  /** Lifecycle status */
  status: NodeStatus;
  /** AT-URI of node that supersedes this one */
  deprecatedBy?: AtUri;
  /** AT-URI of proposal that created this node */
  proposalUri?: AtUri;
  /** Creation timestamp */
  createdAt: Date;
  /** DID of creator or governance */
  createdBy?: DID;
  /** Last update timestamp */
  updatedAt?: Date;
}

/**
 * Edge metadata
 */
export interface EdgeMetadata {
  /** Confidence score for automatically inferred edges */
  confidence?: number;
  /** Temporal start for time-bounded relationships */
  startDate?: Date;
  /** Temporal end for time-bounded relationships */
  endDate?: Date;
  /** Source of the relationship assertion */
  source?: string;
}

/**
 * Graph edge representing typed relationships between nodes.
 * Relation types are themselves nodes with subkind=relation.
 */
export interface GraphEdge {
  /** UUID identifier (used as rkey in AT-URI) */
  id: string;
  /** AT-URI of the edge */
  uri: AtUri;
  /** Content identifier (CID) when available from ATProto record */
  cid?: string;
  /** AT-URI of source node */
  sourceUri: AtUri;
  /** AT-URI of target node */
  targetUri: AtUri;
  /** AT-URI of relation type node (subkind=relation) */
  relationUri?: AtUri;
  /** Relation slug for queries (broader, narrower, related, etc.) */
  relationSlug: string;
  /** Optional edge weight for ranking */
  weight?: number;
  /** Edge-specific metadata */
  metadata?: EdgeMetadata;
  /** Edge lifecycle status */
  status: EdgeStatus;
  /** AT-URI of proposal that created this edge */
  proposalUri?: AtUri;
  /** Creation timestamp */
  createdAt: Date;
  /** DID of creator or governance */
  createdBy?: DID;
  /** Last update timestamp */
  updatedAt?: Date;
}

/**
 * Node hierarchy structure for tree views
 */
export interface NodeHierarchy {
  node: GraphNode;
  children: NodeHierarchy[];
  depth: number;
}

/**
 * Node search result
 */
export interface NodeSearchResult {
  nodes: GraphNode[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

/**
 * Edge search result
 */
export interface EdgeSearchResult {
  edges: GraphEdge[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

/**
 * Node creation input
 */
export type NodeInput = Omit<GraphNode, 'createdAt' | 'updatedAt'>;

/**
 * Node update input
 */
export type NodeUpdate = Partial<Omit<GraphNode, 'id' | 'uri' | 'createdAt'>>;

/**
 * Edge creation input
 */
export type EdgeInput = Omit<GraphEdge, 'createdAt' | 'updatedAt'>;

/**
 * Edge update input
 */
export type EdgeUpdate = Partial<
  Omit<GraphEdge, 'id' | 'uri' | 'sourceUri' | 'targetUri' | 'createdAt'>
>;

/**
 * Proposal types for graph modifications
 */
export type ProposalType = 'create' | 'update' | 'merge' | 'deprecate';

/**
 * Proposal status in the governance workflow
 */
export type ProposalStatus =
  | 'pending'
  | 'in-discussion'
  | 'needs-changes'
  | 'approved'
  | 'rejected';

/**
 * User roles for moderation
 */
export type UserRole =
  | 'community-member'
  | 'trusted-editor'
  | 'graph-editor'
  | 'domain-expert'
  | 'administrator';

/**
 * Vote type
 */
export type VoteType = 'approve' | 'reject' | 'abstain' | 'request-changes';

/**
 * Vote on a proposal
 */
export interface Vote {
  id: string;
  uri: AtUri;
  proposalUri: AtUri;
  voterDid: DID;
  voterRole: UserRole;
  vote: VoteType;
  comment?: string;
  createdAt: Date;
}

/**
 * Consensus calculation result
 */
export interface ConsensusResult {
  reached: boolean;
  approveVotes: number;
  rejectVotes: number;
  weightedApprove: number;
  weightedReject: number;
  approvalRatio: number;
  threshold: number;
}

/**
 * Node centrality metrics
 */
export interface NodeCentrality {
  nodeUri: AtUri;
  label: string;
  centralityScore: number;
}

/**
 * Node community (cluster)
 */
export interface NodeCommunity {
  communityId: number;
  nodes: GraphNode[];
  memberCount: number;
}

/**
 * Similar node result
 */
export interface SimilarNode {
  node: GraphNode;
  similarity: number;
}

/**
 * Paper recommendation
 */
export interface PaperRecommendation {
  uri: AtUri;
  title: string;
  score: number;
  reasons: {
    primaryReason: string;
    fieldMatches?: number;
    citationOverlap?: number;
    endorsedBySimilarUsers?: string[];
    trendingInField?: string;
  };
}

/**
 * Trending paper
 */
export interface TrendingPaper {
  uri: AtUri;
  title: string;
  trendingScore: number;
  metrics: {
    endorsements: number;
    citations: number;
    views: number;
  };
}

/**
 * Relationship slug for edges between nodes
 */
export type RelationshipSlug =
  | 'broader'
  | 'narrower'
  | 'related'
  | 'equivalent'
  | 'interdisciplinary-with'
  | 'supersedes'
  | 'superseded-by'
  | 'affiliated-with'
  | 'located-in'
  | 'part-of'
  | 'has-part';

/**
 * Node proposal for graph modifications
 */
export interface NodeProposal {
  id: string;
  uri: AtUri;
  proposalType: ProposalType;
  kind: NodeKind;
  subkind?: string;
  targetUri?: AtUri;
  mergeIntoUri?: AtUri;
  proposedNode?: Partial<GraphNode>;
  rationale: string;
  evidence?: EvidenceItem[];
  status: ProposalStatus;
  proposerDid: DID;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Edge proposal for graph modifications
 */
export interface EdgeProposal {
  id: string;
  uri: AtUri;
  proposalType: ProposalType;
  targetEdgeUri?: AtUri;
  proposedEdge?: Partial<GraphEdge>;
  rationale: string;
  evidence?: EvidenceItem[];
  status: ProposalStatus;
  proposerDid: DID;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Evidence item for proposals
 */
export interface EvidenceItem {
  type: 'url' | 'doi' | 'citation' | 'text';
  value: string;
  description?: string;
}

/**
 * Reference for proposals
 */
export interface Reference {
  type: 'url' | 'doi' | 'isbn' | 'issn';
  value: string;
  title?: string;
}

/**
 * User-generated tag on an eprint
 */
export interface UserTag {
  /** UUID identifier. Optional for aggregate queries. */
  id?: string;
  /** AT-URI of the tag. Optional for aggregate queries. */
  uri?: AtUri;
  /** AT-URI of the eprint. Optional for aggregate queries. */
  eprintUri?: AtUri;
  /** DID of the user who created the tag. Optional for aggregate queries. */
  userDid?: DID;
  /** Display label. Optional for aggregate queries. */
  label?: string;
  rawForm: string;
  normalizedForm: string;
  nodeUri?: AtUri;
  usageCount?: number;
  qualityScore?: number;
  spamScore?: number;
  /** Number of unique users who have used this tag. Computed aggregate. */
  uniqueUsers?: number;
  /** Number of papers tagged with this tag. Computed aggregate. */
  paperCount?: number;
  /** Growth rate of tag usage. Computed aggregate. */
  growthRate?: number;
  createdAt: Date;
}
