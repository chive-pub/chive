// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { XrpcClient, type FetchHandler, type FetchHandlerOptions } from '@atproto/xrpc';
import { schemas } from './lexicons.js';
import { CID } from 'multiformats/cid';
import { type OmitKey, type Un$Typed } from './util.js';
import * as ComAtprotoRepoApplyWrites from './types/com/atproto/repo/applyWrites.js';
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord.js';
import * as ComAtprotoRepoDefs from './types/com/atproto/repo/defs.js';
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord.js';
import * as ComAtprotoRepoDescribeRepo from './types/com/atproto/repo/describeRepo.js';
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord.js';
import * as ComAtprotoRepoImportRepo from './types/com/atproto/repo/importRepo.js';
import * as ComAtprotoRepoListMissingBlobs from './types/com/atproto/repo/listMissingBlobs.js';
import * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords.js';
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord.js';
import * as ComAtprotoRepoStrongRef from './types/com/atproto/repo/strongRef.js';
import * as ComAtprotoRepoUploadBlob from './types/com/atproto/repo/uploadBlob.js';
import * as PubChiveActivityGetCorrelationMetrics from './types/pub/chive/activity/getCorrelationMetrics.js';
import * as PubChiveActivityGetFeed from './types/pub/chive/activity/getFeed.js';
import * as PubChiveActivityLog from './types/pub/chive/activity/log.js';
import * as PubChiveActivityMarkFailed from './types/pub/chive/activity/markFailed.js';
import * as PubChiveActorAutocompleteAffiliation from './types/pub/chive/actor/autocompleteAffiliation.js';
import * as PubChiveActorAutocompleteKeyword from './types/pub/chive/actor/autocompleteKeyword.js';
import * as PubChiveActorAutocompleteOpenReview from './types/pub/chive/actor/autocompleteOpenReview.js';
import * as PubChiveActorAutocompleteOrcid from './types/pub/chive/actor/autocompleteOrcid.js';
import * as PubChiveActorDiscoverAuthorIds from './types/pub/chive/actor/discoverAuthorIds.js';
import * as PubChiveActorGetDiscoverySettings from './types/pub/chive/actor/getDiscoverySettings.js';
import * as PubChiveActorGetMyProfile from './types/pub/chive/actor/getMyProfile.js';
import * as PubChiveActorProfile from './types/pub/chive/actor/profile.js';
import * as PubChiveAlphaApply from './types/pub/chive/alpha/apply.js';
import * as PubChiveAlphaCheckStatus from './types/pub/chive/alpha/checkStatus.js';
import * as PubChiveAuthorGetProfile from './types/pub/chive/author/getProfile.js';
import * as PubChiveAuthorSearchAuthors from './types/pub/chive/author/searchAuthors.js';
import * as PubChiveBacklinkCreate from './types/pub/chive/backlink/create.js';
import * as PubChiveBacklinkDelete from './types/pub/chive/backlink/delete.js';
import * as PubChiveBacklinkGetCounts from './types/pub/chive/backlink/getCounts.js';
import * as PubChiveBacklinkList from './types/pub/chive/backlink/list.js';
import * as PubChiveClaimingApproveClaim from './types/pub/chive/claiming/approveClaim.js';
import * as PubChiveClaimingApproveCoauthor from './types/pub/chive/claiming/approveCoauthor.js';
import * as PubChiveClaimingAutocomplete from './types/pub/chive/claiming/autocomplete.js';
import * as PubChiveClaimingCompleteClaim from './types/pub/chive/claiming/completeClaim.js';
import * as PubChiveClaimingFetchExternalPdf from './types/pub/chive/claiming/fetchExternalPdf.js';
import * as PubChiveClaimingFindClaimable from './types/pub/chive/claiming/findClaimable.js';
import * as PubChiveClaimingGetClaim from './types/pub/chive/claiming/getClaim.js';
import * as PubChiveClaimingGetCoauthorRequests from './types/pub/chive/claiming/getCoauthorRequests.js';
import * as PubChiveClaimingGetMyCoauthorRequests from './types/pub/chive/claiming/getMyCoauthorRequests.js';
import * as PubChiveClaimingGetPendingClaims from './types/pub/chive/claiming/getPendingClaims.js';
import * as PubChiveClaimingGetSubmissionData from './types/pub/chive/claiming/getSubmissionData.js';
import * as PubChiveClaimingGetSuggestions from './types/pub/chive/claiming/getSuggestions.js';
import * as PubChiveClaimingGetUserClaims from './types/pub/chive/claiming/getUserClaims.js';
import * as PubChiveClaimingRejectClaim from './types/pub/chive/claiming/rejectClaim.js';
import * as PubChiveClaimingRejectCoauthor from './types/pub/chive/claiming/rejectCoauthor.js';
import * as PubChiveClaimingRequestCoauthorship from './types/pub/chive/claiming/requestCoauthorship.js';
import * as PubChiveClaimingSearchEprints from './types/pub/chive/claiming/searchEprints.js';
import * as PubChiveClaimingStartClaim from './types/pub/chive/claiming/startClaim.js';
import * as PubChiveClaimingStartClaimFromExternal from './types/pub/chive/claiming/startClaimFromExternal.js';
import * as PubChiveDiscoveryGetCitations from './types/pub/chive/discovery/getCitations.js';
import * as PubChiveDiscoveryGetEnrichment from './types/pub/chive/discovery/getEnrichment.js';
import * as PubChiveDiscoveryGetForYou from './types/pub/chive/discovery/getForYou.js';
import * as PubChiveDiscoveryGetRecommendations from './types/pub/chive/discovery/getRecommendations.js';
import * as PubChiveDiscoveryGetSimilar from './types/pub/chive/discovery/getSimilar.js';
import * as PubChiveDiscoveryRecordInteraction from './types/pub/chive/discovery/recordInteraction.js';
import * as PubChiveDiscoverySettings from './types/pub/chive/discovery/settings.js';
import * as PubChiveEndorsementGetSummary from './types/pub/chive/endorsement/getSummary.js';
import * as PubChiveEndorsementGetUserEndorsement from './types/pub/chive/endorsement/getUserEndorsement.js';
import * as PubChiveEndorsementListForEprint from './types/pub/chive/endorsement/listForEprint.js';
import * as PubChiveEprintAuthorContribution from './types/pub/chive/eprint/authorContribution.js';
import * as PubChiveEprintGetSubmission from './types/pub/chive/eprint/getSubmission.js';
import * as PubChiveEprintListByAuthor from './types/pub/chive/eprint/listByAuthor.js';
import * as PubChiveEprintSearchSubmissions from './types/pub/chive/eprint/searchSubmissions.js';
import * as PubChiveEprintSubmission from './types/pub/chive/eprint/submission.js';
import * as PubChiveEprintUserTag from './types/pub/chive/eprint/userTag.js';
import * as PubChiveEprintVersion from './types/pub/chive/eprint/version.js';
import * as PubChiveGovernanceApproveElevation from './types/pub/chive/governance/approveElevation.js';
import * as PubChiveGovernanceGetEditorStatus from './types/pub/chive/governance/getEditorStatus.js';
import * as PubChiveGovernanceGetPendingCount from './types/pub/chive/governance/getPendingCount.js';
import * as PubChiveGovernanceGetProposal from './types/pub/chive/governance/getProposal.js';
import * as PubChiveGovernanceGetUserVote from './types/pub/chive/governance/getUserVote.js';
import * as PubChiveGovernanceGrantDelegation from './types/pub/chive/governance/grantDelegation.js';
import * as PubChiveGovernanceListDelegations from './types/pub/chive/governance/listDelegations.js';
import * as PubChiveGovernanceListElevationRequests from './types/pub/chive/governance/listElevationRequests.js';
import * as PubChiveGovernanceListProposals from './types/pub/chive/governance/listProposals.js';
import * as PubChiveGovernanceListTrustedEditors from './types/pub/chive/governance/listTrustedEditors.js';
import * as PubChiveGovernanceListVotes from './types/pub/chive/governance/listVotes.js';
import * as PubChiveGovernanceRejectElevation from './types/pub/chive/governance/rejectElevation.js';
import * as PubChiveGovernanceRequestElevation from './types/pub/chive/governance/requestElevation.js';
import * as PubChiveGovernanceRevokeDelegation from './types/pub/chive/governance/revokeDelegation.js';
import * as PubChiveGovernanceRevokeRole from './types/pub/chive/governance/revokeRole.js';
import * as PubChiveGraphBrowseFaceted from './types/pub/chive/graph/browseFaceted.js';
import * as PubChiveGraphEdge from './types/pub/chive/graph/edge.js';
import * as PubChiveGraphEdgeProposal from './types/pub/chive/graph/edgeProposal.js';
import * as PubChiveGraphGetCommunities from './types/pub/chive/graph/getCommunities.js';
import * as PubChiveGraphGetEdge from './types/pub/chive/graph/getEdge.js';
import * as PubChiveGraphGetHierarchy from './types/pub/chive/graph/getHierarchy.js';
import * as PubChiveGraphGetNode from './types/pub/chive/graph/getNode.js';
import * as PubChiveGraphGetRelations from './types/pub/chive/graph/getRelations.js';
import * as PubChiveGraphGetSubkinds from './types/pub/chive/graph/getSubkinds.js';
import * as PubChiveGraphListEdges from './types/pub/chive/graph/listEdges.js';
import * as PubChiveGraphListNodes from './types/pub/chive/graph/listNodes.js';
import * as PubChiveGraphNode from './types/pub/chive/graph/node.js';
import * as PubChiveGraphNodeProposal from './types/pub/chive/graph/nodeProposal.js';
import * as PubChiveGraphReconciliation from './types/pub/chive/graph/reconciliation.js';
import * as PubChiveGraphSearchNodes from './types/pub/chive/graph/searchNodes.js';
import * as PubChiveGraphVote from './types/pub/chive/graph/vote.js';
import * as PubChiveImportExists from './types/pub/chive/import/exists.js';
import * as PubChiveImportGet from './types/pub/chive/import/get.js';
import * as PubChiveImportSearch from './types/pub/chive/import/search.js';
import * as PubChiveMetricsGetMetrics from './types/pub/chive/metrics/getMetrics.js';
import * as PubChiveMetricsGetTrending from './types/pub/chive/metrics/getTrending.js';
import * as PubChiveMetricsGetViewCount from './types/pub/chive/metrics/getViewCount.js';
import * as PubChiveMetricsRecordDownload from './types/pub/chive/metrics/recordDownload.js';
import * as PubChiveMetricsRecordDwellTime from './types/pub/chive/metrics/recordDwellTime.js';
import * as PubChiveMetricsRecordSearchClick from './types/pub/chive/metrics/recordSearchClick.js';
import * as PubChiveMetricsRecordSearchDownload from './types/pub/chive/metrics/recordSearchDownload.js';
import * as PubChiveMetricsRecordView from './types/pub/chive/metrics/recordView.js';
import * as PubChiveNotificationListEndorsementsOnMyPapers from './types/pub/chive/notification/listEndorsementsOnMyPapers.js';
import * as PubChiveNotificationListReviewsOnMyPapers from './types/pub/chive/notification/listReviewsOnMyPapers.js';
import * as PubChiveReviewComment from './types/pub/chive/review/comment.js';
import * as PubChiveReviewEndorsement from './types/pub/chive/review/endorsement.js';
import * as PubChiveReviewEntityLink from './types/pub/chive/review/entityLink.js';
import * as PubChiveReviewGetThread from './types/pub/chive/review/getThread.js';
import * as PubChiveReviewListForAuthor from './types/pub/chive/review/listForAuthor.js';
import * as PubChiveReviewListForEprint from './types/pub/chive/review/listForEprint.js';
import * as PubChiveSyncCheckStaleness from './types/pub/chive/sync/checkStaleness.js';
import * as PubChiveSyncIndexRecord from './types/pub/chive/sync/indexRecord.js';
import * as PubChiveSyncRefreshRecord from './types/pub/chive/sync/refreshRecord.js';
import * as PubChiveSyncRegisterPDS from './types/pub/chive/sync/registerPDS.js';
import * as PubChiveSyncVerify from './types/pub/chive/sync/verify.js';
import * as PubChiveTagGetDetail from './types/pub/chive/tag/getDetail.js';
import * as PubChiveTagGetSuggestions from './types/pub/chive/tag/getSuggestions.js';
import * as PubChiveTagGetTrending from './types/pub/chive/tag/getTrending.js';
import * as PubChiveTagListForEprint from './types/pub/chive/tag/listForEprint.js';
import * as PubChiveTagSearch from './types/pub/chive/tag/search.js';

