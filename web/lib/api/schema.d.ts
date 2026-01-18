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
// Eprint Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.eprint.getSubmission */
export type GetEprintResponse = SuccessResponseJSON<operations['pub_chive_eprint_getSubmission']>;

/** Response from pub.chive.eprint.listByAuthor */
export type ListEprintsResponse = SuccessResponseJSON<operations['pub_chive_eprint_listByAuthor']>;

/** Response from pub.chive.eprint.searchSubmissions */
export type SearchEprintsResponse = SuccessResponseJSON<
  operations['pub_chive_eprint_searchSubmissions']
>;

/**
 * Eprint object from API responses.
 *
 * @remarks
 * Uses the new unified authors array model. The generated type is overridden
 * here until the OpenAPI schema is regenerated.
 */
export interface Eprint {
  uri: string;
  cid: string;
  title: string;
  abstract: string;
  submittedBy: string;
  paperDid?: string;
  authors: EprintAuthor[];
  fields?: FieldRef[];
  keywords?: string[];
  source?: EprintSource;
  license?: string;
  doi?: string;
  document?: BlobRef;
  documentFormat?: DocumentFormat;
  versions?: EprintVersion[];
  metrics?: EprintMetrics;
  publicationStatus?: PublicationStatus;
  publishedVersion?: PublishedVersion;
  externalIds?: ExternalIds;
  relatedWorks?: RelatedWork[];
  repositories?: Repositories;
  funding?: FundingSource[];
  conferencePresentation?: ConferencePresentation;
  supplementaryMaterials?: SupplementaryItem[];
  createdAt: string;
  updatedAt?: string;
}

// -----------------------------------------------------------------------------
// Document & Publication Types
// -----------------------------------------------------------------------------

/**
 * Supported document formats.
 */
export type DocumentFormat =
  | 'pdf'
  | 'docx'
  | 'html'
  | 'markdown'
  | 'latex'
  | 'jupyter'
  | 'odt'
  | 'rtf'
  | 'epub'
  | 'txt';

/**
 * Publication lifecycle status.
 */
export type PublicationStatus =
  | 'eprint'
  | 'under_review'
  | 'revision_requested'
  | 'accepted'
  | 'in_press'
  | 'published'
  | 'retracted';

/**
 * Published version metadata.
 */
export interface PublishedVersion {
  doi?: string;
  url?: string;
  publishedAt?: string;
  journal?: string;
  journalAbbreviation?: string;
  journalIssn?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  articleNumber?: string;
  eLocationId?: string;
  accessType?: 'open_access' | 'green_oa' | 'gold_oa' | 'hybrid_oa' | 'bronze_oa' | 'closed';
  licenseUrl?: string;
}

/**
 * External persistent identifiers.
 */
export interface ExternalIds {
  arxivId?: string;
  pmid?: string;
  pmcid?: string;
  ssrnId?: string;
  osf?: string;
  zenodoDoi?: string;
  openAlexId?: string;
  semanticScholarId?: string;
  coreSid?: string;
  magId?: string;
}

/**
 * Related work with DataCite relation type.
 */
export interface RelatedWork {
  identifier: string;
  identifierType:
    | 'doi'
    | 'arxiv'
    | 'pmid'
    | 'pmcid'
    | 'url'
    | 'urn'
    | 'handle'
    | 'isbn'
    | 'issn'
    | 'at-uri';
  relationType: string;
  title?: string;
  description?: string;
}

/**
 * Code repository reference.
 */
export interface CodeRepository {
  url?: string;
  /** @deprecated Use platformUri instead */
  platform?:
    | 'github'
    | 'gitlab'
    | 'bitbucket'
    | 'huggingface'
    | 'paperswithcode'
    | 'codeberg'
    | 'sourcehut'
    | 'software_heritage'
    | 'colab'
    | 'kaggle'
    | 'other';
  /** AT-URI of the platform concept */
  platformUri?: string;
  /** Display name of the platform */
  platformName?: string;
  label?: string;
  archiveUrl?: string;
  swhid?: string;
}

/**
 * Data/model repository reference.
 */
