/**
 * Type re-exports from lexicon-generated client.
 *
 * This file provides convenient type aliases for frontend components,
 * re-exporting types from the lexicon-generated client at `./generated/`.
 */

// Re-export BlobRef from @atproto/lexicon
import { BlobRef } from '@atproto/lexicon';
export { BlobRef };

// Import types for local use in Eprint interface
import type {
  SemanticVersion as _SemanticVersion,
  PublishedVersion as _PublishedVersion,
  RelatedWork as _RelatedWork,
  ExternalIds as _ExternalIds,
  Repositories as _Repositories,
  FundingSource as _FundingSource,
  ConferencePresentation as _ConferencePresentation,
} from './generated/types/pub/chive/eprint/submission.js';

// =============================================================================
// EPRINT TYPES
// =============================================================================

// Eprint submission record
export type { Main as EprintRecord } from './generated/types/pub/chive/eprint/submission.js';
export type {
  SupplementaryItem,
  PublishedVersion,
  RelatedWork,
  ExternalIds as EprintExternalIds,
  Repositories,
  CodeRepository,
  DataRepository,
  Preregistration,
  Protocol,
  Material,
  FundingSource,
  ConferencePresentation,
  SemanticVersion,
} from './generated/types/pub/chive/eprint/submission.js';

// Rich text item types (shared across all content types)
export type {
  TextItem as EprintTextItem,
  NodeRefItem as EprintNodeRefItem,
} from './generated/types/pub/chive/richtext/defs.js';

// Eprint version record (raw lexicon record)
export type { Main as EprintVersionRecord } from './generated/types/pub/chive/eprint/version.js';

// Eprint tag record
export type { Main as UserTagRecord } from './generated/types/pub/chive/eprint/userTag.js';

// Author contribution record
export type { Main as AuthorContribution } from './generated/types/pub/chive/eprint/authorContribution.js';

// getSubmission response
export type {
  OutputSchema as GetSubmissionResponse,
  QueryParams as GetSubmissionParams,
} from './generated/types/pub/chive/eprint/getSubmission.js';

// listByAuthor response
export type {
  OutputSchema as ListByAuthorResponse,
  EprintSummary,
  AuthorRef as EprintAuthorRef,
} from './generated/types/pub/chive/eprint/listByAuthor.js';

// searchSubmissions response
export type {
  OutputSchema as SearchResultsResponse,
  SearchHit,
  HighlightResult,
  FacetAggregation,
  FacetValue as SearchFacetValue,
} from './generated/types/pub/chive/eprint/searchSubmissions.js';

// EprintGetResponse is the full API response wrapper (uri, cid, value, indexedAt, pdsUrl)
import type { OutputSchema as _GetSubmissionResponse } from './generated/types/pub/chive/eprint/getSubmission.js';
export type EprintGetResponse = _GetSubmissionResponse;

/**
 * Enriched author reference for display.
 *
 * @remarks
 * Combines raw record data with resolved author profile information
 * (handle, avatar, display name) from the author's profile.
 */
export interface EprintAuthorView {
  /** Author DID */
  did?: string;
  /** Author display name */
  name: string;
  /** Author handle (resolved from profile) */
  handle?: string;
  /** Author avatar URL (resolved from profile) */
  avatar?: string;
  /** Author display name (resolved from profile) */
  displayName?: string;
  /** ORCID identifier */
  orcid?: string;
  /** Position in author list (1-indexed) */
  order: number;
  /** Author affiliations */
  affiliations?: Array<{
    name: string;
    institutionUri?: string;
    rorId?: string;
    department?: string;
  }>;
  /** CRediT contributions */
  contributions?: Array<{
    typeUri: string;
    typeSlug?: string;
    degreeUri?: string;
    degreeSlug: string;
  }>;
  /** Is corresponding author */
  isCorrespondingAuthor: boolean;
  /** Is highlighted (co-first, co-last) */
  isHighlighted: boolean;
}

/**
 * Enriched field reference for display.
 */
export interface EprintFieldView {
  /** Field AT-URI */
  uri: string;
  /** Field slug for URL routing */
  slug: string;
  /** Field display label */
  label: string;
}

/**
 * Eprint metrics aggregation.
 */
export interface EprintMetricsView {
  /** Total view count */
  views?: number;
  /** Total download count */
  downloads?: number;
  /** Citation count */
  citations?: number;
  /** Endorsement count */
  endorsements?: number;
  /** Review count */
  reviews?: number;
}

/**
 * Version history entry.
 */
export interface EprintVersionView {
  /** Version number (1-indexed) */
  version: number;
  /** Version AT-URI */
  uri: string;
  /** Version CID */
  cid: string;
  /** Document blob reference */
  document?: BlobRef;
  /** Version changelog */
  changelog?: string;
  /** When the version was created */
  createdAt: string;
}

/**
 * EprintVersion is an alias for EprintVersionView for component compatibility.
 */
export type EprintVersion = EprintVersionView;