export * as ComAtprotoRepoApplyWrites from './types/com/atproto/repo/applyWrites.js';
export * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord.js';
export * as ComAtprotoRepoDefs from './types/com/atproto/repo/defs.js';
export * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord.js';
export * as ComAtprotoRepoDescribeRepo from './types/com/atproto/repo/describeRepo.js';
export * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord.js';
export * as ComAtprotoRepoImportRepo from './types/com/atproto/repo/importRepo.js';
export * as ComAtprotoRepoListMissingBlobs from './types/com/atproto/repo/listMissingBlobs.js';
export * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords.js';
export * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord.js';
export * as ComAtprotoRepoStrongRef from './types/com/atproto/repo/strongRef.js';
export * as ComAtprotoRepoUploadBlob from './types/com/atproto/repo/uploadBlob.js';
export * as PubChiveActivityGetCorrelationMetrics from './types/pub/chive/activity/getCorrelationMetrics.js';
export * as PubChiveActivityGetFeed from './types/pub/chive/activity/getFeed.js';
export * as PubChiveActivityLog from './types/pub/chive/activity/log.js';
export * as PubChiveActivityMarkFailed from './types/pub/chive/activity/markFailed.js';
export * as PubChiveActorAutocompleteAffiliation from './types/pub/chive/actor/autocompleteAffiliation.js';
export * as PubChiveActorAutocompleteKeyword from './types/pub/chive/actor/autocompleteKeyword.js';
export * as PubChiveActorAutocompleteOpenReview from './types/pub/chive/actor/autocompleteOpenReview.js';
export * as PubChiveActorAutocompleteOrcid from './types/pub/chive/actor/autocompleteOrcid.js';
export * as PubChiveActorDiscoverAuthorIds from './types/pub/chive/actor/discoverAuthorIds.js';
export * as PubChiveActorGetDiscoverySettings from './types/pub/chive/actor/getDiscoverySettings.js';
export * as PubChiveActorGetMyProfile from './types/pub/chive/actor/getMyProfile.js';
export * as PubChiveActorProfile from './types/pub/chive/actor/profile.js';
export * as PubChiveAlphaApply from './types/pub/chive/alpha/apply.js';
export * as PubChiveAlphaCheckStatus from './types/pub/chive/alpha/checkStatus.js';
export * as PubChiveAuthorGetProfile from './types/pub/chive/author/getProfile.js';
export * as PubChiveAuthorSearchAuthors from './types/pub/chive/author/searchAuthors.js';
export * as PubChiveBacklinkCreate from './types/pub/chive/backlink/create.js';
export * as PubChiveBacklinkDelete from './types/pub/chive/backlink/delete.js';
export * as PubChiveBacklinkGetCounts from './types/pub/chive/backlink/getCounts.js';
export * as PubChiveBacklinkList from './types/pub/chive/backlink/list.js';
export * as PubChiveClaimingApproveClaim from './types/pub/chive/claiming/approveClaim.js';
export * as PubChiveClaimingApproveCoauthor from './types/pub/chive/claiming/approveCoauthor.js';
export * as PubChiveClaimingAutocomplete from './types/pub/chive/claiming/autocomplete.js';
export * as PubChiveClaimingCompleteClaim from './types/pub/chive/claiming/completeClaim.js';
export * as PubChiveClaimingFetchExternalPdf from './types/pub/chive/claiming/fetchExternalPdf.js';
export * as PubChiveClaimingFindClaimable from './types/pub/chive/claiming/findClaimable.js';
export * as PubChiveClaimingGetClaim from './types/pub/chive/claiming/getClaim.js';
export * as PubChiveClaimingGetCoauthorRequests from './types/pub/chive/claiming/getCoauthorRequests.js';
export * as PubChiveClaimingGetMyCoauthorRequests from './types/pub/chive/claiming/getMyCoauthorRequests.js';
export * as PubChiveClaimingGetPendingClaims from './types/pub/chive/claiming/getPendingClaims.js';
export * as PubChiveClaimingGetSubmissionData from './types/pub/chive/claiming/getSubmissionData.js';
export * as PubChiveClaimingGetSuggestions from './types/pub/chive/claiming/getSuggestions.js';
export * as PubChiveClaimingGetUserClaims from './types/pub/chive/claiming/getUserClaims.js';
export * as PubChiveClaimingRejectClaim from './types/pub/chive/claiming/rejectClaim.js';
export * as PubChiveClaimingRejectCoauthor from './types/pub/chive/claiming/rejectCoauthor.js';
export * as PubChiveClaimingRequestCoauthorship from './types/pub/chive/claiming/requestCoauthorship.js';
export * as PubChiveClaimingSearchEprints from './types/pub/chive/claiming/searchEprints.js';
export * as PubChiveClaimingStartClaim from './types/pub/chive/claiming/startClaim.js';
export * as PubChiveClaimingStartClaimFromExternal from './types/pub/chive/claiming/startClaimFromExternal.js';
export * as PubChiveDiscoveryGetCitations from './types/pub/chive/discovery/getCitations.js';
export * as PubChiveDiscoveryGetEnrichment from './types/pub/chive/discovery/getEnrichment.js';
export * as PubChiveDiscoveryGetForYou from './types/pub/chive/discovery/getForYou.js';
export * as PubChiveDiscoveryGetRecommendations from './types/pub/chive/discovery/getRecommendations.js';
export * as PubChiveDiscoveryGetSimilar from './types/pub/chive/discovery/getSimilar.js';
export * as PubChiveDiscoveryRecordInteraction from './types/pub/chive/discovery/recordInteraction.js';
export * as PubChiveDiscoverySettings from './types/pub/chive/discovery/settings.js';
export * as PubChiveEndorsementGetSummary from './types/pub/chive/endorsement/getSummary.js';
export * as PubChiveEndorsementGetUserEndorsement from './types/pub/chive/endorsement/getUserEndorsement.js';
export * as PubChiveEndorsementListForEprint from './types/pub/chive/endorsement/listForEprint.js';
export * as PubChiveEprintAuthorContribution from './types/pub/chive/eprint/authorContribution.js';
export * as PubChiveEprintGetSubmission from './types/pub/chive/eprint/getSubmission.js';
export * as PubChiveEprintListByAuthor from './types/pub/chive/eprint/listByAuthor.js';
export * as PubChiveEprintSearchSubmissions from './types/pub/chive/eprint/searchSubmissions.js';
export * as PubChiveEprintSubmission from './types/pub/chive/eprint/submission.js';
export * as PubChiveEprintUserTag from './types/pub/chive/eprint/userTag.js';
export * as PubChiveEprintVersion from './types/pub/chive/eprint/version.js';
export * as PubChiveGovernanceApproveElevation from './types/pub/chive/governance/approveElevation.js';
export * as PubChiveGovernanceGetEditorStatus from './types/pub/chive/governance/getEditorStatus.js';
export * as PubChiveGovernanceGetPendingCount from './types/pub/chive/governance/getPendingCount.js';
export * as PubChiveGovernanceGetProposal from './types/pub/chive/governance/getProposal.js';
export * as PubChiveGovernanceGetUserVote from './types/pub/chive/governance/getUserVote.js';
export * as PubChiveGovernanceGrantDelegation from './types/pub/chive/governance/grantDelegation.js';
export * as PubChiveGovernanceListDelegations from './types/pub/chive/governance/listDelegations.js';
export * as PubChiveGovernanceListElevationRequests from './types/pub/chive/governance/listElevationRequests.js';
export * as PubChiveGovernanceListProposals from './types/pub/chive/governance/listProposals.js';
export * as PubChiveGovernanceListTrustedEditors from './types/pub/chive/governance/listTrustedEditors.js';
export * as PubChiveGovernanceListVotes from './types/pub/chive/governance/listVotes.js';
export * as PubChiveGovernanceRejectElevation from './types/pub/chive/governance/rejectElevation.js';
export * as PubChiveGovernanceRequestElevation from './types/pub/chive/governance/requestElevation.js';
export * as PubChiveGovernanceRevokeDelegation from './types/pub/chive/governance/revokeDelegation.js';
export * as PubChiveGovernanceRevokeRole from './types/pub/chive/governance/revokeRole.js';
export * as PubChiveGraphBrowseFaceted from './types/pub/chive/graph/browseFaceted.js';
export * as PubChiveGraphEdge from './types/pub/chive/graph/edge.js';
export * as PubChiveGraphEdgeProposal from './types/pub/chive/graph/edgeProposal.js';
export * as PubChiveGraphGetCommunities from './types/pub/chive/graph/getCommunities.js';
export * as PubChiveGraphGetEdge from './types/pub/chive/graph/getEdge.js';
export * as PubChiveGraphGetHierarchy from './types/pub/chive/graph/getHierarchy.js';
export * as PubChiveGraphGetNode from './types/pub/chive/graph/getNode.js';
export * as PubChiveGraphGetRelations from './types/pub/chive/graph/getRelations.js';
export * as PubChiveGraphGetSubkinds from './types/pub/chive/graph/getSubkinds.js';
export * as PubChiveGraphListEdges from './types/pub/chive/graph/listEdges.js';
export * as PubChiveGraphListNodes from './types/pub/chive/graph/listNodes.js';
export * as PubChiveGraphNode from './types/pub/chive/graph/node.js';
export * as PubChiveGraphNodeProposal from './types/pub/chive/graph/nodeProposal.js';
export * as PubChiveGraphReconciliation from './types/pub/chive/graph/reconciliation.js';
export * as PubChiveGraphSearchNodes from './types/pub/chive/graph/searchNodes.js';
export * as PubChiveGraphVote from './types/pub/chive/graph/vote.js';
export * as PubChiveImportExists from './types/pub/chive/import/exists.js';
export * as PubChiveImportGet from './types/pub/chive/import/get.js';
export * as PubChiveImportSearch from './types/pub/chive/import/search.js';
export * as PubChiveMetricsGetMetrics from './types/pub/chive/metrics/getMetrics.js';
export * as PubChiveMetricsGetTrending from './types/pub/chive/metrics/getTrending.js';
export * as PubChiveMetricsGetViewCount from './types/pub/chive/metrics/getViewCount.js';
export * as PubChiveMetricsRecordDownload from './types/pub/chive/metrics/recordDownload.js';
export * as PubChiveMetricsRecordDwellTime from './types/pub/chive/metrics/recordDwellTime.js';
export * as PubChiveMetricsRecordSearchClick from './types/pub/chive/metrics/recordSearchClick.js';
export * as PubChiveMetricsRecordSearchDownload from './types/pub/chive/metrics/recordSearchDownload.js';
export * as PubChiveMetricsRecordView from './types/pub/chive/metrics/recordView.js';
export * as PubChiveNotificationListEndorsementsOnMyPapers from './types/pub/chive/notification/listEndorsementsOnMyPapers.js';
export * as PubChiveNotificationListReviewsOnMyPapers from './types/pub/chive/notification/listReviewsOnMyPapers.js';
export * as PubChiveReviewComment from './types/pub/chive/review/comment.js';
export * as PubChiveReviewEndorsement from './types/pub/chive/review/endorsement.js';
export * as PubChiveReviewEntityLink from './types/pub/chive/review/entityLink.js';
export * as PubChiveReviewGetThread from './types/pub/chive/review/getThread.js';
export * as PubChiveReviewListForAuthor from './types/pub/chive/review/listForAuthor.js';
export * as PubChiveReviewListForEprint from './types/pub/chive/review/listForEprint.js';
export * as PubChiveSyncCheckStaleness from './types/pub/chive/sync/checkStaleness.js';
export * as PubChiveSyncIndexRecord from './types/pub/chive/sync/indexRecord.js';
export * as PubChiveSyncRefreshRecord from './types/pub/chive/sync/refreshRecord.js';
export * as PubChiveSyncRegisterPDS from './types/pub/chive/sync/registerPDS.js';
export * as PubChiveSyncVerify from './types/pub/chive/sync/verify.js';
export * as PubChiveTagGetDetail from './types/pub/chive/tag/getDetail.js';
export * as PubChiveTagGetSuggestions from './types/pub/chive/tag/getSuggestions.js';
export * as PubChiveTagGetTrending from './types/pub/chive/tag/getTrending.js';
export * as PubChiveTagListForEprint from './types/pub/chive/tag/listForEprint.js';
export * as PubChiveTagSearch from './types/pub/chive/tag/search.js';