export interface DataRepository {
  url?: string;
  doi?: string;
  /** @deprecated Use platformUri instead */
  platform?:
    | 'huggingface'
    | 'zenodo'
    | 'figshare'
    | 'kaggle'
    | 'dryad'
    | 'osf'
    | 'dataverse'
    | 'mendeley_data'
    | 'wandb'
    | 'other';
  /** AT-URI of the platform concept */
  platformUri?: string;
  /** Display name of the platform */
  platformName?: string;
  label?: string;
  accessStatement?: string;
}

/**
 * Pre-registration reference.
 */
export interface Preregistration {
  url?: string;
  /** @deprecated Use platformUri instead */
  platform?: 'osf' | 'aspredicted' | 'clinicaltrials' | 'prospero' | 'other';
  /** AT-URI of the platform concept */
  platformUri?: string;
  /** Display name of the platform */
  platformName?: string;
  registrationDate?: string;
}

/**
 * Protocol reference.
 */
export interface Protocol {
  url?: string;
  doi?: string;
  /** @deprecated Use platformUri instead */
  platform?: 'protocols_io' | 'bio_protocol' | 'other';
  /** AT-URI of the platform concept */
  platformUri?: string;
  /** Display name of the platform */
  platformName?: string;
}

/**
 * Material/reagent reference.
 */
export interface Material {
  url?: string;
  rrid?: string;
  label?: string;
}

/**
 * Repository links for code, data, and materials.
 */
export interface Repositories {
  code?: CodeRepository[];
  data?: DataRepository[];
  preregistration?: Preregistration;
  protocols?: Protocol[];
  materials?: Material[];
}

/**
 * Funding source.
 */
export interface FundingSource {
  funderName?: string;
  funderDoi?: string;
  funderRor?: string;
  grantNumber?: string;
  grantTitle?: string;
  grantUrl?: string;
}

/**
 * Conference presentation information.
 */
export interface ConferencePresentation {
  conferenceName?: string;
  conferenceAcronym?: string;
  conferenceUrl?: string;
  conferenceLocation?: string;
  presentationDate?: string;
  /** @deprecated Use presentationTypeUri instead */
  presentationType?: 'oral' | 'poster' | 'keynote' | 'workshop' | 'demo' | 'other';
  /** AT-URI of the presentation type concept */
  presentationTypeUri?: string;
  /** Display name of the presentation type */
  presentationTypeName?: string;
  proceedingsDoi?: string;
}

/**
 * Supplementary material category.
 */
export type SupplementaryCategory =
  | 'appendix'
  | 'figure'
  | 'table'
  | 'dataset'
  | 'code'
  | 'notebook'
  | 'video'
  | 'audio'
  | 'presentation'
  | 'protocol'
  | 'questionnaire'
  | 'other';

/**
 * Supplementary material item.
 */
export interface SupplementaryItem {
  blobRef?: BlobRef;
  label: string;
  description?: string;
  category?: SupplementaryCategory;
  detectedFormat?: string;
  order?: number;
}

/**
 * Eprint summary in list/search results.
 *
 * @remarks
 * Uses the new unified authors array model.
 */
export interface EprintSummary {
  uri: string;
  cid: string;
  title: string;
  abstract: string;
  submittedBy: string;
  paperDid?: string;
  authors: EprintAuthor[];
  fields?: FieldRef[];
  source?: EprintSource;
  createdAt: string;
  metrics?: EprintMetrics;
}

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

/**
 * Eprint author with CRediT contributions.
 *
 * @remarks
 * This type represents the new author model with:
 * - Optional DID (supports external collaborators)
 * - Multiple affiliations per author
 * - CRediT-based contribution types with degree modifiers
 * - Corresponding author and highlighted (co-first/co-last) flags
 */