/**
 * Enriched Eprint view for frontend components.
 *
 * @remarks
 * Combines the raw record content with:
 * - Response metadata (uri, cid, indexedAt, pdsUrl)
 * - Resolved author profiles (handles, avatars)
 * - Resolved field labels
 * - Aggregated metrics
 * - Version history
 *
 * This type matches what the getSubmission API handler actually returns,
 * which includes enrichment beyond the raw lexicon record.
 */
export interface Eprint {
  // Response metadata
  /** AT-URI of the record */
  uri: string;
  /** Content ID of the record */
  cid: string;
  /** When the record was indexed */
  indexedAt: string;
  /** PDS URL for blob access */
  pdsUrl: string;
  /** When the record was last updated */
  updatedAt?: string;

  // Record content (from submission)
  /** $type discriminator */
  $type: 'pub.chive.eprint.submission';
  /** Eprint title */
  title: string;
  /** Plain text abstract for display */
  abstract: string;
  /** Rich abstract items (original from record) */
  abstractItems?: Array<{ type?: string; content?: string; uri?: string; label?: string }>;
  /** Primary manuscript document */
  document: BlobRef;
  /** Document format URI */
  documentFormatUri?: string;
  /** Document format slug */
  documentFormatSlug?: string;
  /** Supplementary materials */
  supplementaryMaterials?: Array<{
    blob: BlobRef;
    label: string;
    description?: string;
    categoryUri?: string;
    categorySlug?: string;
    detectedFormat?: string;
    order?: number;
  }>;
  /** Enriched authors with resolved profiles */
  authors: EprintAuthorView[];
  /** DID of user who submitted */
  submittedBy: string;
  /** DID of paper's own account (if any) */
  paperDid?: string;
  /** Author keywords */
  keywords?: string[];
  /** Field URIs (raw, use fields for enriched) */
  fieldUris?: string[];
  /** Topic URIs */
  topicUris?: string[];
  /** Facet URIs */
  facetUris?: string[];
  /** Semantic version (or legacy number for old records) */
  version?: _SemanticVersion;
  /** Previous version URI */
  previousVersion?: string;
  /** License URI */
  licenseUri?: string;
  /** License slug */
  licenseSlug?: string;
  /** Publication status URI */
  publicationStatusUri?: string;
  /** Publication status slug */
  publicationStatusSlug?: string;
  /** Paper type URI */
  paperTypeUri?: string;
  /** Paper type slug */
  paperTypeSlug?: string;
  /** Published version info */
  publishedVersion?: _PublishedVersion;
  /** Related works */
  relatedWorks?: _RelatedWork[];
  /** External IDs */
  externalIds?: _ExternalIds;
  /** Repositories */
  repositories?: _Repositories;
  /** Funding sources */
  funding?: _FundingSource[];
  /** Conference presentation */
  conferencePresentation?: _ConferencePresentation;
  /** Creation timestamp */
  createdAt: string;

  // Enriched properties
  /** Enriched field references (uses FieldRef from graph API) */
  fields?: Array<{
    id: string;
    uri: string;
    cid?: string;
    kind: 'type' | 'object' | string;
    subkind?: string;
    label: string;
    status: 'proposed' | 'provisional' | 'established' | 'deprecated' | string;
    createdAt: string;
    slug?: string;
  }>;
  /** License display name */
  license?: string;
  /** DOI if available */
  doi?: string;
  /** Publication status (mapped from slug) */
  publicationStatus?:
    | 'eprint'
    | 'preprint'
    | 'under_review'
    | 'revision_requested'
    | 'accepted'
    | 'in_press'
    | 'published'
    | 'retracted';
  /** Aggregated metrics */
  metrics?: EprintMetricsView;
  /** Version history (if multiple versions) */
  versions?: EprintVersionView[];
}

// =============================================================================
// AUTHOR TYPES
// =============================================================================

export type {
  OutputSchema as AuthorProfileResponse,
  AuthorProfile,
  AuthorMetrics,
  Affiliation,
  ResearchKeyword,
} from './generated/types/pub/chive/author/getProfile.js';

// Author search - AuthorSearchResult aliased as Author
export type {
  OutputSchema as SearchAuthorsResponse,
  AuthorSearchResult as Author,
} from './generated/types/pub/chive/author/searchAuthors.js';

// =============================================================================
// REVIEW TYPES
// =============================================================================

// Review comment record
export type { Main as ReviewCommentRecord } from './generated/types/pub/chive/review/comment.js';
export type {
  TextSpanTarget as CommentTextSpanTarget,
  TextQuoteSelector as CommentTextQuoteSelector,
  TextPositionSelector as CommentTextPositionSelector,
  FragmentSelector,
} from './generated/types/pub/chive/review/comment.js';

// These types now come from richtext/defs (shared across all content types)
export type {
  TextItem as ReviewTextItem,
  NodeRefItem as ReviewNodeRefItem,
  EprintRefItem,
} from './generated/types/pub/chive/richtext/defs.js';

