export {
  useEprint,
  useEprints,
  useEprintsByAuthor,
  usePrefetchEprint,
  eprintKeys,
} from './use-eprint';

export { useSearch, useInstantSearch, searchKeys } from './use-search';

export { useSearchTracking, markEprintViewStart } from './use-search-tracking';

export { useTrending, trendingKeys } from './use-trending';

export {
  useField,
  useFields,
  useFieldWithRelations,
  useFieldEprints,
  useFieldHierarchy,
  useFieldChildren,
  usePrefetchField,
  fieldKeys,
  type FieldNode,
  type FieldSummaryNode,
  type FieldWithRelations,
  type RelatedField,
  type GraphEdge as FieldGraphEdge,
  type ExternalId as FieldExternalId,
} from './use-field';

export {
  useAuthor,
  useAuthorProfile,
  useAuthorMetrics,
  usePrefetchAuthor,
  authorKeys,
  hasOrcid,
  formatOrcidUrl,
} from './use-author';

export {
  useFacetedSearch,
  useFacetCounts,
  useLiveFacetedSearch,
  facetedSearchKeys,
  countTotalFilters,
  isFacetSelected,
  addFacetValue,
  removeFacetValue,
  toggleFacetValue,
  clearDimensionFilters,
  clearAllFilters,
  type DynamicFacetFilters,
  type FacetDefinition,
  type FacetValue,
  type FacetedSearchResponse,
} from './use-faceted-search';

export {
  useReviews,
  useInlineReviews,
  useReviewThread,
  useAuthorReviews,
  useCreateReview,
  useDeleteReview,
  usePrefetchReviews,
  reviewKeys,
} from './use-review';

export {
  useEndorsements,
  useEndorsementSummary,
  useUserEndorsement,
  useCreateEndorsement,
  useDeleteEndorsement,
  usePrefetchEndorsements,
  endorsementKeys,
} from './use-endorsement';

export {
  useEprintTags,
  useTagSuggestions,
  useTrendingTags,
  useTagSearch,
  useTagDetail,
  useCreateTag,
  useDeleteTag,
  usePrefetchTags,
  tagKeys,
} from './use-tags';

export {
  useUserClaims,
  useClaim,
  useClaimableEprints,
  usePendingClaims,
  useStartClaim,
  useCompleteClaim,
  useApproveClaim,
  useRejectClaim,
  usePaperSuggestions,
  useMyCoauthorRequests,
  useCoauthorRequests,
  useRequestCoauthorship,
  useApproveCoauthor,
  useRejectCoauthor,
  claimingKeys,
  type SuggestedPaper,
  type SuggestionsProfileMetadata,
} from './use-claiming';

export {
  useDebounce,
  useAutocomplete,
  useEprintSearch,
  useStartClaimFromExternal,
  useEprintSearchState,
  eprintSearchKeys,
  type ImportSource,
  type ExternalEprint,
  type ExternalEprintAuthor,
  type AutocompleteSuggestion,
} from './use-eprint-search';

export {
  useOrcidAutocomplete,
  useAffiliationAutocomplete,
  useKeywordAutocomplete,
  useAuthorIdDiscovery,
  profileAutocompleteKeys,
  type OrcidSuggestion,
  type AffiliationSuggestion,
  type KeywordSuggestion,
  type AuthorIdMatch,
} from './use-profile-autocomplete';

export {
  useLogActivity,
  useMarkActivityFailed,
  useActivityFeed,
  useActivityLogging,
  generateRkey,
  activityKeys,
  COLLECTIONS,
  type Activity,
  type ActivityAction,
  type ActivityCategory,
  type ActivityStatus,
  type LogActivityInput,
  type MarkFailedInput,
  type ActivityFeedOptions,
} from './use-activity';

export {
  useForYouFeed,
  useSimilarPapers,
  useCitations,
  useEnrichment,
  useRecordInteraction,
  usePrefetchSimilarPapers,
  discoveryKeys,
  type RecommendedEprint,
  type RelatedEprint,
} from './use-discovery';