export interface EprintAuthor {
  /** Optional DID - undefined for external collaborators */
  did?: string;
  /** Display name (required for all) */
  name: string;
  /** ORCID identifier */
  orcid?: string;
  /** Contact email */
  email?: string;
  /** 1-indexed author position */
  order: number;
  /** Author affiliations */
  affiliations: AuthorAffiliation[];
  /** CRediT contributions */
  contributions: AuthorContribution[];
  /** Is this the corresponding author? */
  isCorrespondingAuthor: boolean;
  /** Is this a highlighted author (co-first, co-last)? */
  isHighlighted: boolean;
  /** Handle (optional, from ATProto profile) */
  handle?: string;
  /** Avatar URL if available */
  avatarUrl?: string;
}

/**
 * Author affiliation with optional ROR identifier.
 */
export interface AuthorAffiliation {
  /** Institution name */
  name: string;
  /** ROR identifier */
  rorId?: string;
  /** Department */
  department?: string;
}

/**
 * Author contribution with CRediT type and degree.
 */
export interface AuthorContribution {
  /** AT-URI to contribution type in Governance PDS */
  typeUri: string;
  /** Type identifier (e.g., "conceptualization") */
  typeId?: string;
  /** Human-readable label */
  typeLabel?: string;
  /** Contribution degree */
  degree: 'lead' | 'equal' | 'supporting';
}

/**
 * Authenticated user author (for reviews, endorsements, etc.).
 *
 * @remarks
 * Unlike EprintAuthor, this type requires a DID because the author
 * must be an authenticated user. Used for reviews, comments, endorsements.
 */
export interface Author {
  /** Decentralized Identifier (required for authenticated users) */
  did: string;
  /** AT Protocol handle */
  handle?: string;
  /** Display name */
  displayName?: string;
  /** Avatar URL */
  avatar?: string;
}

/** Affiliation type */
export type Affiliation = NonNullable<AuthorProfile['affiliations']>[number];

/** Research keyword type */
export type ResearchKeyword = NonNullable<AuthorProfile['researchKeywords']>[number];

// -----------------------------------------------------------------------------
// Tag Types (TaxoFolk)
// -----------------------------------------------------------------------------

/** Response from pub.chive.tag.listForEprint */
export type EprintTagsResponse = SuccessResponseJSON<operations['pub_chive_tag_listForEprint']>;

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

/** User tag on an eprint */
export type UserTag = EprintTagsResponse['tags'][number];

/** Tag suggestion from TaxoFolk */
export type TagSuggestion = NonNullable<EprintTagsResponse['suggestions']>[number];

/** Tag summary with stats */
export type TagSummary = TrendingTagsResponse['tags'][number];

/** Tag detail from getDetail endpoint */
export type TagDetail = TagDetailResponse['tag'];

// -----------------------------------------------------------------------------
// Review Types (W3C Web Annotation)
// -----------------------------------------------------------------------------

/** Response from pub.chive.review.listForEprint */
export type ReviewsResponse = SuccessResponseJSON<operations['pub_chive_review_listForEprint']>;

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
  | { type: 'nodeRef'; uri: string; label: string; kind?: 'type' | 'object'; subkind: string }
  | { type: 'fast'; uri: string; label: string }
  | { type: 'orcid'; did: string; displayName?: string }
  | { type: 'eprint'; uri: string; title: string }
  | { type: 'field'; uri: string; label: string }
  | { type: 'author'; did: string; displayName?: string };

// -----------------------------------------------------------------------------
// Endorsement Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.endorsement.listForEprint */
export type EndorsementsResponse = SuccessResponseJSON<
  operations['pub_chive_endorsement_listForEprint']
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
// Faceted Search Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.graph.browseFaceted */
export type FacetedSearchResponse = SuccessResponseJSON<
  operations['pub_chive_graph_browseFaceted']
>;

/** Eprint summary in faceted browse results */
export type FacetedEprintSummary = FacetedSearchResponse['hits'][number];

/** Facet value from browseFaceted - counts for faceted search */
export interface SearchFacetValue {
  value: string;
  label?: string;
  count: number;
}

// -----------------------------------------------------------------------------
// Knowledge Graph Node Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.graph.getNode */
export type GetNodeResponse = SuccessResponseJSON<operations['pub_chive_graph_getNode']>;

/** Response from pub.chive.graph.listNodes */
export type ListNodesResponse = SuccessResponseJSON<operations['pub_chive_graph_listNodes']>;