// listForEprint response
export type { OutputSchema as ListReviewsResponse } from './generated/types/pub/chive/review/listForEprint.js';

/**
 * ReviewAuthorRef - alias for UnifiedAuthorRef.
 */
export type ReviewAuthorRef = UnifiedAuthorRef;

// listForAuthor response
export type { OutputSchema as ListAuthorReviewsResponse } from './generated/types/pub/chive/review/listForAuthor.js';

// Import specific ReviewView types for unified Review type
import type { ReviewView as _EprintReviewView } from './generated/types/pub/chive/review/listForEprint.js';
import type { ReviewView as _AuthorReviewView } from './generated/types/pub/chive/review/listForAuthor.js';

/**
 * UnifiedAuthorRef - structural type for AuthorRef across endpoints.
 */
export interface UnifiedAuthorRef {
  $type?: string;
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

/**
 * Review - cross-endpoint structural type for review views.
 *
 * @remarks
 * Structural type compatible with ReviewView from listForEprint, listForAuthor,
 * and getThread. The `body` field uses the exact generated body union type from
 * the review endpoints for strict rich text typing.
 *
 * The `$type` fields are relaxed to `string?` because different endpoints emit
 * different discriminator values (e.g. `pub.chive.review.listForEprint#authorRef`
 * vs `pub.chive.review.listForAuthor#authorRef`).
 */
export interface Review {
  $type?: string;
  uri: string;
  cid: string;
  author: UnifiedAuthorRef;
  eprintUri: string;
  eprintTitle?: string;
  content: string;
  body?: _EprintReviewView['body'];
  bodyPlainText?: string;
  target?: UnifiedTextSpanTarget;
  motivation: _EprintReviewView['motivation'];
  parentReviewUri?: string;
  replyCount: number;
  createdAt: string;
  indexedAt: string;
  deleted?: boolean;
}

/**
 * UnifiedTextPositionSelector - structural type for TextPositionSelector.
 *
 * @remarks
 * Omits the $type discriminator for cross-endpoint compatibility.
 */
export interface UnifiedTextPositionSelector {
  $type?: string;
  type: 'TextPositionSelector';
  start: number;
  end: number;
  pageNumber?: number;
}

/**
 * UnifiedTextQuoteSelector - structural type for TextQuoteSelector.
 *
 * @remarks
 * Omits the $type discriminator for cross-endpoint compatibility.
 */
export interface UnifiedTextQuoteSelector {
  $type?: string;
  type: 'TextQuoteSelector';
  exact: string;
  prefix?: string;
  suffix?: string;
}

/**
 * UnifiedTextSpanTarget - structural type for TextSpanTarget across different endpoints.
 *
 * @remarks
 * Uses structural typing with `$type?: string` to be compatible with any endpoint's
 * TextSpanTarget type, regardless of the specific $type discriminator value.
 */
export interface UnifiedTextSpanTarget {
  $type?: string;
  source: string;
  selector?: UnifiedTextQuoteSelector;
  refinedBy?: UnifiedTextPositionSelector;
  page?: number;
}

/**
 * UnifiedByteSlice - structural type for ByteSlice.
 */
export interface UnifiedByteSlice {
  $type?: string;
  byteStart: number;
  byteEnd: number;
}

/**
 * UnifiedRichTextFacet - structural type for RichTextFacet across different endpoints.
 *
 * @remarks
 * Uses structural typing with `$type?: string` to be compatible with any endpoint's
 * RichTextFacet type, regardless of the specific $type discriminator value.
 */
export interface UnifiedRichTextFacet {
  $type?: string;
  index: UnifiedByteSlice;
  features: Array<{ $type?: string; did?: string; uri?: string; tag?: string }>;
}

// =============================================================================
// UNIFIED TYPE ALIASES
// =============================================================================

/**
 * TextSpanTarget - alias for UnifiedTextSpanTarget.
 *
 * @remarks
 * Use this type when working with text span targets from any endpoint.
 * It provides structural compatibility across all review endpoints.
 */
export type TextSpanTarget = UnifiedTextSpanTarget;

/**
 * TextQuoteSelector - alias for UnifiedTextQuoteSelector.
 */
export type TextQuoteSelector = UnifiedTextQuoteSelector;

/**
 * TextPositionSelector - alias for UnifiedTextPositionSelector.
 */
export type TextPositionSelector = UnifiedTextPositionSelector;

/**
 * RichTextFacet - alias for UnifiedRichTextFacet.
 */
export type RichTextFacet = UnifiedRichTextFacet;

// getThread response
export type { OutputSchema as ReviewThread } from './generated/types/pub/chive/review/getThread.js';

// Annotation types from generated lexicon types
export type {
  OutputSchema as ListAnnotationsResponse,
  AnnotationView,
  EntityLinkView,
  AuthorRef as AnnotationAuthorRef,
  TextSpanTarget as AnnotationTextSpanTarget,
} from './generated/types/pub/chive/annotation/listForEprint.js';
export type { OutputSchema as AnnotationThread } from './generated/types/pub/chive/annotation/getThread.js';

// W3C Web Annotation motivation type, derived from generated AnnotationView.
import type { AnnotationView as GeneratedAnnotationView } from './generated/types/pub/chive/annotation/listForEprint.js';
export type AnnotationMotivation = GeneratedAnnotationView['motivation'];

// Rich annotation body types for annotation editor
export interface RichAnnotationItem {
  type:
    | 'text'
    | 'nodeRef'
    | 'eprintRef'
    | 'wikidataRef'
    | 'fieldRef'
    | 'facetRef'
    | 'annotationRef'
    | 'authorRef';
  content?: string;
  uri?: string;
  label?: string;
  kind?: 'type' | 'object';
  subkind?: string;
  // For wikidataRef
  qid?: string;
  url?: string;
  // For authorRef
  did?: string;
  handle?: string;
}

export interface RichAnnotationBodyObject {
  type: 'RichText';
  items: RichAnnotationItem[];
  format: string;
}

export type RichAnnotationBody = RichAnnotationBodyObject | RichAnnotationItem[];

// =============================================================================
// ENDORSEMENT TYPES
// =============================================================================

export type { Main as EndorsementRecord } from './generated/types/pub/chive/review/endorsement.js';

/**
 * Contribution type for endorsements, derived from generated EndorsementView.
 *
 * @remarks
 * Union of known contribution types that align with CRediT taxonomy.
 * Includes `(string & {})` for forward compatibility with new types
 * added to the knowledge graph.
 */
import type { EndorsementView as GeneratedEndorsementView } from './generated/types/pub/chive/endorsement/listForEprint.js';
export type ContributionType = GeneratedEndorsementView['contributions'][number];

export type {
  OutputSchema as ListEndorsementsResponse,
  EndorsementView as Endorsement,
  EndorsementSummary,
  AuthorRef as EndorsementAuthorRef,
} from './generated/types/pub/chive/endorsement/listForEprint.js';

/**
 * Map of contribution type slug to endorsement count.
 *
 * @remarks
 * The lexicon defines this as an open object for forward compatibility.
 * This type provides proper typing for known contribution types while
 * allowing additional types via index signature.
 */
export type EndorsementCountByType = {
  $type?: 'pub.chive.endorsement.listForEprint#endorsementCountByType';
} & Partial<Record<ContributionType, number>> & {
    [key: string]: number | string | undefined;
  };

export type { OutputSchema as EndorsementSummaryResponse } from './generated/types/pub/chive/endorsement/getSummary.js';

export type { OutputSchema as GetUserEndorsementResponse } from './generated/types/pub/chive/endorsement/getUserEndorsement.js';

// =============================================================================
// KNOWLEDGE GRAPH TYPES
// =============================================================================

// Node record
export type { Main as NodeRecord } from './generated/types/pub/chive/graph/node.js';
export type { ExternalId, NodeMetadata } from './generated/types/pub/chive/graph/node.js';

// Edge record
export type { Main as EdgeRecord } from './generated/types/pub/chive/graph/edge.js';

// Node proposal record
export type { Main as NodeProposalRecord } from './generated/types/pub/chive/graph/nodeProposal.js';

// Edge proposal record
export type { Main as EdgeProposalRecord } from './generated/types/pub/chive/graph/edgeProposal.js';

// Vote record
export type { Main as VoteRecord } from './generated/types/pub/chive/graph/vote.js';

// getNode response
export type {
  OutputSchema as GetNodeResponse,
  NodeWithEdges,
  GraphEdge,
} from './generated/types/pub/chive/graph/getNode.js';

/**
 * FieldSummary - enriched field summary for display components.
 *
 * @remarks
 * This extends NodeWithEdges with display-specific counts that are
 * computed by the AppView and not part of the raw node record.
 */
export interface FieldSummary {
  /** Node UUID identifier */
  id: string;
  /** AT-URI of the node */
  uri: string;
  /** Primary display label */
  label: string;
  /** Detailed description */
  description?: string;
  /** Lifecycle status */
  status: 'proposed' | 'provisional' | 'established' | 'deprecated' | string;
  /** Number of eprints tagged with this field (computed) */
  eprintCount?: number;
  /** Number of child fields (computed) */
  childCount?: number;
}

/**
 * FieldDetail - full field details for field detail pages.
 *
 * @remarks
 * This includes all FieldSummary properties plus relationships,
 * external IDs, and hierarchy information.
 */
export interface FieldDetail extends FieldSummary {
  /** External identifier mappings (Wikidata, LCSH, etc.) */
  externalIds?: Array<{
    system: string;
    identifier: string;
    uri?: string;
  }>;
  /** Related field connections */
  relationships?: FieldRelationship[];
  /** Child field references */
  children?: Array<{
    id: string;
    uri: string;
    label: string;
  }>;
  /** Ancestor field references (path to root) */
  ancestors?: Array<{
    id: string;
    uri: string;
    label: string;
  }>;
}

// listNodes response - GraphNode aliased as FieldRef
export type {
  OutputSchema as ListNodesResponse,
  GraphNode as FieldRef,
} from './generated/types/pub/chive/graph/listNodes.js';

// searchNodes response
export type { OutputSchema as SearchNodesResponse } from './generated/types/pub/chive/graph/searchNodes.js';

// getRelations response
export type {
  OutputSchema as GetRelationsResponse,
  RelationType,
} from './generated/types/pub/chive/graph/getRelations.js';

/**
 * FieldRelationship - semantic relationship between fields.
 *
 * @remarks
 * This type is used by field display components to show how fields
 * relate to each other (broader, narrower, related, equivalent, influences).
 * This is distinct from RelationType which defines the relation types available.
 */
export interface FieldRelationship {
  /** Relationship type */
  type: 'broader' | 'narrower' | 'related' | 'equivalent' | 'influences';
  /** Target field ID */
  targetId: string;
  /** Target field display label */
  targetLabel: string;
  /** Relationship strength (0-1) */
  strength?: number;
}

// browseFaceted response - FacetDefinition aliased as FacetDimension
export type {
  OutputSchema as BrowseFacetedResponse,
  FacetDefinition as FacetDimension,
  FacetValue,
  EprintSummary as BrowseEprintSummary,
  FieldRef as BrowseFieldRef,
  SourceInfo,
} from './generated/types/pub/chive/graph/browseFaceted.js';

// =============================================================================
// TAG TYPES
// =============================================================================

// UserTag - individual user-applied tag on an eprint
export type {
  OutputSchema as EprintTagsResponse,
  UserTag,
  TagSuggestion,
  AuthorRef as TagAuthorRef,
} from './generated/types/pub/chive/tag/listForEprint.js';

// Alias for backwards compatibility
export type { OutputSchema as ListTagsResponse } from './generated/types/pub/chive/tag/listForEprint.js';

// TagSummary - aggregated tag information from getDetail
export type {
  OutputSchema as TagDetailResponse,
  PromotionTarget,
} from './generated/types/pub/chive/tag/getDetail.js';

// Import specific TagSummary types for re-export
import type { TagSummary as _DetailTagSummary } from './generated/types/pub/chive/tag/getDetail.js';
import type { TagSummary as _SearchTagSummary } from './generated/types/pub/chive/tag/search.js';
import type { TagSummary as _TrendingTagSummary } from './generated/types/pub/chive/tag/getTrending.js';

/**
 * TagSummary - structural type for tag summary information.
 *
 * @remarks
 * This type is a union of all TagSummary types from different endpoints
 * (getDetail, search, getTrending) that have identical shapes but different
 * `$type` discriminators. Components should use this type for compatibility.
 */
export type TagSummary = _DetailTagSummary | _SearchTagSummary | _TrendingTagSummary;

// Trending tags response
export type { OutputSchema as TrendingTagsResponse } from './generated/types/pub/chive/tag/getTrending.js';

// Tag search response
export type { OutputSchema as TagSearchResponse } from './generated/types/pub/chive/tag/search.js';

// List eprints by tag response
export type {
  OutputSchema as TagEprintsResponse,
  EprintSummary as TagEprintSummary,
  AuthorSummary as TagEprintAuthorSummary,
} from './generated/types/pub/chive/tag/listEprints.js';

// =============================================================================
// DISCOVERY TYPES
// =============================================================================

export type {
  OutputSchema as GetSimilarResponse,
  RelatedEprint,
} from './generated/types/pub/chive/discovery/getSimilar.js';

export type {
  OutputSchema as GetCitationsResponse,
  Citation as CitationRelationship,
  CitationCounts,
} from './generated/types/pub/chive/discovery/getCitations.js';

export type {
  OutputSchema as GetEnrichmentResponse,
  EnrichmentData,
  Concept as EnrichmentConcept,
  Topic as EnrichmentTopic,
} from './generated/types/pub/chive/discovery/getEnrichment.js';

// Discovery settings record
export type { Main as DiscoverySettingsRecord } from './generated/types/pub/chive/discovery/settings.js';
export type {
  RelatedPapersSignals,
  RelatedPapersWeights,
  RelatedPapersThresholds,
  TrendingPreferences,
} from './generated/types/pub/chive/discovery/settings.js';

// CitationNetworkDisplay is a literal type from the settings
export type CitationNetworkDisplay = 'hidden' | 'preview' | 'expanded';

// =============================================================================
// METRICS TYPES
// =============================================================================

// OutputSchema aliased as EprintMetrics
export type { OutputSchema as EprintMetrics } from './generated/types/pub/chive/metrics/getMetrics.js';

export type { OutputSchema as GetViewCountResponse } from './generated/types/pub/chive/metrics/getViewCount.js';

// Trending eprints types
export type {
  OutputSchema as GetTrendingResponse,
  OutputSchema as GetTrendingMetricsResponse,
  TrendingEntry,
  TrendingEntry as TrendingEprint,
  AuthorRef as TrendingAuthorRef,
  FieldRef as TrendingFieldRef,
  SourceInfo as TrendingSourceInfo,
  EprintMetrics as TrendingEprintMetrics,
} from './generated/types/pub/chive/metrics/getTrending.js';

// =============================================================================
// GOVERNANCE TYPES
// =============================================================================

export type {
  OutputSchema as GetProposalResponse,
  ProposalView as Proposal,
} from './generated/types/pub/chive/governance/getProposal.js';

export type {
  OutputSchema as ListProposalsResponse,
  QueryParams as ListProposalsParams,
} from './generated/types/pub/chive/governance/listProposals.js';

// Alias for compatibility with use-governance hook
import type { OutputSchema as _ProposalsResponse } from './generated/types/pub/chive/governance/listProposals.js';
export type ProposalsResponse = _ProposalsResponse;

// Proposal status type, derived from generated ProposalView.
import type { ProposalView as _ProposalView } from './generated/types/pub/chive/governance/listProposals.js';
export type ProposalStatus = _ProposalView['status'];

// Proposal type, derived from generated ProposalView.
export type ProposalType = _ProposalView['type'];

// Proposal category - node or edge for knowledge graph proposals
export type ProposalCategory = 'node' | 'edge';

// Export proposal-related types
export type {
  ProposalChanges,
  VoteCounts,
  ConsensusProgress,
} from './generated/types/pub/chive/governance/getProposal.js';

// Vote types
export type {
  OutputSchema as VotesResponse,
  VoteView as Vote,
} from './generated/types/pub/chive/governance/listVotes.js';

// Vote action types, derived from generated VoteView.
import type { VoteView as _VoteView } from './generated/types/pub/chive/governance/listVotes.js';
export type VoteAction = _VoteView['vote'];

/**
 * Vote value is an alias for VoteAction.
 */
export type VoteValue = VoteAction;

/**
 * Governance role types.
 *
 * @remarks
 * Uses string index signature for compatibility with lexicon's open union types
 * which include `(string & {})` for forward compatibility.
 */
export type GovernanceRole =
  | 'community-member'
  | 'trusted-editor'
  | 'graph-editor'
  | 'domain-expert'
  | 'administrator'
  | (string & {});

/**
 * Voter role types (alias for GovernanceRole).
 */
export type VoterRole = GovernanceRole;

// Editor status - re-export from generated types
export type {
  EditorStatus,
  ReputationMetrics,
} from './generated/types/pub/chive/governance/getEditorStatus.js';

// Trusted editors list
export type {
  OutputSchema as ListTrustedEditorsResponse,
  TrustedEditor as TrustedEditorRecord,
} from './generated/types/pub/chive/governance/listTrustedEditors.js';

// Elevation requests
export type {
  OutputSchema as ElevationRequestsResponse,
  ElevationRequest,
} from './generated/types/pub/chive/governance/listElevationRequests.js';

// Elevation approval input
export type { InputSchema as ApproveElevationInput } from './generated/types/pub/chive/governance/approveElevation.js';

// Elevation rejection input
export type { InputSchema as RejectElevationInput } from './generated/types/pub/chive/governance/rejectElevation.js';

/**
 * Unified ElevationResult type.
 *
 * @remarks
 * Multiple governance endpoints return ElevationResult with different $type discriminators.
 * This unified type accepts any of them for compatibility.
 */
export interface ElevationResult {
  $type?:
    | 'pub.chive.governance.approveElevation#elevationResult'
    | 'pub.chive.governance.rejectElevation#elevationResult'
    | 'pub.chive.governance.requestElevation#elevationResult'
    | 'pub.chive.governance.revokeRole#elevationResult';
  /** Whether the operation succeeded */
  success: boolean;
  /** Request ID (if applicable) */
  requestId?: string;
  /** Human-readable result message */
  message: string;
}

// Delegations
export type {
  OutputSchema as DelegationsResponse,
  Delegation as DelegationRecord,
} from './generated/types/pub/chive/governance/listDelegations.js';

/**
 * Unified DelegationResult type.
 *
 * @remarks
 * Multiple governance endpoints return DelegationResult with different $type discriminators.
 * This unified type accepts any of them for compatibility.
 */
export interface DelegationResult {
  $type?:
    | 'pub.chive.governance.grantDelegation#delegationResult'
    | 'pub.chive.governance.revokeDelegation#delegationResult';
  /** Whether the operation succeeded */
  success: boolean;
  /** Delegation ID */
  delegationId?: string;
  /** Human-readable result message */
  message: string;
}

// =============================================================================
// CLAIMING TYPES
// =============================================================================

export type { OutputSchema as GetClaimResponse } from './generated/types/pub/chive/claiming/getClaim.js';

export type {
  OutputSchema as GetCoauthorRequestsResponse,
  CoauthorRequest as CoauthorClaimRequest,
} from './generated/types/pub/chive/claiming/getCoauthorRequests.js';

export type { OutputSchema as GetSuggestionsResponse } from './generated/types/pub/chive/claiming/getSuggestions.js';

export type { OutputSchema as FindClaimableResponse } from './generated/types/pub/chive/claiming/findClaimable.js';

// =============================================================================
// ALPHA TYPES
// =============================================================================

export type { OutputSchema as AlphaStatusResponse } from './generated/types/pub/chive/alpha/checkStatus.js';

export type {
  InputSchema as AlphaApplyInput,
  OutputSchema as AlphaApplyResponse,
  Affiliation as AlphaAffiliation,
  ResearchKeyword as AlphaResearchKeyword,
} from './generated/types/pub/chive/alpha/apply.js';

// Organization/sector type for alpha application, derived from generated InputSchema.
import type { InputSchema as _AlphaApplyInput } from './generated/types/pub/chive/alpha/apply.js';
export type AlphaSector = _AlphaApplyInput['sector'];

// Career stage for alpha application, derived from generated InputSchema.
export type AlphaCareerStage = _AlphaApplyInput['careerStage'];

/**
 * Alpha application status.
 */
export type AlphaApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected';

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export type {
  OutputSchema as ListReviewsOnMyPapersResponse,
  ReviewNotification,
} from './generated/types/pub/chive/notification/listReviewsOnMyPapers.js';

// Alias for backwards compatibility
export type { OutputSchema as ReviewNotificationsResponse } from './generated/types/pub/chive/notification/listReviewsOnMyPapers.js';

export type {
  OutputSchema as ListEndorsementsOnMyPapersResponse,
  EndorsementNotification,
} from './generated/types/pub/chive/notification/listEndorsementsOnMyPapers.js';

// Alias for backwards compatibility
export type { OutputSchema as EndorsementNotificationsResponse } from './generated/types/pub/chive/notification/listEndorsementsOnMyPapers.js';

// =============================================================================
// ACTOR TYPES
// =============================================================================

export type { Main as ActorProfileRecord } from './generated/types/pub/chive/actor/profile.js';

export type { OutputSchema as GetMyProfileResponse } from './generated/types/pub/chive/actor/getMyProfile.js';

export type { OutputSchema as GetDiscoverySettingsResponse } from './generated/types/pub/chive/actor/getDiscoverySettings.js';

// =============================================================================
// COMPONENT-SPECIFIC TYPES
// =============================================================================

/**
 * EprintAuthor - enriched author type for display components.
 *
 * @remarks
 * This is the full author type with all display properties, used by
 * author-chip and other components. Different from AuthorRef which is
 * a leaner reference type.
 */
export type EprintAuthor = EprintAuthorView;

// Re-export GraphNode for field badges
export type { GraphNode } from './generated/types/pub/chive/graph/listNodes.js';

// backlink types
export type {
  OutputSchema as ListBacklinksResponse,
  Backlink,
} from './generated/types/pub/chive/backlink/list.js';
export type { OutputSchema as BacklinkCounts } from './generated/types/pub/chive/backlink/getCounts.js';

// changelog types
export type {
  OutputSchema as ListChangelogsResponse,
  ChangelogView,
} from './generated/types/pub/chive/eprint/listChangelogs.js';

// Import types for EprintCardData union
import type { TrendingEntry as _TrendingEntry } from './generated/types/pub/chive/metrics/getTrending.js';
import type { EprintSummary as _EprintSummary } from './generated/types/pub/chive/eprint/listByAuthor.js';

/**
 * EprintCardData - union type for data that can be displayed in EprintCard.
 *
 * @remarks
 * The EprintCard component can display data from different API responses:
 * - TrendingEntry (from metrics/getTrending) - rich, for trending pages
 * - EprintSummary (from eprint/listByAuthor) - lean, for author pages
 *
 * Components should handle optional properties gracefully.
 */
export type EprintCardData = _TrendingEntry | _EprintSummary;

// =============================================================================
// REVIEW THREAD TYPES
// =============================================================================

// Use UnifiedRichTextFacet for the converter function (defined above in REVIEW TYPES section)

/**
 * Frontend ReviewThread structure for threaded comments.
 *
 * @remarks
 * This type is used by review-list.tsx and review-thread.tsx to build
 * threaded comment trees. It differs from the API's ReviewThread (getThread.OutputSchema)
 * which has a flat list of replies.
 */
export interface FrontendReviewThread {
  /** Parent review */
  parent: Review;
  /** Nested reply threads */
  replies: FrontendReviewThread[];
  /** Total number of replies */
  totalReplies: number;
}

// Re-export the API ReviewThread as well for use in hooks
// The API returns OutputSchema from getThread with parent: ReviewView, replies: ReviewView[]

// =============================================================================
// SEARCH RESULT TYPES
// =============================================================================

/**
 * Enriched search hit for display in search results.
 *
 * @remarks
 * The API enriches SearchHit with additional eprint data for display.
 * This type reflects what the API actually returns, beyond the base lexicon.
 */
export interface EnrichedSearchHit {
  /** AT-URI of the matched eprint */
  uri: string;
  /** Relevance score */
  score: number;
  /** Search highlights */
  highlight?: {
    title?: string[];
    abstract?: string[];
  };
  /** Eprint title (enriched) */
  title?: string;
  /** Eprint abstract (enriched) */
  abstract?: string;
  /** Authors (enriched) */
  authors?: Array<{
    did?: string;
    name?: string;
    handle?: string;
  }>;
  /** Fields (enriched) */
  fields?: Array<{
    uri: string;
    label: string;
  }>;
  /** Creation date (enriched) */
  createdAt?: string;
  /** Index date (enriched) */
  indexedAt?: string;
}

// =============================================================================
// RICH TEXT FACET TYPES
// =============================================================================

/**
 * ATProto-style facet for RichTextRenderer.
 *
 * @remarks
 * This type is compatible with both the API's RichTextFacet and
 * the RichTextRenderer's expected Facet type.
 */
export interface Facet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: FacetFeature[];
}

