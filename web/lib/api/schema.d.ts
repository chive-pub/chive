/**
 * Domain types for the Chive API.
 *
 * @remarks
 * This file extracts domain types from the auto-generated OpenAPI schema using
 * `openapi-typescript-helpers`. This ensures domain types stay in sync with
 * the API specification automatically.
 *
 * **Type Extraction Strategy:**
 * - Use `SuccessResponseJSON` to extract response types from operations
 * - Export type aliases for commonly-used nested types
 * - Never manually define types that duplicate API responses
 *
 * @see {@link https://openapi-ts.dev/openapi-fetch/ | openapi-fetch documentation}
 * @see {@link https://www.npmjs.com/package/openapi-typescript-helpers | openapi-typescript-helpers}
 */

import type { operations } from './schema.generated';
import type { SuccessResponseJSON } from 'openapi-typescript-helpers';

// =============================================================================
// TYPE EXTRACTION FROM OPENAPI SCHEMA
// =============================================================================

// -----------------------------------------------------------------------------
// Preprint Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.preprint.getSubmission */
export type GetPreprintResponse = SuccessResponseJSON<
  operations['pub_chive_preprint_getSubmission']
>;

/** Response from pub.chive.preprint.listByAuthor */
export type ListPreprintsResponse = SuccessResponseJSON<
  operations['pub_chive_preprint_listByAuthor']
>;

/** Response from pub.chive.preprint.searchSubmissions */
export type SearchPreprintsResponse = SuccessResponseJSON<
  operations['pub_chive_preprint_searchSubmissions']
>;

/** Preprint object from API responses */
export type Preprint = GetPreprintResponse['preprint'];

/** Preprint summary in list/search results */
export type PreprintSummary = ListPreprintsResponse['preprints'][number];

// -----------------------------------------------------------------------------
// Author Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.author.getProfile */
export type GetProfileResponse = SuccessResponseJSON<operations['pub_chive_author_getProfile']>;

/** Alias for profile response (used by some hooks) */
export type AuthorProfileResponse = GetProfileResponse;

/** Author profile from API */
export type AuthorProfile = GetProfileResponse['profile'];

/** Author metrics from API */
export type AuthorMetrics = GetProfileResponse['metrics'];

/** Author object embedded in preprint responses */
export type Author = PreprintSummary['author'];

/** Affiliation type */
export type Affiliation = NonNullable<AuthorProfile['affiliations']>[number];

/** Research keyword type */
export type ResearchKeyword = NonNullable<AuthorProfile['researchKeywords']>[number];

// -----------------------------------------------------------------------------
// Tag Types (TaxoFolk)
// -----------------------------------------------------------------------------

/** Response from pub.chive.tag.listForPreprint */
export type PreprintTagsResponse = SuccessResponseJSON<operations['pub_chive_tag_listForPreprint']>;

/** Response from pub.chive.tag.getSuggestions */
export type TagSuggestionsResponse = SuccessResponseJSON<
  operations['pub_chive_tag_getSuggestions']
>;

/** Response from pub.chive.tag.getTrending */
export type TrendingTagsResponse = SuccessResponseJSON<operations['pub_chive_tag_getTrending']>;

/** Response from pub.chive.tag.search */
export type TagSearchResponse = SuccessResponseJSON<operations['pub_chive_tag_search']>;

/** Response from pub.chive.tag.getDetail */
export type TagDetailResponse = SuccessResponseJSON<operations['pub_chive_tag_getDetail']>;

/** User tag on a preprint */
export type UserTag = PreprintTagsResponse['tags'][number];

/** Tag suggestion from TaxoFolk */
export type TagSuggestion = NonNullable<PreprintTagsResponse['suggestions']>[number];

/** Tag summary with stats */
export type TagSummary = TrendingTagsResponse['tags'][number];

/** Tag detail from getDetail endpoint */
export type TagDetail = TagDetailResponse['tag'];

// -----------------------------------------------------------------------------
// Review Types (W3C Web Annotation)
// -----------------------------------------------------------------------------

/** Response from pub.chive.review.listForPreprint */
export type ReviewsResponse = SuccessResponseJSON<operations['pub_chive_review_listForPreprint']>;

/** Response from pub.chive.review.listForAuthor */
export type AuthorReviewsResponse = SuccessResponseJSON<
  operations['pub_chive_review_listForAuthor']
>;

/** Response from pub.chive.review.getThread */
export type ReviewThreadResponse = SuccessResponseJSON<operations['pub_chive_review_getThread']>;