/** Response from pub.chive.graph.searchNodes */
export type SearchNodesResponse = SuccessResponseJSON<operations['pub_chive_graph_searchNodes']>;

/** Knowledge graph node from API */
export type GraphNode = GetNodeResponse['node'];

/** Node summary in search/list results */
export type GraphNodeSummary = ListNodesResponse['nodes'][number];

/** Node kind */
export type NodeKind = 'type' | 'object';

/** Node status */
export type NodeStatus = 'proposed' | 'provisional' | 'established' | 'deprecated';

/** External ID reference */
export type ExternalId = {
  system: string;
  identifier: string;
  uri?: string;
  matchType?: 'exact' | 'close' | 'broader' | 'narrower' | 'related';
};

// -----------------------------------------------------------------------------
// Field Types (Knowledge Graph Nodes for Academic Disciplines)
// -----------------------------------------------------------------------------

/**
 * Minimal field reference for embedding in other types.
 *
 * @remarks
 * Used in Eprint.fields and EprintSummary.fields arrays.
 * Matches the lexicon and API response shape.
 */
export interface FieldRef {
  /** Internal ID (may be slug or numeric) */
  id?: string;
  /** AT-URI of the field node */
  uri: string;
  /** Display label for the field */
  label: string;
  /** Parent field URI */
  parentUri?: string;
}

/**
 * Field summary for lists, cards, and search results.
 */
export interface FieldSummary {
  id: string;
  uri: string;
  label: string;
  description?: string;
  status: NodeStatus;
  eprintCount?: number;
  childCount?: number;
}

/**
 * Field relationship to another field.
 */
export interface FieldRelationship {
  type: 'broader' | 'narrower' | 'related' | 'equivalent' | 'influences';
  targetId: string;
  targetLabel: string;
  strength?: number;
}

/**
 * Full field detail with relationships and metadata.
 */
export interface FieldDetail extends FieldSummary {
  wikidataId?: string;
  parentId?: string;
  externalIds?: ExternalId[];
  relationships?: FieldRelationship[];
  children?: FieldRef[];
  ancestors?: FieldRef[];
  createdAt?: string;
  updatedAt?: string;
}

// -----------------------------------------------------------------------------
// Search Types
// -----------------------------------------------------------------------------

/**
 * Search results response from search or faceted browse endpoints.
 *
 * @remarks
 * Both SearchEprintsResponse and FacetedSearchResponse use the unified
 * author model with `authors` array.
 */
export type SearchResultsResponse = SearchEprintsResponse | FacetedSearchResponse;

/**
 * Search hit with score and highlights.
 *
 * @remarks
 * Extends EprintSummary with search-specific fields like score and highlights.
 */
export interface SearchHit extends EprintSummary {
  /** Search relevance score */
  score?: number;
  /** Highlighted text snippets */
  highlights?: Record<string, string[]>;
}

/** Search highlight for matched text */
export type SearchHighlight = NonNullable<SearchEprintsResponse['hits'][number]['highlights']>;

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

/** Response from pub.chive.claiming.searchEprints */
export type ClaimSearchResponse = SuccessResponseJSON<
  operations['pub_chive_claiming_searchEprints']
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

/** Claim request (alias for Claim) */
export type ClaimRequest = Claim;

/**
 * Paper details embedded in claim response.
 *
 * @remarks
 * Added to claims when fetching user claims for comprehensive display.
 */
export interface ClaimPaperDetails {
  source: string;
  externalId: string;
  externalUrl: string;
  title: string;
  authors: Array<{
    name: string;
    orcid?: string;
    affiliation?: string;
    email?: string;
  }>;
  publicationDate?: string;
  doi?: string;
}

/**
 * Claim with paper details for display.
 *
 * @remarks
 * Extended claim type returned by getUserClaims endpoint.
 */
export type ClaimRequestWithPaper = ClaimRequest & {
  paper: ClaimPaperDetails;
};

/** Claimable eprint from findClaimable */
export type ClaimableEprint = FindClaimableResponse['eprints'][number];

/** Suggested paper from getSuggestions */
export type SuggestedPaper = ClaimSuggestionsResponse['papers'][number];

