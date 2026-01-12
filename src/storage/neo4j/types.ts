/**
 * Type definitions for Neo4j knowledge graph operations.
 *
 * This file provides strongly-typed interfaces for all graph operations,
 * avoiding the use of `any` or `unknown` types.
 */

import type { DID, AtUri } from '../../types/atproto.js';

/**
 * Facet dimension types (PMEST + FAST)
 */
export type FacetType =
  | 'personality'
  | 'matter'
  | 'energy'
  | 'space'
  | 'time'
  | 'person'
  | 'organization'
  | 'event'
  | 'work'
  | 'form-genre';

/**
 * Array of all valid facet types.
 *
 * @remarks
 * This constant provides a single source of truth for all facet types,
 * enabling runtime validation without duplicating the list across the codebase.
 *
 * @public
 */
export const FACET_TYPES: readonly FacetType[] = [
  'personality',
  'matter',
  'energy',
  'space',
  'time',
  'person',
  'organization',
  'event',
  'work',
  'form-genre',
] as const;

/**
 * Relationship types between nodes
 */
export type RelationshipType =
  | 'SUBFIELD_OF'
  | 'BROADER_THAN'
  | 'NARROWER_THAN'
  | 'RELATED_TO'
  | 'EXACT_MATCH'
  | 'CLOSE_MATCH'
  | 'BROAD_MATCH'
  | 'NARROW_MATCH'
  | 'INTERDISCIPLINARY_WITH'
  | 'USE_INSTEAD'
  | 'VARIANT_OF'
  | 'AUTHORIZED_FORM_OF'
  | 'CHILD_OF'
  | 'FACET_VALUE'
  | 'HAS_AUTHORITY'
  | 'CLASSIFIED_AS'
  | 'AUTHORED_BY'
  | 'ENDORSES'
  | 'CITES'
  | 'TAGGED_WITH'
  | 'COLLABORATES_WITH'
  | 'EXPERT_IN';

/**
 * Proposal types for graph modifications
 */
export type ProposalType = 'create' | 'modify' | 'merge' | 'deprecate';

/**
 * Proposal status
 */
export type ProposalStatus =
  | 'pending'
  | 'in-discussion'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'needs-changes';

/**
 * User roles for moderation
 */
export type UserRole =
  | 'community-member'
  | 'trusted-editor'
  | 'authority-editor'
  | 'domain-expert'
  | 'administrator';

/**
 * Vote type
 */
export type VoteType = 'approve' | 'reject' | 'abstain' | 'request-changes';

/**
 * Authority record status
 */
export type AuthorityStatus = 'draft' | 'established' | 'deprecated';

/**
 * Match type for external mappings
 */
export type MatchType =
  | 'exact-match'
  | 'close-match'
  | 'broad-match'
  | 'narrow-match'
  | 'related-match';

/**
 * Field node in the knowledge graph
 */