/** Review object from API */
export type Review = ReviewsResponse['reviews'][number];

/**
 * Hierarchical review thread for UI rendering.
 *
 * @remarks
 * The API returns flat replies, but the UI builds a recursive thread structure
 * for nested display. This type represents that hierarchical structure.
 */
export interface ReviewThread {
  /** Parent review in this thread */
  parent: Review;
  /** Nested replies (recursive) */
  replies: ReviewThread[];
  /** Total number of replies in this thread */
  totalReplies: number;
}

/** Text span target for inline annotations */
export type TextSpanTarget = NonNullable<Review['target']>;

/** Text quote selector (primary selector for annotations) */
export type TextQuoteSelectorAPI = NonNullable<TextSpanTarget['selector']>;

/** Text position selector (refinement with position and page info) */
export type TextPositionSelector = NonNullable<TextSpanTarget['refinedBy']>;

/** Annotation motivation types */
export type AnnotationMotivation = Review['motivation'];

/** Rich text body */
export type AnnotationBody = NonNullable<Review['body']>;

/** Rich text facet */
export type AnnotationBodyItem = NonNullable<AnnotationBody['facets']>[number];

/**
 * Entity link types (discriminated union for entity linking).
 *
 * @remarks
 * Used for linking text selections to external entities.
 * This is a frontend-only type for the EntityLinkDialog component.
 */
export type EntityLinkType =
  | { type: 'wikidata'; qid: string; label: string; url: string }
  | { type: 'authority'; uri: string; authorizedForm: string; variantForms: string[] }
  | { type: 'fast'; uri: string; label: string }
  | { type: 'orcid'; did: string; displayName?: string }
  | { type: 'preprint'; uri: string; title: string }
  | { type: 'field'; uri: string; label: string }
  | { type: 'author'; did: string; displayName?: string };

// -----------------------------------------------------------------------------
// Endorsement Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.endorsement.listForPreprint */
export type EndorsementsResponse = SuccessResponseJSON<
  operations['pub_chive_endorsement_listForPreprint']
>;

/** Response from pub.chive.endorsement.getSummary */
export type EndorsementSummary = SuccessResponseJSON<
  operations['pub_chive_endorsement_getSummary']
>;

/** Endorsement object from API */
export type Endorsement = EndorsementsResponse['endorsements'][number];

/** Contribution type (CRediT taxonomy) */
export type ContributionType = Endorsement['contributions'][number];

// -----------------------------------------------------------------------------
// Field/Knowledge Graph Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.graph.getField */
export type GetFieldResponse = SuccessResponseJSON<operations['pub_chive_graph_getField']>;

/** Response from pub.chive.graph.listFields */
export type ListFieldsResponse = SuccessResponseJSON<operations['pub_chive_graph_listFields']>;

/** Response from pub.chive.graph.getFieldPreprints */
export type FieldPreprintsResponse = SuccessResponseJSON<
  operations['pub_chive_graph_getFieldPreprints']
>;

/** Response from pub.chive.graph.browseFaceted */
export type FacetedSearchResponse = SuccessResponseJSON<
  operations['pub_chive_graph_browseFaceted']
>;

/** Preprint summary in faceted browse results */
export type FacetedPreprintSummary = FacetedSearchResponse['hits'][number];

/** Field detail from API */
export type FieldDetail = GetFieldResponse['field'];

/** Field summary in list results */
export type FieldSummary = ListFieldsResponse['fields'][number];

/** Field reference (lightweight) */
export type FieldRef = NonNullable<PreprintSummary['fields']>[number];

/** Field ancestor in hierarchy */
export type FieldAncestor = NonNullable<FieldDetail['ancestors']>[number];

/** Field child in hierarchy */
export type FieldChild = NonNullable<FieldDetail['children']>[number];

/** Field relationship */
export type FieldRelationship = NonNullable<FieldDetail['related']>[number];

/** Alias for list fields response */
export type FieldListResponse = ListFieldsResponse;

/** Facet value from browseFaceted */
export type FacetValue = NonNullable<FacetedSearchResponse['facets']>[string][number];

// -----------------------------------------------------------------------------
// Authority Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.graph.getAuthority */
export type GetAuthorityResponse = SuccessResponseJSON<operations['pub_chive_graph_getAuthority']>;

/** Response from pub.chive.graph.searchAuthorities */
export type SearchAuthoritiesResponse = SuccessResponseJSON<
  operations['pub_chive_graph_searchAuthorities']