/** Author on suggested paper */
export type SuggestedPaperAuthor = NonNullable<SuggestedPaper['authors']>[number];

/** Profile metadata from suggestions */
export type SuggestionsProfileMetadata = ClaimSuggestionsResponse['profileMetadata'];

// -----------------------------------------------------------------------------
// Co-Author Claim Types
// -----------------------------------------------------------------------------

/** Co-author claim request status */
export type CoauthorClaimStatus = 'pending' | 'approved' | 'rejected';

/**
 * Co-author claim request.
 *
 * @remarks
 * Represents a request to be added as co-author to a paper in another user's PDS.
 */
export interface CoauthorClaimRequest {
  id: number;
  eprintUri: string;
  eprintOwnerDid: string;
  claimantDid: string;
  claimantName: string;
  authorIndex: number;
  authorName: string;
  status: CoauthorClaimStatus;
  message?: string;
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
}

/**
 * Co-author claim request with eprint details for display.
 */
export interface CoauthorClaimRequestWithEprint extends CoauthorClaimRequest {
  eprint?: {
    title: string;
    authors: Array<{ name: string; orcid?: string }>;
  };
}

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

/** Vote action (includes request-changes) */
export type VoteAction = Vote['vote'];

/** Vote value (alias for vote, excludes request-changes) */
export type VoteValue = Vote['value'];

/** Voter role */
export type VoterRole = Vote['voterRole'];

/**
 * Proposal category - the type of entity being proposed.
 *
 * @remarks
 * High-level categories for what is being proposed:
 * - node: Knowledge graph node (any subkind)
 * - edge: Knowledge graph edge/relationship
 *
 * Note: The backend schema has additional categories (field, concept, etc.)
 * but these don't align with actual subkinds. Use subkind filtering separately.
 */
export type ProposalCategory = 'node' | 'edge';

// -----------------------------------------------------------------------------
// Trusted Editor Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.governance.getEditorStatus */
export type GetEditorStatusResponse = SuccessResponseJSON<
  operations['pub_chive_governance_getEditorStatus']
>;

/** Response from pub.chive.governance.listTrustedEditors */
export type ListTrustedEditorsResponse = SuccessResponseJSON<
  operations['pub_chive_governance_listTrustedEditors']
>;

/** Response from pub.chive.governance.requestElevation */
export type RequestElevationResponse = SuccessResponseJSON<
  operations['pub_chive_governance_requestElevation']
>;

/** Response from pub.chive.governance.grantDelegation */
export type GrantDelegationResponse = SuccessResponseJSON<
  operations['pub_chive_governance_grantDelegation']
>;

/** Response from pub.chive.governance.revokeDelegation */
export type RevokeDelegationResponse = SuccessResponseJSON<
  operations['pub_chive_governance_revokeDelegation']
>;

/** Response from pub.chive.governance.revokeRole */
export type RevokeRoleResponse = SuccessResponseJSON<operations['pub_chive_governance_revokeRole']>;

/**
 * Governance role for trusted editors.
 *
 * @remarks
 * Roles in ascending order of privilege:
 * - community-member: Standard user, can propose changes
 * - trusted-editor: Can create knowledge graph nodes via delegation
 * - graph-editor: Can modify existing knowledge graph nodes
 * - domain-expert: Subject matter expert, weighted voting
 * - administrator: Full governance privileges
 */
export type GovernanceRole =
  | 'community-member'
  | 'trusted-editor'
  | 'graph-editor'
  | 'domain-expert'
  | 'administrator';

/**
 * Reputation metrics for a user.
 */
export interface ReputationMetrics {
  did: string;
  accountCreatedAt: number;
  accountAgeDays: number;
  eprintCount: number;
  wellEndorsedEprintCount: number;
  totalEndorsements: number;
  proposalCount: number;
  voteCount: number;
  successfulProposals: number;
  warningCount: number;
  violationCount: number;
  reputationScore: number;
  role: GovernanceRole;
  eligibleForTrustedEditor: boolean;
  missingCriteria: string[];
}