export class AtpBaseClient extends XrpcClient {
  com: ComNS;
  pub: PubNS;

  constructor(options: FetchHandler | FetchHandlerOptions) {
    super(options, schemas);
    this.com = new ComNS(this);
    this.pub = new PubNS(this);
  }

  /** @deprecated use `this` instead */
  get xrpc(): XrpcClient {
    return this;
  }
}

export class ComNS {
  _client: XrpcClient;
  atproto: ComAtprotoNS;

  constructor(client: XrpcClient) {
    this._client = client;
    this.atproto = new ComAtprotoNS(client);
  }
}

export class ComAtprotoNS {
  _client: XrpcClient;
  repo: ComAtprotoRepoNS;

  constructor(client: XrpcClient) {
    this._client = client;
    this.repo = new ComAtprotoRepoNS(client);
  }
}

export class ComAtprotoRepoNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  applyWrites(
    data?: ComAtprotoRepoApplyWrites.InputSchema,
    opts?: ComAtprotoRepoApplyWrites.CallOptions
  ): Promise<ComAtprotoRepoApplyWrites.Response> {
    return this._client.call('com.atproto.repo.applyWrites', opts?.qp, data, opts).catch((e) => {
      throw ComAtprotoRepoApplyWrites.toKnownErr(e);
    });
  }

  createRecord(
    data?: ComAtprotoRepoCreateRecord.InputSchema,
    opts?: ComAtprotoRepoCreateRecord.CallOptions
  ): Promise<ComAtprotoRepoCreateRecord.Response> {
    return this._client.call('com.atproto.repo.createRecord', opts?.qp, data, opts).catch((e) => {
      throw ComAtprotoRepoCreateRecord.toKnownErr(e);
    });
  }

  deleteRecord(
    data?: ComAtprotoRepoDeleteRecord.InputSchema,
    opts?: ComAtprotoRepoDeleteRecord.CallOptions
  ): Promise<ComAtprotoRepoDeleteRecord.Response> {
    return this._client.call('com.atproto.repo.deleteRecord', opts?.qp, data, opts).catch((e) => {
      throw ComAtprotoRepoDeleteRecord.toKnownErr(e);
    });
  }

  describeRepo(
    params?: ComAtprotoRepoDescribeRepo.QueryParams,
    opts?: ComAtprotoRepoDescribeRepo.CallOptions
  ): Promise<ComAtprotoRepoDescribeRepo.Response> {
    return this._client.call('com.atproto.repo.describeRepo', params, undefined, opts);
  }

  getRecord(
    params?: ComAtprotoRepoGetRecord.QueryParams,
    opts?: ComAtprotoRepoGetRecord.CallOptions
  ): Promise<ComAtprotoRepoGetRecord.Response> {
    return this._client.call('com.atproto.repo.getRecord', params, undefined, opts).catch((e) => {
      throw ComAtprotoRepoGetRecord.toKnownErr(e);
    });
  }

  importRepo(
    data?: ComAtprotoRepoImportRepo.InputSchema,
    opts?: ComAtprotoRepoImportRepo.CallOptions
  ): Promise<ComAtprotoRepoImportRepo.Response> {
    return this._client.call('com.atproto.repo.importRepo', opts?.qp, data, opts);
  }

  listMissingBlobs(
    params?: ComAtprotoRepoListMissingBlobs.QueryParams,
    opts?: ComAtprotoRepoListMissingBlobs.CallOptions
  ): Promise<ComAtprotoRepoListMissingBlobs.Response> {
    return this._client.call('com.atproto.repo.listMissingBlobs', params, undefined, opts);
  }

  listRecords(
    params?: ComAtprotoRepoListRecords.QueryParams,
    opts?: ComAtprotoRepoListRecords.CallOptions
  ): Promise<ComAtprotoRepoListRecords.Response> {
    return this._client.call('com.atproto.repo.listRecords', params, undefined, opts);
  }

  putRecord(
    data?: ComAtprotoRepoPutRecord.InputSchema,
    opts?: ComAtprotoRepoPutRecord.CallOptions
  ): Promise<ComAtprotoRepoPutRecord.Response> {
    return this._client.call('com.atproto.repo.putRecord', opts?.qp, data, opts).catch((e) => {
      throw ComAtprotoRepoPutRecord.toKnownErr(e);
    });
  }

  uploadBlob(
    data?: ComAtprotoRepoUploadBlob.InputSchema,
    opts?: ComAtprotoRepoUploadBlob.CallOptions
  ): Promise<ComAtprotoRepoUploadBlob.Response> {
    return this._client.call('com.atproto.repo.uploadBlob', opts?.qp, data, opts);
  }
}

export class PubNS {
  _client: XrpcClient;
  chive: PubChiveNS;

  constructor(client: XrpcClient) {
    this._client = client;
    this.chive = new PubChiveNS(client);
  }
}