>;

/** Response from pub.chive.graph.getAuthorityReconciliations */
export type AuthorityReconciliationsResponse = SuccessResponseJSON<
  operations['pub_chive_graph_getAuthorityReconciliations']
>;

/** Authority record from API */
export type AuthorityRecord = GetAuthorityResponse['authority'];

/** Alias for authority record */
export type Authority = AuthorityRecord;

/** Authority summary in search results */
export type AuthoritySummary = SearchAuthoritiesResponse['authorities'][number];

/** Alias for search response */
export type AuthoritySearchResponse = SearchAuthoritiesResponse;

/** Authority type */
export type AuthorityType = AuthorityRecord['type'];

/** Authority status */
export type AuthorityStatus = AuthorityRecord['status'];

/** Authority reconciliation */
export type AuthorityReconciliation = AuthorityReconciliationsResponse['reconciliations'][number];

/** External ID reference */
export type ExternalId = NonNullable<AuthorityRecord['externalIds']>[number];

// -----------------------------------------------------------------------------
// Search Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.preprint.searchSubmissions */
export type SearchResultsResponse = SearchPreprintsResponse | FacetedSearchResponse;

/** Search hit with score and highlights (extends PreprintSummary) */
export type SearchHit =
  | SearchPreprintsResponse['hits'][number]
  | FacetedSearchResponse['hits'][number];

/** Search highlight for matched text */
export type SearchHighlight = NonNullable<SearchPreprintsResponse['hits'][number]['highlights']>;

// -----------------------------------------------------------------------------
// Claiming Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.claiming.startClaim */
export type StartClaimResponse = SuccessResponseJSON<operations['pub_chive_claiming_startClaim']>;

/** Response from pub.chive.claiming.getClaim */
export type GetClaimResponse = SuccessResponseJSON<operations['pub_chive_claiming_getClaim']>;

/** Response from pub.chive.claiming.getUserClaims */
export type ListClaimsResponse = SuccessResponseJSON<
  operations['pub_chive_claiming_getUserClaims']
>;

/** Response from pub.chive.claiming.findClaimable */
export type FindClaimableResponse = SuccessResponseJSON<
  operations['pub_chive_claiming_findClaimable']
>;

/** Response from pub.chive.claiming.searchPreprints */
export type ClaimSearchResponse = SuccessResponseJSON<
  operations['pub_chive_claiming_searchPreprints']
>;

/** Response from pub.chive.claiming.getSuggestions */
export type ClaimSuggestionsResponse = SuccessResponseJSON<
  operations['pub_chive_claiming_getSuggestions']
>;

/** Claim object from API (nullable from getClaim endpoint) */
export type ClaimNullable = GetClaimResponse['claim'];

/** Non-nullable Claim type (used in claims arrays) */
export type Claim = NonNullable<ClaimNullable>;

/** Claim status */
export type ClaimStatus = Claim['status'];

/** Claim evidence type */
export type ClaimEvidenceType = Claim['evidence'][number]['type'];

/** Claim request (alias for Claim) */
export type ClaimRequest = Claim;

/** Claimable preprint from findClaimable */
export type ClaimablePreprint = FindClaimableResponse['preprints'][number];

/** Suggested paper from getSuggestions */
export type SuggestedPaper = ClaimSuggestionsResponse['papers'][number];

/** Author on suggested paper */
export type SuggestedPaperAuthor = NonNullable<SuggestedPaper['authors']>[number];

/** Profile metadata from suggestions */
export type SuggestionsProfileMetadata = ClaimSuggestionsResponse['profileMetadata'];

// -----------------------------------------------------------------------------
// Governance Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.governance.getProposal */
export type GetProposalResponse = SuccessResponseJSON<
  operations['pub_chive_governance_getProposal']
>;

/** Response from pub.chive.governance.listProposals */
export type ListProposalsResponse = SuccessResponseJSON<
  operations['pub_chive_governance_listProposals']
>;

/** Response from pub.chive.governance.listVotes */
export type VotesResponse = SuccessResponseJSON<operations['pub_chive_governance_listVotes']>;

/** Response from pub.chive.governance.getUserVote */
export type UserVoteResponse = SuccessResponseJSON<operations['pub_chive_governance_getUserVote']>;

/** Alias for listProposals response */
export type ProposalsResponse = ListProposalsResponse;

/** Proposal object from API */
export type Proposal = GetProposalResponse['proposal'];

/** Proposal status */
export type ProposalStatus = Proposal['status'];