/**
 * Editor status with delegation and metrics.
 */
export interface EditorStatus {
  did: string;
  displayName?: string;
  role: GovernanceRole;
  roleGrantedAt?: number;
  roleGrantedBy?: string;
  hasDelegation: boolean;
  delegationExpiresAt?: number;
  delegationCollections?: string[];
  recordsCreatedToday: number;
  dailyRateLimit: number;
  metrics: ReputationMetrics;
}

/**
 * Trusted editor record from list response.
 */
export interface TrustedEditorRecord {
  did: string;
  handle?: string;
  displayName?: string;
  role: GovernanceRole;
  roleGrantedAt: number;
  roleGrantedBy?: string;
  hasDelegation: boolean;
  delegationExpiresAt?: number;
  recordsCreatedToday: number;
  dailyRateLimit: number;
  metrics: ReputationMetrics;
}

/**
 * Elevation request result.
 */
export interface ElevationResult {
  success: boolean;
  requestId?: string;
  message: string;
}

/**
 * Delegation operation result.
 */
export interface DelegationResult {
  success: boolean;
  delegationId?: string;
  message: string;
}

/**
 * Elevation request record from listElevationRequests.
 */
export interface ElevationRequest {
  id: string;
  did: string;
  handle?: string;
  displayName?: string;
  requestedRole: GovernanceRole;
  currentRole: GovernanceRole;
  requestedAt: number;
  metrics: ReputationMetrics;
  verificationNotes?: string;
}

/**
 * Response from pub.chive.governance.listElevationRequests.
 */
export interface ElevationRequestsResponse {
  requests: ElevationRequest[];
  cursor?: string;
  total: number;
}

/**
 * Input for approving an elevation request.
 */
export interface ApproveElevationInput {
  requestId: string;
  verificationNotes?: string;
}

/**
 * Input for rejecting an elevation request.
 */
export interface RejectElevationInput {
  requestId: string;
  reason: string;
}

/**
 * Delegation record from listDelegations.
 */
export interface DelegationRecord {
  id: string;
  delegateDid: string;
  handle?: string;
  displayName?: string;
  collections: string[];
  expiresAt: number;
  maxRecordsPerDay: number;
  recordsCreatedToday: number;
  grantedAt: number;
  grantedBy: string;
  active: boolean;
}

/**
 * Response from pub.chive.governance.listDelegations.
 */
export interface DelegationsResponse {
  delegations: DelegationRecord[];
  cursor?: string;
  total: number;
}

// -----------------------------------------------------------------------------
// Facet Types (PMEST + FAST Classification)
// -----------------------------------------------------------------------------

/**
 * PMEST facet dimension - Ranganathan's Colon Classification.
 *
 * @remarks
 * The five fundamental categories:
 * - personality: What the subject is fundamentally about (entities)
 * - matter: What it's made of or relates to (materials, properties)
 * - energy: How it operates or acts (processes, methods)
 * - space: Where it occurs (geographic, institutional)
 * - time: When it occurs (temporal aspects)
 */
export type PMESTDimension = 'personality' | 'matter' | 'energy' | 'space' | 'time';

/**
 * FAST entity facet - Library of Congress FAST schema.
 *
 * @remarks
 * Derived from LCSH for entity-based facets:
 * - person: Named individuals
 * - organization: Corporations, institutions, groups
 * - event: Named events, conferences
 * - work: Named works (books, films, etc.)
 * - form-genre: Document types and formats
 */
export type FASTEntityFacet = 'person' | 'organization' | 'event' | 'work' | 'form-genre';

/**
 * Combined facet dimension type.
 */
export type FacetDimension = PMESTDimension | FASTEntityFacet;

/**
 * Facet value - a specific term within a facet dimension.
 */
export interface FacetValue {
  id: string;
  label: string;
  dimension: FacetDimension;
  description?: string;
  externalMappings?: ExternalMapping[];
  parentId?: string;
  status: 'proposed' | 'provisional' | 'established' | 'deprecated';
}

/**
 * Facet proposal changes.
 */