export class PubChiveNS {
  _client: XrpcClient;
  activity: PubChiveActivityNS;
  actor: PubChiveActorNS;
  alpha: PubChiveAlphaNS;
  author: PubChiveAuthorNS;
  backlink: PubChiveBacklinkNS;
  claiming: PubChiveClaimingNS;
  discovery: PubChiveDiscoveryNS;
  endorsement: PubChiveEndorsementNS;
  eprint: PubChiveEprintNS;
  governance: PubChiveGovernanceNS;
  graph: PubChiveGraphNS;
  import: PubChiveImportNS;
  metrics: PubChiveMetricsNS;
  notification: PubChiveNotificationNS;
  review: PubChiveReviewNS;
  sync: PubChiveSyncNS;
  tag: PubChiveTagNS;

  constructor(client: XrpcClient) {
    this._client = client;
    this.activity = new PubChiveActivityNS(client);
    this.actor = new PubChiveActorNS(client);
    this.alpha = new PubChiveAlphaNS(client);
    this.author = new PubChiveAuthorNS(client);
    this.backlink = new PubChiveBacklinkNS(client);
    this.claiming = new PubChiveClaimingNS(client);
    this.discovery = new PubChiveDiscoveryNS(client);
    this.endorsement = new PubChiveEndorsementNS(client);
    this.eprint = new PubChiveEprintNS(client);
    this.governance = new PubChiveGovernanceNS(client);
    this.graph = new PubChiveGraphNS(client);
    this.import = new PubChiveImportNS(client);
    this.metrics = new PubChiveMetricsNS(client);
    this.notification = new PubChiveNotificationNS(client);
    this.review = new PubChiveReviewNS(client);
    this.sync = new PubChiveSyncNS(client);
    this.tag = new PubChiveTagNS(client);
  }
}

export class PubChiveActivityNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  getCorrelationMetrics(
    params?: PubChiveActivityGetCorrelationMetrics.QueryParams,
    opts?: PubChiveActivityGetCorrelationMetrics.CallOptions
  ): Promise<PubChiveActivityGetCorrelationMetrics.Response> {
    return this._client
      .call('pub.chive.activity.getCorrelationMetrics', params, undefined, opts)
      .catch((e) => {
        throw PubChiveActivityGetCorrelationMetrics.toKnownErr(e);
      });
  }

  getFeed(
    params?: PubChiveActivityGetFeed.QueryParams,
    opts?: PubChiveActivityGetFeed.CallOptions
  ): Promise<PubChiveActivityGetFeed.Response> {
    return this._client.call('pub.chive.activity.getFeed', params, undefined, opts).catch((e) => {
      throw PubChiveActivityGetFeed.toKnownErr(e);
    });
  }

  log(
    data?: PubChiveActivityLog.InputSchema,
    opts?: PubChiveActivityLog.CallOptions
  ): Promise<PubChiveActivityLog.Response> {
    return this._client.call('pub.chive.activity.log', opts?.qp, data, opts).catch((e) => {
      throw PubChiveActivityLog.toKnownErr(e);
    });
  }

  markFailed(
    data?: PubChiveActivityMarkFailed.InputSchema,
    opts?: PubChiveActivityMarkFailed.CallOptions
  ): Promise<PubChiveActivityMarkFailed.Response> {
    return this._client.call('pub.chive.activity.markFailed', opts?.qp, data, opts).catch((e) => {
      throw PubChiveActivityMarkFailed.toKnownErr(e);
    });
  }
}

export class PubChiveActorNS {
  _client: XrpcClient;
  profile: PubChiveActorProfileRecord;

  constructor(client: XrpcClient) {
    this._client = client;
    this.profile = new PubChiveActorProfileRecord(client);
  }

  autocompleteAffiliation(
    params?: PubChiveActorAutocompleteAffiliation.QueryParams,
    opts?: PubChiveActorAutocompleteAffiliation.CallOptions
  ): Promise<PubChiveActorAutocompleteAffiliation.Response> {
    return this._client.call('pub.chive.actor.autocompleteAffiliation', params, undefined, opts);
  }

  autocompleteKeyword(
    params?: PubChiveActorAutocompleteKeyword.QueryParams,
    opts?: PubChiveActorAutocompleteKeyword.CallOptions
  ): Promise<PubChiveActorAutocompleteKeyword.Response> {
    return this._client.call('pub.chive.actor.autocompleteKeyword', params, undefined, opts);
  }

  autocompleteOpenReview(
    params?: PubChiveActorAutocompleteOpenReview.QueryParams,
    opts?: PubChiveActorAutocompleteOpenReview.CallOptions
  ): Promise<PubChiveActorAutocompleteOpenReview.Response> {
    return this._client.call('pub.chive.actor.autocompleteOpenReview', params, undefined, opts);
  }

  autocompleteOrcid(
    params?: PubChiveActorAutocompleteOrcid.QueryParams,
    opts?: PubChiveActorAutocompleteOrcid.CallOptions
  ): Promise<PubChiveActorAutocompleteOrcid.Response> {
    return this._client.call('pub.chive.actor.autocompleteOrcid', params, undefined, opts);
  }

  discoverAuthorIds(
    params?: PubChiveActorDiscoverAuthorIds.QueryParams,
    opts?: PubChiveActorDiscoverAuthorIds.CallOptions
  ): Promise<PubChiveActorDiscoverAuthorIds.Response> {
    return this._client
      .call('pub.chive.actor.discoverAuthorIds', params, undefined, opts)
      .catch((e) => {
        throw PubChiveActorDiscoverAuthorIds.toKnownErr(e);
      });
  }

  getDiscoverySettings(
    params?: PubChiveActorGetDiscoverySettings.QueryParams,
    opts?: PubChiveActorGetDiscoverySettings.CallOptions
  ): Promise<PubChiveActorGetDiscoverySettings.Response> {
    return this._client
      .call('pub.chive.actor.getDiscoverySettings', params, undefined, opts)
      .catch((e) => {
        throw PubChiveActorGetDiscoverySettings.toKnownErr(e);
      });
  }

  getMyProfile(
    params?: PubChiveActorGetMyProfile.QueryParams,
    opts?: PubChiveActorGetMyProfile.CallOptions
  ): Promise<PubChiveActorGetMyProfile.Response> {
    return this._client.call('pub.chive.actor.getMyProfile', params, undefined, opts).catch((e) => {
      throw PubChiveActorGetMyProfile.toKnownErr(e);
    });
  }
}

export class PubChiveActorProfileRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveActorProfile.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.actor.profile',
      ...params,
    });
    return res.data;
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string; cid: string; value: PubChiveActorProfile.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.actor.profile',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveActorProfile.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.actor.profile';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveActorProfile.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.actor.profile';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.actor.profile', ...params },
      { headers }
    );
  }
}

export class PubChiveAlphaNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  apply(
    data?: PubChiveAlphaApply.InputSchema,
    opts?: PubChiveAlphaApply.CallOptions
  ): Promise<PubChiveAlphaApply.Response> {
    return this._client.call('pub.chive.alpha.apply', opts?.qp, data, opts).catch((e) => {
      throw PubChiveAlphaApply.toKnownErr(e);
    });
  }

  checkStatus(
    params?: PubChiveAlphaCheckStatus.QueryParams,
    opts?: PubChiveAlphaCheckStatus.CallOptions
  ): Promise<PubChiveAlphaCheckStatus.Response> {
    return this._client.call('pub.chive.alpha.checkStatus', params, undefined, opts).catch((e) => {
      throw PubChiveAlphaCheckStatus.toKnownErr(e);
    });
  }
}

export class PubChiveAuthorNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  getProfile(
    params?: PubChiveAuthorGetProfile.QueryParams,
    opts?: PubChiveAuthorGetProfile.CallOptions
  ): Promise<PubChiveAuthorGetProfile.Response> {
    return this._client.call('pub.chive.author.getProfile', params, undefined, opts).catch((e) => {
      throw PubChiveAuthorGetProfile.toKnownErr(e);
    });
  }

  searchAuthors(
    params?: PubChiveAuthorSearchAuthors.QueryParams,
    opts?: PubChiveAuthorSearchAuthors.CallOptions
  ): Promise<PubChiveAuthorSearchAuthors.Response> {
    return this._client.call('pub.chive.author.searchAuthors', params, undefined, opts);
  }
}

export class PubChiveBacklinkNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  create(
    data?: PubChiveBacklinkCreate.InputSchema,
    opts?: PubChiveBacklinkCreate.CallOptions
  ): Promise<PubChiveBacklinkCreate.Response> {
    return this._client.call('pub.chive.backlink.create', opts?.qp, data, opts).catch((e) => {
      throw PubChiveBacklinkCreate.toKnownErr(e);
    });
  }

  delete(
    data?: PubChiveBacklinkDelete.InputSchema,
    opts?: PubChiveBacklinkDelete.CallOptions
  ): Promise<PubChiveBacklinkDelete.Response> {
    return this._client.call('pub.chive.backlink.delete', opts?.qp, data, opts).catch((e) => {
      throw PubChiveBacklinkDelete.toKnownErr(e);
    });
  }

  getCounts(
    params?: PubChiveBacklinkGetCounts.QueryParams,
    opts?: PubChiveBacklinkGetCounts.CallOptions
  ): Promise<PubChiveBacklinkGetCounts.Response> {
    return this._client.call('pub.chive.backlink.getCounts', params, undefined, opts).catch((e) => {
      throw PubChiveBacklinkGetCounts.toKnownErr(e);
    });
  }

  list(
    params?: PubChiveBacklinkList.QueryParams,
    opts?: PubChiveBacklinkList.CallOptions
  ): Promise<PubChiveBacklinkList.Response> {
    return this._client.call('pub.chive.backlink.list', params, undefined, opts).catch((e) => {
      throw PubChiveBacklinkList.toKnownErr(e);
    });
  }
}