/** Proposal type */
export type ProposalType = Proposal['type'];

/** Proposal changes */
export type ProposalChanges = Proposal['changes'];

/** Consensus progress */
export type ConsensusProgress = NonNullable<Proposal['consensusProgress']>;

/** Vote object from API */
export type Vote = VotesResponse['votes'][number];

/** Vote value */
export type VoteValue = Vote['value'];

/** Voter role */
export type VoterRole = Vote['voterRole'];

// -----------------------------------------------------------------------------
// Trending/Metrics Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.metrics.getTrending */
export type GetTrendingResponse = SuccessResponseJSON<operations['pub_chive_metrics_getTrending']>;

/** Trending preprint from API */
export type TrendingPreprint = GetTrendingResponse['preprints'][number];

// -----------------------------------------------------------------------------
// Discovery Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.discovery.getRecommendations */
export type RecommendationsResponse = SuccessResponseJSON<
  operations['pub_chive_discovery_getRecommendations']
>;

/** Alias for recommendations response */
export type GetRecommendationsResponse = RecommendationsResponse;

/** Response from pub.chive.discovery.getSimilar */
export type SimilarPreprintsResponse = SuccessResponseJSON<
  operations['pub_chive_discovery_getSimilar']
>;

/** Alias for similar response */
export type GetSimilarResponse = SimilarPreprintsResponse;

/** Response from pub.chive.discovery.getCitations */
export type CitationsResponse = SuccessResponseJSON<operations['pub_chive_discovery_getCitations']>;

/** Alias for citations response */
export type GetCitationsResponse = CitationsResponse;

/** Response from pub.chive.discovery.getEnrichment */
export type EnrichmentResponse = SuccessResponseJSON<
  operations['pub_chive_discovery_getEnrichment']
>;

/** Alias for enrichment response */
export type GetEnrichmentResponse = EnrichmentResponse;

/** Recommended preprint from API */
export type RecommendedPreprint = RecommendationsResponse['recommendations'][number];

/** Recommendation explanation */
export type RecommendationExplanation = RecommendedPreprint['explanation'];

/** Related preprint from getSimilar */
export type RelatedPreprint = SimilarPreprintsResponse['related'][number];

/** Citation relationship from getCitations */
export type CitationRelationship = CitationsResponse['citations'][number];

/** Citation network display settings from API */
export type CitationNetworkDisplay = DiscoverySettings['citationNetworkDisplay'];

/** Enrichment data from API */
export type Enrichment = NonNullable<EnrichmentResponse['enrichment']>;

/** Enrichment concept */
export type EnrichmentConcept = NonNullable<Enrichment['concepts']>[number];

/** Enrichment topic */
export type EnrichmentTopic = NonNullable<Enrichment['topics']>[number];

/** Response from pub.chive.discovery.getForYou */
export type ForYouResponse = SuccessResponseJSON<operations['pub_chive_discovery_getForYou']>;

/** Response from pub.chive.actor.getDiscoverySettings */
export type DiscoverySettingsResponse = SuccessResponseJSON<
  operations['pub_chive_actor_getDiscoverySettings']
>;

/** Discovery settings from API */
export type DiscoverySettings = DiscoverySettingsResponse;

/** For You signals settings */
export type ForYouSignals = DiscoverySettings['forYouSignals'];

/** Related papers signals settings */
export type RelatedPapersSignals = DiscoverySettings['relatedPapersSignals'];

// -----------------------------------------------------------------------------
// Activity Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.activity.getFeed */
export type ActivityFeedResponse = SuccessResponseJSON<operations['pub_chive_activity_getFeed']>;

/** Activity item from API */
export type Activity = ActivityFeedResponse['activities'][number];

// -----------------------------------------------------------------------------
// Backlink Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.backlink.list */
export type BacklinksResponse = SuccessResponseJSON<operations['pub_chive_backlink_list']>;

/** Response from pub.chive.backlink.getCounts */
export type BacklinkCountsResponse = SuccessResponseJSON<
  operations['pub_chive_backlink_getCounts']
>;

/** Backlink object from API */
export type Backlink = BacklinksResponse['backlinks'][number];

/** Backlink source type */
export type BacklinkSourceType = Backlink['sourceType'];

// -----------------------------------------------------------------------------
// Common Utility Types
// -----------------------------------------------------------------------------

/** Standard paginated response structure */
export interface PaginatedResponse<T> {
  cursor?: string;
  hasMore: boolean;
  total?: number;
  items: T[];
}