export interface FacetProposalChanges {
  label?: string;
  description?: string;
  dimension?: FacetDimension;
  parentId?: string;
  externalMappings?: ExternalMapping[];
}

// -----------------------------------------------------------------------------
// Organization Types (Research Institutions)
// -----------------------------------------------------------------------------

/**
 * Organization type classification.
 */
export type OrganizationType =
  | 'university'
  | 'research-lab'
  | 'funding-body'
  | 'publisher'
  | 'consortium'
  | 'hospital'
  | 'government'
  | 'nonprofit'
  | 'company'
  | 'other';

/**
 * Research organization/institution.
 */
export interface Organization {
  id: string;
  uri: string;
  name: string;
  type: OrganizationType;
  rorId?: string;
  wikidataId?: string;
  country?: string;
  city?: string;
  website?: string;
  aliases?: string[];
  parentId?: string;
  status: 'proposed' | 'provisional' | 'established' | 'deprecated';
}

/**
 * Organization proposal changes.
 */
export interface OrganizationProposalChanges {
  name?: string;
  type?: OrganizationType;
  rorId?: string;
  wikidataId?: string;
  country?: string;
  city?: string;
  website?: string;
  aliases?: string[];
  parentId?: string;
}

// -----------------------------------------------------------------------------
// Reconciliation Types (External Knowledge Base Linking)
// -----------------------------------------------------------------------------

/**
 * External knowledge base system.
 */
export type ReconciliationSystem =
  | 'wikidata'
  | 'ror'
  | 'orcid'
  | 'openalex'
  | 'crossref'
  | 'arxiv'
  | 'semantic-scholar'
  | 'pubmed'
  | 'credit'
  | 'cro'
  | 'lcsh'
  | 'fast'
  | 'other';

/**
 * Match type for reconciliation mappings.
 *
 * @remarks
 * Based on SKOS mapping relations:
 * - exact-match: Equivalent concepts
 * - close-match: Very similar, interchangeable in some contexts
 * - broader-match: Target is broader than source
 * - narrower-match: Target is narrower than source
 * - related-match: Associated but not equivalent
 */
export type ReconciliationMatchType =
  | 'exact-match'
  | 'close-match'
  | 'broader-match'
  | 'narrower-match'
  | 'related-match';

/**
 * Method used to establish reconciliation.
 */
export type ReconciliationMethod = 'automatic' | 'expert-validation' | 'community-vote';

/**
 * Chive entity type that can be reconciled.
 */
export type ReconcilableEntityType =
  | 'field'
  | 'contribution-type'
  | 'facet'
  | 'organization'
  | 'author'
  | 'eprint';

/**
 * Reconciliation mapping between Chive entity and external system.
 */
export interface Reconciliation {
  id: string;
  uri: string;
  sourceType: ReconcilableEntityType;
  sourceUri: string;
  sourceLabel: string;
  targetSystem: ReconciliationSystem;
  targetId: string;
  targetUri: string;
  targetLabel?: string;
  matchType: ReconciliationMatchType;
  method: ReconciliationMethod;
  confidence?: number;
  validatedBy?: string;
  status: 'proposed' | 'provisional' | 'established' | 'deprecated';
  createdAt: string;
}

/**
 * Reconciliation proposal changes.
 */
export interface ReconciliationProposalChanges {
  sourceType?: ReconcilableEntityType;
  sourceUri?: string;
  targetSystem?: ReconciliationSystem;
  targetId?: string;
  targetUri?: string;
  targetLabel?: string;
  matchType?: ReconciliationMatchType;
  method?: ReconciliationMethod;
  confidence?: number;
}

/**
 * External mapping to external ontology/knowledge base.
 */
export interface ExternalMapping {
  system: string;
  identifier: string;
  uri: string;
  matchType?: ReconciliationMatchType;
}

// -----------------------------------------------------------------------------
// Trending/Metrics Types
// -----------------------------------------------------------------------------

/** Response from pub.chive.metrics.getTrending */
export type GetTrendingResponse = SuccessResponseJSON<operations['pub_chive_metrics_getTrending']>;