export class PubChiveClaimingNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  approveClaim(
    data?: PubChiveClaimingApproveClaim.InputSchema,
    opts?: PubChiveClaimingApproveClaim.CallOptions
  ): Promise<PubChiveClaimingApproveClaim.Response> {
    return this._client.call('pub.chive.claiming.approveClaim', opts?.qp, data, opts).catch((e) => {
      throw PubChiveClaimingApproveClaim.toKnownErr(e);
    });
  }

  approveCoauthor(
    data?: PubChiveClaimingApproveCoauthor.InputSchema,
    opts?: PubChiveClaimingApproveCoauthor.CallOptions
  ): Promise<PubChiveClaimingApproveCoauthor.Response> {
    return this._client
      .call('pub.chive.claiming.approveCoauthor', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveClaimingApproveCoauthor.toKnownErr(e);
      });
  }

  autocomplete(
    params?: PubChiveClaimingAutocomplete.QueryParams,
    opts?: PubChiveClaimingAutocomplete.CallOptions
  ): Promise<PubChiveClaimingAutocomplete.Response> {
    return this._client.call('pub.chive.claiming.autocomplete', params, undefined, opts);
  }

  completeClaim(
    data?: PubChiveClaimingCompleteClaim.InputSchema,
    opts?: PubChiveClaimingCompleteClaim.CallOptions
  ): Promise<PubChiveClaimingCompleteClaim.Response> {
    return this._client
      .call('pub.chive.claiming.completeClaim', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveClaimingCompleteClaim.toKnownErr(e);
      });
  }

  fetchExternalPdf(
    params?: PubChiveClaimingFetchExternalPdf.QueryParams,
    opts?: PubChiveClaimingFetchExternalPdf.CallOptions
  ): Promise<PubChiveClaimingFetchExternalPdf.Response> {
    return this._client
      .call('pub.chive.claiming.fetchExternalPdf', params, undefined, opts)
      .catch((e) => {
        throw PubChiveClaimingFetchExternalPdf.toKnownErr(e);
      });
  }

  findClaimable(
    params?: PubChiveClaimingFindClaimable.QueryParams,
    opts?: PubChiveClaimingFindClaimable.CallOptions
  ): Promise<PubChiveClaimingFindClaimable.Response> {
    return this._client
      .call('pub.chive.claiming.findClaimable', params, undefined, opts)
      .catch((e) => {
        throw PubChiveClaimingFindClaimable.toKnownErr(e);
      });
  }

  getClaim(
    params?: PubChiveClaimingGetClaim.QueryParams,
    opts?: PubChiveClaimingGetClaim.CallOptions
  ): Promise<PubChiveClaimingGetClaim.Response> {
    return this._client.call('pub.chive.claiming.getClaim', params, undefined, opts).catch((e) => {
      throw PubChiveClaimingGetClaim.toKnownErr(e);
    });
  }

  getCoauthorRequests(
    params?: PubChiveClaimingGetCoauthorRequests.QueryParams,
    opts?: PubChiveClaimingGetCoauthorRequests.CallOptions
  ): Promise<PubChiveClaimingGetCoauthorRequests.Response> {
    return this._client
      .call('pub.chive.claiming.getCoauthorRequests', params, undefined, opts)
      .catch((e) => {
        throw PubChiveClaimingGetCoauthorRequests.toKnownErr(e);
      });
  }

  getMyCoauthorRequests(
    params?: PubChiveClaimingGetMyCoauthorRequests.QueryParams,
    opts?: PubChiveClaimingGetMyCoauthorRequests.CallOptions
  ): Promise<PubChiveClaimingGetMyCoauthorRequests.Response> {
    return this._client
      .call('pub.chive.claiming.getMyCoauthorRequests', params, undefined, opts)
      .catch((e) => {
        throw PubChiveClaimingGetMyCoauthorRequests.toKnownErr(e);
      });
  }

  getPendingClaims(
    params?: PubChiveClaimingGetPendingClaims.QueryParams,
    opts?: PubChiveClaimingGetPendingClaims.CallOptions
  ): Promise<PubChiveClaimingGetPendingClaims.Response> {
    return this._client
      .call('pub.chive.claiming.getPendingClaims', params, undefined, opts)
      .catch((e) => {
        throw PubChiveClaimingGetPendingClaims.toKnownErr(e);
      });
  }

  getSubmissionData(
    params?: PubChiveClaimingGetSubmissionData.QueryParams,
    opts?: PubChiveClaimingGetSubmissionData.CallOptions
  ): Promise<PubChiveClaimingGetSubmissionData.Response> {
    return this._client
      .call('pub.chive.claiming.getSubmissionData', params, undefined, opts)
      .catch((e) => {
        throw PubChiveClaimingGetSubmissionData.toKnownErr(e);
      });
  }

  getSuggestions(
    params?: PubChiveClaimingGetSuggestions.QueryParams,
    opts?: PubChiveClaimingGetSuggestions.CallOptions
  ): Promise<PubChiveClaimingGetSuggestions.Response> {
    return this._client
      .call('pub.chive.claiming.getSuggestions', params, undefined, opts)
      .catch((e) => {
        throw PubChiveClaimingGetSuggestions.toKnownErr(e);
      });
  }

  getUserClaims(
    params?: PubChiveClaimingGetUserClaims.QueryParams,
    opts?: PubChiveClaimingGetUserClaims.CallOptions
  ): Promise<PubChiveClaimingGetUserClaims.Response> {
    return this._client
      .call('pub.chive.claiming.getUserClaims', params, undefined, opts)
      .catch((e) => {
        throw PubChiveClaimingGetUserClaims.toKnownErr(e);
      });
  }

  rejectClaim(
    data?: PubChiveClaimingRejectClaim.InputSchema,
    opts?: PubChiveClaimingRejectClaim.CallOptions
  ): Promise<PubChiveClaimingRejectClaim.Response> {
    return this._client.call('pub.chive.claiming.rejectClaim', opts?.qp, data, opts).catch((e) => {
      throw PubChiveClaimingRejectClaim.toKnownErr(e);
    });
  }

  rejectCoauthor(
    data?: PubChiveClaimingRejectCoauthor.InputSchema,
    opts?: PubChiveClaimingRejectCoauthor.CallOptions
  ): Promise<PubChiveClaimingRejectCoauthor.Response> {
    return this._client
      .call('pub.chive.claiming.rejectCoauthor', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveClaimingRejectCoauthor.toKnownErr(e);
      });
  }

  requestCoauthorship(
    data?: PubChiveClaimingRequestCoauthorship.InputSchema,
    opts?: PubChiveClaimingRequestCoauthorship.CallOptions
  ): Promise<PubChiveClaimingRequestCoauthorship.Response> {
    return this._client
      .call('pub.chive.claiming.requestCoauthorship', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveClaimingRequestCoauthorship.toKnownErr(e);
      });
  }

  searchEprints(
    params?: PubChiveClaimingSearchEprints.QueryParams,
    opts?: PubChiveClaimingSearchEprints.CallOptions
  ): Promise<PubChiveClaimingSearchEprints.Response> {
    return this._client
      .call('pub.chive.claiming.searchEprints', params, undefined, opts)
      .catch((e) => {
        throw PubChiveClaimingSearchEprints.toKnownErr(e);
      });
  }

  startClaim(
    data?: PubChiveClaimingStartClaim.InputSchema,
    opts?: PubChiveClaimingStartClaim.CallOptions
  ): Promise<PubChiveClaimingStartClaim.Response> {
    return this._client.call('pub.chive.claiming.startClaim', opts?.qp, data, opts).catch((e) => {
      throw PubChiveClaimingStartClaim.toKnownErr(e);
    });
  }

  startClaimFromExternal(
    data?: PubChiveClaimingStartClaimFromExternal.InputSchema,
    opts?: PubChiveClaimingStartClaimFromExternal.CallOptions
  ): Promise<PubChiveClaimingStartClaimFromExternal.Response> {
    return this._client
      .call('pub.chive.claiming.startClaimFromExternal', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveClaimingStartClaimFromExternal.toKnownErr(e);
      });
  }
}

export class PubChiveDiscoveryNS {
  _client: XrpcClient;
  settings: PubChiveDiscoverySettingsRecord;

  constructor(client: XrpcClient) {
    this._client = client;
    this.settings = new PubChiveDiscoverySettingsRecord(client);
  }

  getCitations(
    params?: PubChiveDiscoveryGetCitations.QueryParams,
    opts?: PubChiveDiscoveryGetCitations.CallOptions
  ): Promise<PubChiveDiscoveryGetCitations.Response> {
    return this._client
      .call('pub.chive.discovery.getCitations', params, undefined, opts)
      .catch((e) => {
        throw PubChiveDiscoveryGetCitations.toKnownErr(e);
      });
  }

  getEnrichment(
    params?: PubChiveDiscoveryGetEnrichment.QueryParams,
    opts?: PubChiveDiscoveryGetEnrichment.CallOptions
  ): Promise<PubChiveDiscoveryGetEnrichment.Response> {
    return this._client
      .call('pub.chive.discovery.getEnrichment', params, undefined, opts)
      .catch((e) => {
        throw PubChiveDiscoveryGetEnrichment.toKnownErr(e);
      });
  }

  getForYou(
    params?: PubChiveDiscoveryGetForYou.QueryParams,
    opts?: PubChiveDiscoveryGetForYou.CallOptions
  ): Promise<PubChiveDiscoveryGetForYou.Response> {
    return this._client
      .call('pub.chive.discovery.getForYou', params, undefined, opts)
      .catch((e) => {
        throw PubChiveDiscoveryGetForYou.toKnownErr(e);
      });
  }

  getRecommendations(
    params?: PubChiveDiscoveryGetRecommendations.QueryParams,
    opts?: PubChiveDiscoveryGetRecommendations.CallOptions
  ): Promise<PubChiveDiscoveryGetRecommendations.Response> {
    return this._client
      .call('pub.chive.discovery.getRecommendations', params, undefined, opts)
      .catch((e) => {
        throw PubChiveDiscoveryGetRecommendations.toKnownErr(e);
      });
  }

  getSimilar(
    params?: PubChiveDiscoveryGetSimilar.QueryParams,
    opts?: PubChiveDiscoveryGetSimilar.CallOptions
  ): Promise<PubChiveDiscoveryGetSimilar.Response> {
    return this._client
      .call('pub.chive.discovery.getSimilar', params, undefined, opts)
      .catch((e) => {
        throw PubChiveDiscoveryGetSimilar.toKnownErr(e);
      });
  }