/**
 * Facet feature types.
 */
export type FacetFeature =
  | { $type: 'app.bsky.richtext.facet#mention'; did: string }
  | { $type: 'app.bsky.richtext.facet#link'; uri: string }
  | { $type: 'app.bsky.richtext.facet#tag'; tag: string };

/**
 * Converts RichTextFacet from the API to Facet for RichTextRenderer.
 *
 * @remarks
 * The API returns RichTextFacet with $type discriminators from our lexicons,
 * but RichTextRenderer expects ATProto's standard facet $type values.
 * Accepts UnifiedRichTextFacet for compatibility across endpoints.
 */
export function convertRichTextFacetsToFacets(
  richTextFacets: UnifiedRichTextFacet[] | undefined
): Facet[] | undefined {
  if (!richTextFacets) return undefined;

  return richTextFacets.map((rtf) => ({
    index: {
      byteStart: rtf.index.byteStart,
      byteEnd: rtf.index.byteEnd,
    },
    features: rtf.features
      .map((f): FacetFeature | null => {
        // Map our lexicon $types to ATProto standard $types
        // Check for defined values before returning
        if ('did' in f && f.did) {
          return { $type: 'app.bsky.richtext.facet#mention' as const, did: f.did };
        }
        if ('uri' in f && f.uri) {
          return { $type: 'app.bsky.richtext.facet#link' as const, uri: f.uri };
        }
        if ('tag' in f && f.tag) {
          return { $type: 'app.bsky.richtext.facet#tag' as const, tag: f.tag };
        }
        // Unknown or incomplete feature type
        return null;
      })
      .filter((f): f is FacetFeature => f !== null),
  }));
}