/** Blob reference for files/images */
export interface BlobRef {
  $type: 'blob';
  ref: string;
  mimeType: string;
  size: number;
}

/** Preprint source tracking - extracted from PreprintSummary */
export type PreprintSource = NonNullable<PreprintSummary['source']>;

/** Preprint metrics - extracted from GetTrendingResponse */
export type PreprintMetrics = NonNullable<TrendingPreprint['metrics']>;

/** Preprint version */
export interface PreprintVersion {
  version: number;
  cid: string;
  createdAt: string;
  changelog?: string;
}

// -----------------------------------------------------------------------------
// Faceted Search Parameter Types
// -----------------------------------------------------------------------------

/** Parameters for faceted search (PMEST dimensions) */
export interface FacetedSearchParams {
  personality?: string[];
  matter?: string[];
  energy?: string[];
  space?: string[];
  time?: string[];
  limit?: number;
  cursor?: string;
}

// -----------------------------------------------------------------------------
// Input Types for Mutations
// -----------------------------------------------------------------------------

/** For You recommendation signals */
export interface ForYouSignals {
  fields?: boolean;
  citations?: boolean;
  collaborators?: boolean;
  trending?: boolean;
}

/** Related papers signals */
export interface RelatedPapersSignals {
  citations?: boolean;
  topics?: boolean;
}

/** Input for updating discovery settings */
export interface UpdateDiscoverySettingsInput {
  enablePersonalization?: boolean;
  enableForYouFeed?: boolean;
  enableCollaboratorSignals?: boolean;
  citationNetworkDisplay?: CitationNetworkDisplay;
  showRecommendationReasons?: boolean;
  excludedFields?: string[];
  forYouSignals?: Partial<ForYouSignals>;
  relatedPapersSignals?: Partial<RelatedPapersSignals>;
}

// -----------------------------------------------------------------------------
// W3C Web Annotation Selector Types
// -----------------------------------------------------------------------------

/** Text quote selector for annotations */
export interface TextQuoteSelector {
  type: 'TextQuoteSelector';
  exact: string;
  prefix?: string;
  suffix?: string;
}

// -----------------------------------------------------------------------------
// FOVEA-style Rich Annotation Types (Frontend-Only)
// -----------------------------------------------------------------------------

/**
 * FOVEA-style rich annotation body with embedded references.
 *
 * @remarks
 * This is a frontend-only type for rich annotation editing/rendering.
 * The API uses ATProto's standard `{ text, facets }` format (see `AnnotationBody`).
 * Components should convert between these formats as needed.
 */
export interface RichAnnotationBody {
  type: 'RichText';
  items: RichAnnotationItem[];
  format: 'application/x-chive-gloss+json';
}

/**
 * Individual item in a FOVEA-style rich annotation body.
 */
export type RichAnnotationItem =
  | { type: 'text'; content: string }
  | { type: 'wikidataRef'; qid: string; label: string; url?: string }
  | { type: 'authorityRef'; uri: string; label: string }
  | { type: 'fieldRef'; uri: string; label: string }
  | { type: 'facetRef'; dimension: string; value: string }
  | { type: 'preprintRef'; uri: string; title: string }
  | { type: 'annotationRef'; uri: string; excerpt: string }
  | { type: 'authorRef'; did: string; displayName: string };

// -----------------------------------------------------------------------------
// Review Thread Types
// -----------------------------------------------------------------------------

/** API response from pub.chive.review.getThread (flat replies) */
export type ReviewThreadResponse = SuccessResponseJSON<operations['pub_chive_review_getThread']>;

/**
 * Hierarchical review thread for UI rendering.
 *
 * @remarks
 * This is a recursive structure built from API responses for displaying
 * nested review threads. The API returns flat replies which are transformed
 * into this hierarchical structure by `buildThread()` in review-list.tsx.
 */
export interface ReviewThread {
  /** Parent review */
  parent: Review;
  /** Nested replies (recursive) */
  replies: ReviewThread[];
  /** Total number of replies in this thread */
  totalReplies: number;
}

/** Review thread info (alias for compatibility) */
export type ReviewThreadInfo = ReviewThread;

/** Review with thread (alias for compatibility) */
export type ReviewWithThread = ReviewThread;

// -----------------------------------------------------------------------------
// Re-exports for Compatibility
// -----------------------------------------------------------------------------

// These are re-exported for backward compatibility with existing imports
export type { paths, operations } from './schema.generated';