  recordInteraction(
    data?: PubChiveDiscoveryRecordInteraction.InputSchema,
    opts?: PubChiveDiscoveryRecordInteraction.CallOptions
  ): Promise<PubChiveDiscoveryRecordInteraction.Response> {
    return this._client
      .call('pub.chive.discovery.recordInteraction', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveDiscoveryRecordInteraction.toKnownErr(e);
      });
  }
}

export class PubChiveDiscoverySettingsRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveDiscoverySettings.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.discovery.settings',
      ...params,
    });
    return res.data;
  }

  async get(params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>): Promise<{
    uri: string;
    cid: string;
    value: PubChiveDiscoverySettings.Record;
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.discovery.settings',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveDiscoverySettings.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.discovery.settings';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveDiscoverySettings.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.discovery.settings';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.discovery.settings', ...params },
      { headers }
    );
  }
}

export class PubChiveEndorsementNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  getSummary(
    params?: PubChiveEndorsementGetSummary.QueryParams,
    opts?: PubChiveEndorsementGetSummary.CallOptions
  ): Promise<PubChiveEndorsementGetSummary.Response> {
    return this._client.call('pub.chive.endorsement.getSummary', params, undefined, opts);
  }

  getUserEndorsement(
    params?: PubChiveEndorsementGetUserEndorsement.QueryParams,
    opts?: PubChiveEndorsementGetUserEndorsement.CallOptions
  ): Promise<PubChiveEndorsementGetUserEndorsement.Response> {
    return this._client
      .call('pub.chive.endorsement.getUserEndorsement', params, undefined, opts)
      .catch((e) => {
        throw PubChiveEndorsementGetUserEndorsement.toKnownErr(e);
      });
  }

  listForEprint(
    params?: PubChiveEndorsementListForEprint.QueryParams,
    opts?: PubChiveEndorsementListForEprint.CallOptions
  ): Promise<PubChiveEndorsementListForEprint.Response> {
    return this._client.call('pub.chive.endorsement.listForEprint', params, undefined, opts);
  }
}

export class PubChiveEprintNS {
  _client: XrpcClient;
  submission: PubChiveEprintSubmissionRecord;
  userTag: PubChiveEprintUserTagRecord;
  version: PubChiveEprintVersionRecord;

  constructor(client: XrpcClient) {
    this._client = client;
    this.submission = new PubChiveEprintSubmissionRecord(client);
    this.userTag = new PubChiveEprintUserTagRecord(client);
    this.version = new PubChiveEprintVersionRecord(client);
  }

  getSubmission(
    params?: PubChiveEprintGetSubmission.QueryParams,
    opts?: PubChiveEprintGetSubmission.CallOptions
  ): Promise<PubChiveEprintGetSubmission.Response> {
    return this._client
      .call('pub.chive.eprint.getSubmission', params, undefined, opts)
      .catch((e) => {
        throw PubChiveEprintGetSubmission.toKnownErr(e);
      });
  }

  listByAuthor(
    params?: PubChiveEprintListByAuthor.QueryParams,
    opts?: PubChiveEprintListByAuthor.CallOptions
  ): Promise<PubChiveEprintListByAuthor.Response> {
    return this._client
      .call('pub.chive.eprint.listByAuthor', params, undefined, opts)
      .catch((e) => {
        throw PubChiveEprintListByAuthor.toKnownErr(e);
      });
  }

  searchSubmissions(
    params?: PubChiveEprintSearchSubmissions.QueryParams,
    opts?: PubChiveEprintSearchSubmissions.CallOptions
  ): Promise<PubChiveEprintSearchSubmissions.Response> {
    return this._client.call('pub.chive.eprint.searchSubmissions', params, undefined, opts);
  }
}

export class PubChiveEprintSubmissionRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveEprintSubmission.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.eprint.submission',
      ...params,
    });
    return res.data;
  }

  async get(params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>): Promise<{
    uri: string;
    cid: string;
    value: PubChiveEprintSubmission.Record;
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.eprint.submission',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveEprintSubmission.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.eprint.submission';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveEprintSubmission.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.eprint.submission';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.eprint.submission', ...params },
      { headers }
    );
  }
}

export class PubChiveEprintUserTagRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveEprintUserTag.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.eprint.userTag',
      ...params,
    });
    return res.data;
  }

  async get(params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>): Promise<{
    uri: string;
    cid: string;
    value: PubChiveEprintUserTag.Record;
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.eprint.userTag',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveEprintUserTag.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.eprint.userTag';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveEprintUserTag.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.eprint.userTag';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.eprint.userTag', ...params },
      { headers }
    );
  }
}

export class PubChiveEprintVersionRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveEprintVersion.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.eprint.version',
      ...params,
    });
    return res.data;
  }

  async get(params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>): Promise<{
    uri: string;
    cid: string;
    value: PubChiveEprintVersion.Record;
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.eprint.version',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveEprintVersion.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.eprint.version';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveEprintVersion.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.eprint.version';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.eprint.version', ...params },
      { headers }
    );
  }
}

export class PubChiveGovernanceNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  approveElevation(
    data?: PubChiveGovernanceApproveElevation.InputSchema,
    opts?: PubChiveGovernanceApproveElevation.CallOptions
  ): Promise<PubChiveGovernanceApproveElevation.Response> {
    return this._client
      .call('pub.chive.governance.approveElevation', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveGovernanceApproveElevation.toKnownErr(e);
      });
  }

  getEditorStatus(
    params?: PubChiveGovernanceGetEditorStatus.QueryParams,
    opts?: PubChiveGovernanceGetEditorStatus.CallOptions
  ): Promise<PubChiveGovernanceGetEditorStatus.Response> {
    return this._client
      .call('pub.chive.governance.getEditorStatus', params, undefined, opts)
      .catch((e) => {
        throw PubChiveGovernanceGetEditorStatus.toKnownErr(e);
      });
  }

  getPendingCount(
    params?: PubChiveGovernanceGetPendingCount.QueryParams,
    opts?: PubChiveGovernanceGetPendingCount.CallOptions
  ): Promise<PubChiveGovernanceGetPendingCount.Response> {
    return this._client.call('pub.chive.governance.getPendingCount', params, undefined, opts);
  }

  getProposal(
    params?: PubChiveGovernanceGetProposal.QueryParams,
    opts?: PubChiveGovernanceGetProposal.CallOptions
  ): Promise<PubChiveGovernanceGetProposal.Response> {
    return this._client
      .call('pub.chive.governance.getProposal', params, undefined, opts)
      .catch((e) => {
        throw PubChiveGovernanceGetProposal.toKnownErr(e);
      });
  }

  getUserVote(
    params?: PubChiveGovernanceGetUserVote.QueryParams,
    opts?: PubChiveGovernanceGetUserVote.CallOptions
  ): Promise<PubChiveGovernanceGetUserVote.Response> {
    return this._client
      .call('pub.chive.governance.getUserVote', params, undefined, opts)
      .catch((e) => {
        throw PubChiveGovernanceGetUserVote.toKnownErr(e);
      });
  }

  grantDelegation(
    data?: PubChiveGovernanceGrantDelegation.InputSchema,
    opts?: PubChiveGovernanceGrantDelegation.CallOptions
  ): Promise<PubChiveGovernanceGrantDelegation.Response> {
    return this._client
      .call('pub.chive.governance.grantDelegation', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveGovernanceGrantDelegation.toKnownErr(e);
      });
  }

  listDelegations(
    params?: PubChiveGovernanceListDelegations.QueryParams,
    opts?: PubChiveGovernanceListDelegations.CallOptions
  ): Promise<PubChiveGovernanceListDelegations.Response> {
    return this._client
      .call('pub.chive.governance.listDelegations', params, undefined, opts)
      .catch((e) => {
        throw PubChiveGovernanceListDelegations.toKnownErr(e);
      });
  }

  listElevationRequests(
    params?: PubChiveGovernanceListElevationRequests.QueryParams,
    opts?: PubChiveGovernanceListElevationRequests.CallOptions
  ): Promise<PubChiveGovernanceListElevationRequests.Response> {
    return this._client
      .call('pub.chive.governance.listElevationRequests', params, undefined, opts)
      .catch((e) => {
        throw PubChiveGovernanceListElevationRequests.toKnownErr(e);
      });
  }

  listProposals(
    params?: PubChiveGovernanceListProposals.QueryParams,
    opts?: PubChiveGovernanceListProposals.CallOptions
  ): Promise<PubChiveGovernanceListProposals.Response> {
    return this._client.call('pub.chive.governance.listProposals', params, undefined, opts);
  }

  listTrustedEditors(
    params?: PubChiveGovernanceListTrustedEditors.QueryParams,
    opts?: PubChiveGovernanceListTrustedEditors.CallOptions
  ): Promise<PubChiveGovernanceListTrustedEditors.Response> {
    return this._client
      .call('pub.chive.governance.listTrustedEditors', params, undefined, opts)
      .catch((e) => {
        throw PubChiveGovernanceListTrustedEditors.toKnownErr(e);
      });
  }

  listVotes(
    params?: PubChiveGovernanceListVotes.QueryParams,
    opts?: PubChiveGovernanceListVotes.CallOptions
  ): Promise<PubChiveGovernanceListVotes.Response> {
    return this._client.call('pub.chive.governance.listVotes', params, undefined, opts);
  }

  rejectElevation(
    data?: PubChiveGovernanceRejectElevation.InputSchema,
    opts?: PubChiveGovernanceRejectElevation.CallOptions
  ): Promise<PubChiveGovernanceRejectElevation.Response> {
    return this._client
      .call('pub.chive.governance.rejectElevation', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveGovernanceRejectElevation.toKnownErr(e);
      });
  }

  requestElevation(
    data?: PubChiveGovernanceRequestElevation.InputSchema,
    opts?: PubChiveGovernanceRequestElevation.CallOptions
  ): Promise<PubChiveGovernanceRequestElevation.Response> {
    return this._client
      .call('pub.chive.governance.requestElevation', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveGovernanceRequestElevation.toKnownErr(e);
      });
  }

  revokeDelegation(
    data?: PubChiveGovernanceRevokeDelegation.InputSchema,
    opts?: PubChiveGovernanceRevokeDelegation.CallOptions
  ): Promise<PubChiveGovernanceRevokeDelegation.Response> {
    return this._client
      .call('pub.chive.governance.revokeDelegation', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveGovernanceRevokeDelegation.toKnownErr(e);
      });
  }

  revokeRole(
    data?: PubChiveGovernanceRevokeRole.InputSchema,
    opts?: PubChiveGovernanceRevokeRole.CallOptions
  ): Promise<PubChiveGovernanceRevokeRole.Response> {
    return this._client.call('pub.chive.governance.revokeRole', opts?.qp, data, opts).catch((e) => {
      throw PubChiveGovernanceRevokeRole.toKnownErr(e);
    });
  }
}