export { useShareToBluesky } from './use-share-to-bluesky';

export { useMentionAutocomplete, type ActorSuggestion } from './use-mention-autocomplete';

export {
  useMentionTrigger,
  type MentionTriggerType,
  type MentionTriggerState,
  type UseMentionTriggerOptions,
  type UseMentionTriggerReturn,
} from './use-mention-trigger';

export {
  useBacklinks,
  useBacklinkCounts,
  groupBacklinksBySource,
  getSourceTypeLabel,
  backlinkKeys,
  type Backlink,
  type BacklinkSourceType,
  type BacklinkCounts,
} from './use-backlinks';

export {
  useReviewNotifications,
  useEndorsementNotifications,
  notificationKeys,
  type ReviewNotification,
  type EndorsementNotification,
} from './use-notifications';

export {
  // Proposal hooks
  useProposals,
  useProposal,
  useProposalVotes,
  useMyVote,
  usePendingProposalsCount,
  useCreateProposal,
  useCreateVote,
  usePrefetchProposal,
  // Trusted editor hooks
  useMyEditorStatus,
  useEditorStatus,
  useTrustedEditors,
  useRequestElevation,
  useGrantDelegation,
  useRevokeDelegation,
  useRevokeRole,
  // Query keys
  governanceKeys,
  // Constants
  VOTE_WEIGHTS,
  ROLE_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  CATEGORY_LABELS,
  VOTE_LABELS,
  GOVERNANCE_ROLE_LABELS,
  CONSENSUS_THRESHOLD,
  MINIMUM_VOTES,
  // Types
  type VoterRole,
  type ProposalStatus,
  type ProposalType,
  type ProposalCategory,
  type VoteAction,
  type VoteValue,
  type Proposal,
  type ProposalChanges,
  type ConsensusProgress,
  type Vote,
  type ProposalsResponse,
  type VotesResponse,
  type GovernanceRole,
  type EditorStatus,
  type TrustedEditorRecord,
  type ElevationResult,
  type DelegationResult,
  type ProposalListParams,
  type UseGovernanceOptions,
  type CreateProposalInput,
  type CreateVoteInput,
  type TrustedEditorListParams,
  type GrantDelegationInput,
  type RevokeDelegationInput,
  type RevokeRoleInput,
} from './use-governance';

// =============================================================================
// UNIFIED KNOWLEDGE GRAPH HOOKS
// =============================================================================

export {
  // Node hooks
  useNodeSearch,
  useNode,
  useNodesBySubkind,
  useNodesByKind,
  usePrefetchNode,
  // Convenience hooks
  useDocumentFormats,
  useLicenses,
  usePublicationStatuses,
  useContributionTypeNodes,
  useContributionDegrees,
  usePaperTypes,
  useSupplementaryCategories,
  useMotivations,
  usePlatforms,
  useInstitutionTypes,
  useInstitutionSearch,
  useFacets,
  // Query keys
  nodeKeys,
  // Constants
  NODE_STATUS_LABELS,
  NODE_KIND_LABELS,
  SUBKIND_LABELS,
  // Types
  type NodeKind,
  type NodeStatus,
  type ExternalId,
  type NodeMetadata,
  type GraphNode,
  type NodeDetail,
  type NodesResponse,
  type NodeSearchParams,
  type NodeListParams,
  type UseNodeOptions,
} from './use-nodes';

export {
  // Edge hooks
  useEdges,
  useEdge,
  useHierarchy,
  useNodeChildren,
  useNodeParents,
  useNodeAncestors,
  // Convenience hooks
  useFieldAncestors,
  // Query keys
  edgeKeys,
  // Constants
  EDGE_STATUS_LABELS,
  RELATION_LABELS,
  // Types
  type EdgeStatus,
  type EdgeMetadata,
  type GraphEdge,
  type EdgeWithNodes,
  type HierarchyNode,
  type EdgesResponse,
  type HierarchyResponse,
  type EdgeListParams,
  type HierarchyParams,
  type UseEdgeOptions,
} from './use-edges';