// =============================================================================
// SCHEMA COMPATIBILITY TYPES
// =============================================================================

/**
 * Schema hints from API responses.
 *
 * @remarks
 * These hints are included in the `_schemaHints` field of API responses
 * when a record uses deprecated formats. They inform clients about available
 * migrations without breaking backward compatibility.
 *
 * This mirrors the backend `ApiSchemaHints` type from `src/types/schema-compatibility.ts`.
 */
export interface ApiSchemaHints {
  /** Schema version string (e.g., "0.1.0") */
  schemaVersion?: string;
  /** List of field names using deprecated formats */
  deprecatedFields?: readonly string[];
  /** Whether a migration is available */
  migrationAvailable?: boolean;
  /** URL to migration documentation */
  migrationUrl?: string;
}

// =============================================================================
// FRONTEND-ONLY TYPES
// =============================================================================

/**
 * ATProto source information for transparency display.
 *
 * @remarks
 * This type is used by frontend components to display where eprint data
 * originates from (the user's Personal Data Server). It enables users to
 * verify data at its source for ATProto compliance.
 */
export interface EprintSource {
  /** PDS endpoint URL */
  pdsEndpoint: string;
  /** AT-URI of the original record */
  recordUrl: string;
  /** Whether the indexed data may be outdated compared to the source PDS */
  stale?: boolean;
  /** When the data was last verified against the source PDS */
  lastVerifiedAt?: string;
}

/**
 * Entity link types for annotation entity references.
 *
 * @remarks
 * Used by the EntityLinkDialog and annotation system to create
 * structured references to various entity types.
 */
export type EntityLinkType =
  | { type: 'wikidata'; qid: string; label: string; url: string }
  | { type: 'nodeRef'; uri: string; label: string; subkind?: string }
  | { type: 'field'; uri: string; label: string }
  | { type: 'author'; did: string; label?: string; handle?: string }
  | { type: 'eprint'; uri: string; label?: string }
  | { type: 'fast'; uri: string; label: string }
  | { type: 'orcid'; did: string; label?: string; handle?: string };