export class PubChiveGraphNS {
  _client: XrpcClient;
  edge: PubChiveGraphEdgeRecord;
  edgeProposal: PubChiveGraphEdgeProposalRecord;
  node: PubChiveGraphNodeRecord;
  nodeProposal: PubChiveGraphNodeProposalRecord;
  reconciliation: PubChiveGraphReconciliationRecord;
  vote: PubChiveGraphVoteRecord;

  constructor(client: XrpcClient) {
    this._client = client;
    this.edge = new PubChiveGraphEdgeRecord(client);
    this.edgeProposal = new PubChiveGraphEdgeProposalRecord(client);
    this.node = new PubChiveGraphNodeRecord(client);
    this.nodeProposal = new PubChiveGraphNodeProposalRecord(client);
    this.reconciliation = new PubChiveGraphReconciliationRecord(client);
    this.vote = new PubChiveGraphVoteRecord(client);
  }

  browseFaceted(
    params?: PubChiveGraphBrowseFaceted.QueryParams,
    opts?: PubChiveGraphBrowseFaceted.CallOptions
  ): Promise<PubChiveGraphBrowseFaceted.Response> {
    return this._client.call('pub.chive.graph.browseFaceted', params, undefined, opts);
  }

  getCommunities(
    params?: PubChiveGraphGetCommunities.QueryParams,
    opts?: PubChiveGraphGetCommunities.CallOptions
  ): Promise<PubChiveGraphGetCommunities.Response> {
    return this._client.call('pub.chive.graph.getCommunities', params, undefined, opts);
  }

  getEdge(
    params?: PubChiveGraphGetEdge.QueryParams,
    opts?: PubChiveGraphGetEdge.CallOptions
  ): Promise<PubChiveGraphGetEdge.Response> {
    return this._client.call('pub.chive.graph.getEdge', params, undefined, opts).catch((e) => {
      throw PubChiveGraphGetEdge.toKnownErr(e);
    });
  }

  getHierarchy(
    params?: PubChiveGraphGetHierarchy.QueryParams,
    opts?: PubChiveGraphGetHierarchy.CallOptions
  ): Promise<PubChiveGraphGetHierarchy.Response> {
    return this._client.call('pub.chive.graph.getHierarchy', params, undefined, opts);
  }

  getNode(
    params?: PubChiveGraphGetNode.QueryParams,
    opts?: PubChiveGraphGetNode.CallOptions
  ): Promise<PubChiveGraphGetNode.Response> {
    return this._client.call('pub.chive.graph.getNode', params, undefined, opts).catch((e) => {
      throw PubChiveGraphGetNode.toKnownErr(e);
    });
  }

  getRelations(
    params?: PubChiveGraphGetRelations.QueryParams,
    opts?: PubChiveGraphGetRelations.CallOptions
  ): Promise<PubChiveGraphGetRelations.Response> {
    return this._client.call('pub.chive.graph.getRelations', params, undefined, opts);
  }

  getSubkinds(
    params?: PubChiveGraphGetSubkinds.QueryParams,
    opts?: PubChiveGraphGetSubkinds.CallOptions
  ): Promise<PubChiveGraphGetSubkinds.Response> {
    return this._client.call('pub.chive.graph.getSubkinds', params, undefined, opts);
  }

  listEdges(
    params?: PubChiveGraphListEdges.QueryParams,
    opts?: PubChiveGraphListEdges.CallOptions
  ): Promise<PubChiveGraphListEdges.Response> {
    return this._client.call('pub.chive.graph.listEdges', params, undefined, opts);
  }

  listNodes(
    params?: PubChiveGraphListNodes.QueryParams,
    opts?: PubChiveGraphListNodes.CallOptions
  ): Promise<PubChiveGraphListNodes.Response> {
    return this._client.call('pub.chive.graph.listNodes', params, undefined, opts);
  }

  searchNodes(
    params?: PubChiveGraphSearchNodes.QueryParams,
    opts?: PubChiveGraphSearchNodes.CallOptions
  ): Promise<PubChiveGraphSearchNodes.Response> {
    return this._client.call('pub.chive.graph.searchNodes', params, undefined, opts);
  }
}

export class PubChiveGraphEdgeRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveGraphEdge.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.graph.edge',
      ...params,
    });
    return res.data;
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string; cid: string; value: PubChiveGraphEdge.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.graph.edge',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphEdge.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.edge';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphEdge.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.edge';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.graph.edge', ...params },
      { headers }
    );
  }
}

export class PubChiveGraphEdgeProposalRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveGraphEdgeProposal.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.graph.edgeProposal',
      ...params,
    });
    return res.data;
  }

  async get(params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>): Promise<{
    uri: string;
    cid: string;
    value: PubChiveGraphEdgeProposal.Record;
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.graph.edgeProposal',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphEdgeProposal.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.edgeProposal';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphEdgeProposal.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.edgeProposal';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.graph.edgeProposal', ...params },
      { headers }
    );
  }
}

export class PubChiveGraphNodeRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveGraphNode.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.graph.node',
      ...params,
    });
    return res.data;
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string; cid: string; value: PubChiveGraphNode.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.graph.node',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphNode.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.node';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphNode.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.node';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.graph.node', ...params },
      { headers }
    );
  }
}

export class PubChiveGraphNodeProposalRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveGraphNodeProposal.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.graph.nodeProposal',
      ...params,
    });
    return res.data;
  }

  async get(params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>): Promise<{
    uri: string;
    cid: string;
    value: PubChiveGraphNodeProposal.Record;
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.graph.nodeProposal',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphNodeProposal.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.nodeProposal';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphNodeProposal.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.nodeProposal';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.graph.nodeProposal', ...params },
      { headers }
    );
  }
}

export class PubChiveGraphReconciliationRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveGraphReconciliation.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.graph.reconciliation',
      ...params,
    });
    return res.data;
  }

  async get(params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>): Promise<{
    uri: string;
    cid: string;
    value: PubChiveGraphReconciliation.Record;
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.graph.reconciliation',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphReconciliation.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.reconciliation';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphReconciliation.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.reconciliation';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.graph.reconciliation', ...params },
      { headers }
    );
  }
}

export class PubChiveGraphVoteRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveGraphVote.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.graph.vote',
      ...params,
    });
    return res.data;
  }

  async get(
    params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>
  ): Promise<{ uri: string; cid: string; value: PubChiveGraphVote.Record }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.graph.vote',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphVote.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.vote';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveGraphVote.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.graph.vote';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.graph.vote', ...params },
      { headers }
    );
  }
}

export class PubChiveImportNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  exists(
    params?: PubChiveImportExists.QueryParams,
    opts?: PubChiveImportExists.CallOptions
  ): Promise<PubChiveImportExists.Response> {
    return this._client.call('pub.chive.import.exists', params, undefined, opts);
  }

  get(
    params?: PubChiveImportGet.QueryParams,
    opts?: PubChiveImportGet.CallOptions
  ): Promise<PubChiveImportGet.Response> {
    return this._client.call('pub.chive.import.get', params, undefined, opts).catch((e) => {
      throw PubChiveImportGet.toKnownErr(e);
    });
  }

  search(
    params?: PubChiveImportSearch.QueryParams,
    opts?: PubChiveImportSearch.CallOptions
  ): Promise<PubChiveImportSearch.Response> {
    return this._client.call('pub.chive.import.search', params, undefined, opts);
  }
}

export class PubChiveMetricsNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  getMetrics(
    params?: PubChiveMetricsGetMetrics.QueryParams,
    opts?: PubChiveMetricsGetMetrics.CallOptions
  ): Promise<PubChiveMetricsGetMetrics.Response> {
    return this._client.call('pub.chive.metrics.getMetrics', params, undefined, opts).catch((e) => {
      throw PubChiveMetricsGetMetrics.toKnownErr(e);
    });
  }

  getTrending(
    params?: PubChiveMetricsGetTrending.QueryParams,
    opts?: PubChiveMetricsGetTrending.CallOptions
  ): Promise<PubChiveMetricsGetTrending.Response> {
    return this._client.call('pub.chive.metrics.getTrending', params, undefined, opts);
  }

  getViewCount(
    params?: PubChiveMetricsGetViewCount.QueryParams,
    opts?: PubChiveMetricsGetViewCount.CallOptions
  ): Promise<PubChiveMetricsGetViewCount.Response> {
    return this._client
      .call('pub.chive.metrics.getViewCount', params, undefined, opts)
      .catch((e) => {
        throw PubChiveMetricsGetViewCount.toKnownErr(e);
      });
  }

  recordDownload(
    data?: PubChiveMetricsRecordDownload.InputSchema,
    opts?: PubChiveMetricsRecordDownload.CallOptions
  ): Promise<PubChiveMetricsRecordDownload.Response> {
    return this._client
      .call('pub.chive.metrics.recordDownload', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveMetricsRecordDownload.toKnownErr(e);
      });
  }

  recordDwellTime(
    data?: PubChiveMetricsRecordDwellTime.InputSchema,
    opts?: PubChiveMetricsRecordDwellTime.CallOptions
  ): Promise<PubChiveMetricsRecordDwellTime.Response> {
    return this._client
      .call('pub.chive.metrics.recordDwellTime', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveMetricsRecordDwellTime.toKnownErr(e);
      });
  }

  recordSearchClick(
    data?: PubChiveMetricsRecordSearchClick.InputSchema,
    opts?: PubChiveMetricsRecordSearchClick.CallOptions
  ): Promise<PubChiveMetricsRecordSearchClick.Response> {
    return this._client
      .call('pub.chive.metrics.recordSearchClick', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveMetricsRecordSearchClick.toKnownErr(e);
      });
  }

  recordSearchDownload(
    data?: PubChiveMetricsRecordSearchDownload.InputSchema,
    opts?: PubChiveMetricsRecordSearchDownload.CallOptions
  ): Promise<PubChiveMetricsRecordSearchDownload.Response> {
    return this._client
      .call('pub.chive.metrics.recordSearchDownload', opts?.qp, data, opts)
      .catch((e) => {
        throw PubChiveMetricsRecordSearchDownload.toKnownErr(e);
      });
  }

  recordView(
    data?: PubChiveMetricsRecordView.InputSchema,
    opts?: PubChiveMetricsRecordView.CallOptions
  ): Promise<PubChiveMetricsRecordView.Response> {
    return this._client.call('pub.chive.metrics.recordView', opts?.qp, data, opts).catch((e) => {
      throw PubChiveMetricsRecordView.toKnownErr(e);
    });
  }
}