/** Trending eprint from API */
export type TrendingEprint = GetTrendingResponse['eprints'][number];

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
export type SimilarEprintsResponse = SuccessResponseJSON<
  operations['pub_chive_discovery_getSimilar']
>;

/** Alias for similar response */
export type GetSimilarResponse = SimilarEprintsResponse;

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

/** Recommended eprint from API */
export type RecommendedEprint = RecommendationsResponse['recommendations'][number];

/** Recommendation explanation */
export type RecommendationExplanation = RecommendedEprint['explanation'];

/** Related eprint from getSimilar */
export type RelatedEprint = SimilarEprintsResponse['related'][number];

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

/** Eprint source tracking - extracted from EprintSummary */
export type EprintSource = NonNullable<EprintSummary['source']>;

/** Eprint metrics - extracted from GetTrendingResponse */
export type EprintMetrics = NonNullable<TrendingEprint['metrics']>;

/** Eprint version */
export interface EprintVersion {
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
  | { type: 'nodeRef'; uri: string; label: string; kind?: 'type' | 'object'; subkind?: string }
  | { type: 'fieldRef'; uri: string; label: string }
  | { type: 'facetRef'; dimension: string; value: string }
  | { type: 'eprintRef'; uri: string; title: string }
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
// Alpha Types
// -----------------------------------------------------------------------------

/**
 * Alpha application status.
 */
export type AlphaApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected';

/**
 * Sector/organization type for alpha applications.
 */
export type AlphaSector =
  | 'academia'
  | 'industry'
  | 'government'
  | 'nonprofit'
  | 'healthcare'
  | 'independent'
  | 'other';

/**
 * Career stage/position for alpha applications.
 */
export type AlphaCareerStage =
  | 'undergraduate'
  | 'graduate-masters'
  | 'graduate-phd'
  | 'postdoc'
  | 'research-staff'
  | 'junior-faculty'
  | 'senior-faculty'
  | 'research-admin'
  | 'librarian'
  | 'science-communicator'
  | 'policy-professional'
  | 'retired'
  | 'other';

/**
 * Affiliation for alpha applications.
 */
export interface AlphaAffiliation {
  name: string;
  rorId?: string;
}

/**
 * Research keyword for alpha applications.
 */
export interface AlphaResearchKeyword {
  label: string;
  fastId?: string;
  wikidataId?: string;
}

/**
 * Alpha status check response.
 */
export interface AlphaStatusResponse {
  status: AlphaApplicationStatus;
  appliedAt?: string;
  reviewedAt?: string;
}

/**
 * Alpha application input.
 */
export interface AlphaApplyInput {
  email: string;
  sector: AlphaSector;
  sectorOther?: string;
  careerStage: AlphaCareerStage;
  careerStageOther?: string;
  affiliations?: AlphaAffiliation[];
  researchKeywords: AlphaResearchKeyword[];
  motivation?: string;
}

/**
 * Alpha application response.
 */
export interface AlphaApplyResponse {
  id: string;
  status: 'pending';
}

// -----------------------------------------------------------------------------
// Notification Types
// -----------------------------------------------------------------------------

/**
 * Review notification on user's papers.
 */
export interface ReviewNotification {
  uri: string;
  reviewerDid: string;
  reviewerHandle?: string;
  reviewerDisplayName?: string;
  eprintUri: string;
  eprintTitle: string;
  text: string;
  isReply: boolean;
  createdAt: string;
}

/**
 * Endorsement notification on user's papers.
 */
export interface EndorsementNotification {
  uri: string;
  endorserDid: string;
  endorserHandle?: string;
  endorserDisplayName?: string;
  eprintUri: string;
  eprintTitle: string;
  endorsementType: 'methods' | 'results' | 'overall';
  comment?: string;
  createdAt: string;
}

/**
 * Review notifications response.
 */
export interface ReviewNotificationsResponse {
  notifications: ReviewNotification[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

/**
 * Endorsement notifications response.
 */
export interface EndorsementNotificationsResponse {
  notifications: EndorsementNotification[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

// -----------------------------------------------------------------------------
// Re-exports
// -----------------------------------------------------------------------------

export type { paths, operations } from './schema.generated';