export interface FieldNode {
  id: string;
  uri: AtUri;
  label: string;
  type: 'root' | 'field' | 'subfield' | 'topic';
  description?: string;
  wikidataId?: string;
  level: number;
  materializedPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Authority record (IFLA LRM 2024-2025)
 */
export interface AuthorityRecord {
  id: string;
  uri: AtUri;
  authorizedForm: string;
  variantForms: string[];
  scopeNote?: string;
  status: AuthorityStatus;
  sources: ExternalMapping[];
  appliesTo?: AtUri;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * External mapping to other authority systems
 */
export interface ExternalMapping {
  system: 'wikidata' | 'lcsh' | 'viaf' | 'fast' | 'ror' | 'isni' | 'orcid';
  identifier: string;
  uri?: string;
  matchType: MatchType;
  notes?: string;
  lastSyncedAt?: Date;
  divergence?: string;
}

/**
 * Facet in the 10-dimensional system
 */
export interface Facet {
  id: string;
  uri: AtUri;
  facetType: FacetType;
  value: string;
  level: number;
  materializedPath?: string;
  parentUri?: AtUri;
  authorityRecordUri?: AtUri;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User tag (folksonomy)
 */
export interface UserTag {
  normalizedForm: string;
  rawForm: string;
  usageCount: number;
  uniqueUsers: number;
  paperCount: number;
  qualityScore: number;
  spamScore: number;
  growthRate: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Field proposal
 */
export interface FieldProposal {
  id: string;
  uri: AtUri;
  fieldName: string;
  alternateNames?: string[];
  description: string;
  proposalType: ProposalType;
  existingFieldUri?: AtUri;
  mergeTargetUri?: AtUri;
  externalMappings?: ExternalMapping[];
  authorityRelation?: 'new-authority' | 'variant-of' | 'split-from' | 'merge-of';
  authorityRecordUri?: AtUri;
  rationale: string;
  evidence: EvidenceItem[];
  references?: Reference[];
  discussionUri?: AtUri;
  status: ProposalStatus;
  proposerDid: DID;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Evidence supporting a proposal
 */
export interface EvidenceItem {
  type:
    | 'bibliometric-analysis'
    | 'curriculum-analysis'
    | 'expert-survey'
    | 'usage-patterns'
    | 'wikidata-import'
    | 'literature-review'
    | 'citation-network'
    | 'community-practice'
    | 'historical-precedent';
  description: string;
  sourceUrl?: string;
  confidence: number;
  metrics?: Record<string, number>;
}

/**
 * Reference supporting a proposal
 */
export interface Reference {
  type: 'paper' | 'book' | 'website' | 'dataset' | 'taxonomy-doc';
  identifier: string;
  title?: string;
  description?: string;
}

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
  expertiseFields?: AtUri[];
  rationale?: string;
  createdAt: Date;
}

/**
 * User reputation for moderation
 */
export interface UserReputation {
  did: DID;
  role: UserRole;
  expertiseFields: AtUri[];
  metrics: {
    proposalsCreated: number;
    proposalsApproved: number;
    proposalsRejected: number;
    votesCast: number;
    reviewsWritten: number;
    endorsementsGiven: number;
  };
  reputation: number;
  grantedAt?: Date;
  grantedBy?: DID;
}

/**
 * Consensus calculation result
 */
export interface ConsensusResult {
  reached: boolean;
  approveVotes: number;
  rejectVotes: number;
  abstainVotes: number;
  weightedApprove: number;
  weightedReject: number;
  approvalRatio: number;
  trustedEditorSupport: number;
  adminVetoes: number;
  threshold: number;
  automaticApproval: boolean;
}

/**
 * Consensus thresholds by proposal type
 */
export interface ConsensusThresholds {
  minVotes: number;
  approvalRatio: number;
  trustedEditorSupport: number;
  vetoPower: number;
}

/**
 * Field path from graph traversal
 */
export interface FieldPath {
  distance: number;
  fields: string[];
  relationships: RelationshipType[];
  path: string;
}

/**
 * Field hierarchy structure
 */
export interface FieldHierarchy {
  root: FieldNode;
  children: FieldHierarchy[];
  depth: number;
}

/**
 * Facet tree structure
 */
export interface FacetTree {
  facet: Facet;
  children: FacetTree[];
  depth: number;
  paperCount: number;
}

/**
 * Facet query for filtering
 */
export interface FacetQuery {
  facets: {
    facetType: FacetType;
    value: string;
  }[];
  limit?: number;
  offset?: number;
}

/**
 * Eprint match from faceted search
 */
export interface EprintMatch {
  uri: AtUri;
  title: string;
  matchedFacets: Facet[];
  score: number;
}

/**
 * Facet aggregation result
 */
export interface FacetAggregation {
  facetType: FacetType;
  values: {
    value: string;
    count: number;
    percentage: number;
  }[];
}

/**
 * Proposal filters
 */
export interface ProposalFilters {
  status?: ProposalStatus[];
  proposalType?: ProposalType[];
  proposerDid?: DID;
  fieldUri?: AtUri;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Paginated proposals
 */
export interface PaginatedProposals {
  proposals: FieldProposal[];
  total: number;
  hasMore: boolean;
  offset: number;
}

/**
 * Tag quality metrics
 */
export interface TagQualityMetrics {
  tag: string;
  normalizedForm: string;
  usageCount: number;
  uniqueUsers: number;
  paperCount: number;
  coOccurrencePatterns: Map<string, number>;
  growthRate: number;
  spamScore: number;
  qualitySignals: {
    hasGoodCoOccurrence: boolean;
    diverseUsers: boolean;
    consistentUse: boolean;
    linguisticValidity: boolean;
  };
}

/**
 * Spam detection result
 */
export interface SpamDetection {
  isSpam: boolean;
  signals: string[];
  confidence: number;
  action: 'hidden' | 'allowed' | 'flagged';
}

/**
 * Tag promotion suggestion
 */
export interface TagPromotionSuggestion {
  tag: string;
  targetType: 'facet' | 'field';
  suggestedFacetType?: FacetType;
  metrics: TagQualityMetrics;
  rationale: string;
  autoGenerated: boolean;
  createdAt: Date;
}

/**
 * Wikidata field data
 */
export interface WikidataField {
  qid: string;
  label: string;
  alternateLabels: string[];
  description?: string;
  parentQids?: string[];
  subfields: { qid: string; label: string }[];
  statementCount?: number;
  sitelinkCount?: number;
}

/**
 * Wikidata import record
 */
export interface WikidataImport {
  wikidataId: string;
  chiveNodeUri: AtUri;
  entityType: 'field' | 'concept' | 'person' | 'organization';
  originalData: WikidataField;
  modifications: Modification[];
  importedAt: Date;
}

/**
 * Modification to imported data
 */
export interface Modification {
  field: string;
  action: 'changed' | 'added' | 'removed';
  originalValue?: string;
  newValue?: string;
  rationale: string;
  modifiedAt: Date;
}

/**
 * Field centrality metrics
 */
export interface FieldCentrality {
  fieldUri: AtUri;
  fieldName: string;
  centralityScore: number;
}

/**
 * Field community (cluster)
 */
export interface FieldCommunity {
  communityId: number;
  fields: string[];
  memberCount: number;
}

/**
 * Similar field
 */
export interface SimilarField {
  name: string;
  uri: AtUri;
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
 * Authority variant suggestion
 */
export interface AuthorityVariant {
  primaryUri: AtUri;
  variantUri: AtUri;
  similarityScore: number;
  evidence: string[];
}

/**
 * Authority cluster
 */
export interface AuthorityCluster {
  clusterId: number;
  members: string[];
  uris: AtUri[];
  size: number;
}

/**
 * External mapping suggestion
 */
export interface ExternalMappingSuggestion {
  chiveUri: AtUri;
  externalSystem: 'wikidata' | 'lcsh' | 'viaf' | 'fast';
  externalId: string;
  matchType: MatchType;
  confidence: number;
}