export class PubChiveNotificationNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  listEndorsementsOnMyPapers(
    params?: PubChiveNotificationListEndorsementsOnMyPapers.QueryParams,
    opts?: PubChiveNotificationListEndorsementsOnMyPapers.CallOptions
  ): Promise<PubChiveNotificationListEndorsementsOnMyPapers.Response> {
    return this._client
      .call('pub.chive.notification.listEndorsementsOnMyPapers', params, undefined, opts)
      .catch((e) => {
        throw PubChiveNotificationListEndorsementsOnMyPapers.toKnownErr(e);
      });
  }

  listReviewsOnMyPapers(
    params?: PubChiveNotificationListReviewsOnMyPapers.QueryParams,
    opts?: PubChiveNotificationListReviewsOnMyPapers.CallOptions
  ): Promise<PubChiveNotificationListReviewsOnMyPapers.Response> {
    return this._client
      .call('pub.chive.notification.listReviewsOnMyPapers', params, undefined, opts)
      .catch((e) => {
        throw PubChiveNotificationListReviewsOnMyPapers.toKnownErr(e);
      });
  }
}

export class PubChiveReviewNS {
  _client: XrpcClient;
  comment: PubChiveReviewCommentRecord;
  endorsement: PubChiveReviewEndorsementRecord;
  entityLink: PubChiveReviewEntityLinkRecord;

  constructor(client: XrpcClient) {
    this._client = client;
    this.comment = new PubChiveReviewCommentRecord(client);
    this.endorsement = new PubChiveReviewEndorsementRecord(client);
    this.entityLink = new PubChiveReviewEntityLinkRecord(client);
  }

  getThread(
    params?: PubChiveReviewGetThread.QueryParams,
    opts?: PubChiveReviewGetThread.CallOptions
  ): Promise<PubChiveReviewGetThread.Response> {
    return this._client.call('pub.chive.review.getThread', params, undefined, opts).catch((e) => {
      throw PubChiveReviewGetThread.toKnownErr(e);
    });
  }

  listForAuthor(
    params?: PubChiveReviewListForAuthor.QueryParams,
    opts?: PubChiveReviewListForAuthor.CallOptions
  ): Promise<PubChiveReviewListForAuthor.Response> {
    return this._client.call('pub.chive.review.listForAuthor', params, undefined, opts);
  }

  listForEprint(
    params?: PubChiveReviewListForEprint.QueryParams,
    opts?: PubChiveReviewListForEprint.CallOptions
  ): Promise<PubChiveReviewListForEprint.Response> {
    return this._client.call('pub.chive.review.listForEprint', params, undefined, opts);
  }
}

export class PubChiveReviewCommentRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveReviewComment.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.review.comment',
      ...params,
    });
    return res.data;
  }

  async get(params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>): Promise<{
    uri: string;
    cid: string;
    value: PubChiveReviewComment.Record;
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.review.comment',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveReviewComment.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.review.comment';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveReviewComment.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.review.comment';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.review.comment', ...params },
      { headers }
    );
  }
}

export class PubChiveReviewEndorsementRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveReviewEndorsement.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.review.endorsement',
      ...params,
    });
    return res.data;
  }

  async get(params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>): Promise<{
    uri: string;
    cid: string;
    value: PubChiveReviewEndorsement.Record;
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.review.endorsement',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveReviewEndorsement.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.review.endorsement';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveReviewEndorsement.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.review.endorsement';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.review.endorsement', ...params },
      { headers }
    );
  }
}

export class PubChiveReviewEntityLinkRecord {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  async list(params: OmitKey<ComAtprotoRepoListRecords.QueryParams, 'collection'>): Promise<{
    cursor?: string;
    records: { uri: string; value: PubChiveReviewEntityLink.Record }[];
  }> {
    const res = await this._client.call('com.atproto.repo.listRecords', {
      collection: 'pub.chive.review.entityLink',
      ...params,
    });
    return res.data;
  }

  async get(params: OmitKey<ComAtprotoRepoGetRecord.QueryParams, 'collection'>): Promise<{
    uri: string;
    cid: string;
    value: PubChiveReviewEntityLink.Record;
  }> {
    const res = await this._client.call('com.atproto.repo.getRecord', {
      collection: 'pub.chive.review.entityLink',
      ...params,
    });
    return res.data;
  }

  async create(
    params: OmitKey<ComAtprotoRepoCreateRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveReviewEntityLink.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.review.entityLink';
    const res = await this._client.call(
      'com.atproto.repo.createRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async put(
    params: OmitKey<ComAtprotoRepoPutRecord.InputSchema, 'collection' | 'record'>,
    record: Un$Typed<PubChiveReviewEntityLink.Record>,
    headers?: Record<string, string>
  ): Promise<{ uri: string; cid: string }> {
    const collection = 'pub.chive.review.entityLink';
    const res = await this._client.call(
      'com.atproto.repo.putRecord',
      undefined,
      { collection, ...params, record: { ...record, $type: collection } },
      { encoding: 'application/json', headers }
    );
    return res.data;
  }

  async delete(
    params: OmitKey<ComAtprotoRepoDeleteRecord.InputSchema, 'collection'>,
    headers?: Record<string, string>
  ): Promise<void> {
    await this._client.call(
      'com.atproto.repo.deleteRecord',
      undefined,
      { collection: 'pub.chive.review.entityLink', ...params },
      { headers }
    );
  }
}

export class PubChiveSyncNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  checkStaleness(
    params?: PubChiveSyncCheckStaleness.QueryParams,
    opts?: PubChiveSyncCheckStaleness.CallOptions
  ): Promise<PubChiveSyncCheckStaleness.Response> {
    return this._client
      .call('pub.chive.sync.checkStaleness', params, undefined, opts)
      .catch((e) => {
        throw PubChiveSyncCheckStaleness.toKnownErr(e);
      });
  }

  indexRecord(
    data?: PubChiveSyncIndexRecord.InputSchema,
    opts?: PubChiveSyncIndexRecord.CallOptions
  ): Promise<PubChiveSyncIndexRecord.Response> {
    return this._client.call('pub.chive.sync.indexRecord', opts?.qp, data, opts).catch((e) => {
      throw PubChiveSyncIndexRecord.toKnownErr(e);
    });
  }

  refreshRecord(
    data?: PubChiveSyncRefreshRecord.InputSchema,
    opts?: PubChiveSyncRefreshRecord.CallOptions
  ): Promise<PubChiveSyncRefreshRecord.Response> {
    return this._client.call('pub.chive.sync.refreshRecord', opts?.qp, data, opts).catch((e) => {
      throw PubChiveSyncRefreshRecord.toKnownErr(e);
    });
  }

  registerPDS(
    data?: PubChiveSyncRegisterPDS.InputSchema,
    opts?: PubChiveSyncRegisterPDS.CallOptions
  ): Promise<PubChiveSyncRegisterPDS.Response> {
    return this._client.call('pub.chive.sync.registerPDS', opts?.qp, data, opts).catch((e) => {
      throw PubChiveSyncRegisterPDS.toKnownErr(e);
    });
  }

  verify(
    params?: PubChiveSyncVerify.QueryParams,
    opts?: PubChiveSyncVerify.CallOptions
  ): Promise<PubChiveSyncVerify.Response> {
    return this._client.call('pub.chive.sync.verify', params, undefined, opts).catch((e) => {
      throw PubChiveSyncVerify.toKnownErr(e);
    });
  }
}

export class PubChiveTagNS {
  _client: XrpcClient;

  constructor(client: XrpcClient) {
    this._client = client;
  }

  getDetail(
    params?: PubChiveTagGetDetail.QueryParams,
    opts?: PubChiveTagGetDetail.CallOptions
  ): Promise<PubChiveTagGetDetail.Response> {
    return this._client.call('pub.chive.tag.getDetail', params, undefined, opts).catch((e) => {
      throw PubChiveTagGetDetail.toKnownErr(e);
    });
  }

  getSuggestions(
    params?: PubChiveTagGetSuggestions.QueryParams,
    opts?: PubChiveTagGetSuggestions.CallOptions
  ): Promise<PubChiveTagGetSuggestions.Response> {
    return this._client.call('pub.chive.tag.getSuggestions', params, undefined, opts);
  }

  getTrending(
    params?: PubChiveTagGetTrending.QueryParams,
    opts?: PubChiveTagGetTrending.CallOptions
  ): Promise<PubChiveTagGetTrending.Response> {
    return this._client.call('pub.chive.tag.getTrending', params, undefined, opts);
  }

  listForEprint(
    params?: PubChiveTagListForEprint.QueryParams,
    opts?: PubChiveTagListForEprint.CallOptions
  ): Promise<PubChiveTagListForEprint.Response> {
    return this._client.call('pub.chive.tag.listForEprint', params, undefined, opts);
  }

  search(
    params?: PubChiveTagSearch.QueryParams,
    opts?: PubChiveTagSearch.CallOptions
  ): Promise<PubChiveTagSearch.Response> {
    return this._client.call('pub.chive.tag.search', params, undefined, opts);
  }
}
