// @ts-nocheck
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type Auth,
  type Options as XrpcOptions,
  Server as XrpcServer,
  type StreamConfigOrHandler,
  type MethodConfigOrHandler,
  createServer as createXrpcServer,
} from '@atproto/xrpc-server';
import { schemas } from './lexicons.js';
import * as ComAtprotoRepoApplyWrites from './types/com/atproto/repo/applyWrites.js';
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repo/createRecord.js';
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repo/deleteRecord.js';
import * as ComAtprotoRepoDescribeRepo from './types/com/atproto/repo/describeRepo.js';
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repo/getRecord.js';
import * as ComAtprotoRepoImportRepo from './types/com/atproto/repo/importRepo.js';
import * as ComAtprotoRepoListMissingBlobs from './types/com/atproto/repo/listMissingBlobs.js';
import * as ComAtprotoRepoListRecords from './types/com/atproto/repo/listRecords.js';
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repo/putRecord.js';
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
import * as PubChiveEndorsementGetSummary from './types/pub/chive/endorsement/getSummary.js';
import * as PubChiveEndorsementGetUserEndorsement from './types/pub/chive/endorsement/getUserEndorsement.js';
import * as PubChiveEndorsementListForEprint from './types/pub/chive/endorsement/listForEprint.js';
import * as PubChiveEprintGetSubmission from './types/pub/chive/eprint/getSubmission.js';
import * as PubChiveEprintListByAuthor from './types/pub/chive/eprint/listByAuthor.js';
import * as PubChiveEprintSearchSubmissions from './types/pub/chive/eprint/searchSubmissions.js';
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
import * as PubChiveGraphGetCommunities from './types/pub/chive/graph/getCommunities.js';
import * as PubChiveGraphGetEdge from './types/pub/chive/graph/getEdge.js';
import * as PubChiveGraphGetHierarchy from './types/pub/chive/graph/getHierarchy.js';
import * as PubChiveGraphGetNode from './types/pub/chive/graph/getNode.js';
import * as PubChiveGraphGetRelations from './types/pub/chive/graph/getRelations.js';
import * as PubChiveGraphGetSubkinds from './types/pub/chive/graph/getSubkinds.js';
import * as PubChiveGraphListEdges from './types/pub/chive/graph/listEdges.js';
import * as PubChiveGraphListNodes from './types/pub/chive/graph/listNodes.js';
import * as PubChiveGraphSearchNodes from './types/pub/chive/graph/searchNodes.js';
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

export function createServer(options?: XrpcOptions): Server {
  return new Server(options);
}

export class Server {
  xrpc: XrpcServer;
  com: ComNS;
  pub: PubNS;

  constructor(options?: XrpcOptions) {
    this.xrpc = createXrpcServer(schemas, options);
    this.com = new ComNS(this);
    this.pub = new PubNS(this);
  }
}

export class ComNS {
  _server: Server;
  atproto: ComAtprotoNS;

  constructor(server: Server) {
    this._server = server;
    this.atproto = new ComAtprotoNS(server);
  }
}

export class ComAtprotoNS {
  _server: Server;
  repo: ComAtprotoRepoNS;

  constructor(server: Server) {
    this._server = server;
    this.repo = new ComAtprotoRepoNS(server);
  }
}

export class ComAtprotoRepoNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  applyWrites<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoApplyWrites.QueryParams,
      ComAtprotoRepoApplyWrites.HandlerInput,
      ComAtprotoRepoApplyWrites.HandlerOutput
    >
  ) {
    const nsid = 'com.atproto.repo.applyWrites'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  createRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoCreateRecord.QueryParams,
      ComAtprotoRepoCreateRecord.HandlerInput,
      ComAtprotoRepoCreateRecord.HandlerOutput
    >
  ) {
    const nsid = 'com.atproto.repo.createRecord'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  deleteRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoDeleteRecord.QueryParams,
      ComAtprotoRepoDeleteRecord.HandlerInput,
      ComAtprotoRepoDeleteRecord.HandlerOutput
    >
  ) {
    const nsid = 'com.atproto.repo.deleteRecord'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  describeRepo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoDescribeRepo.QueryParams,
      ComAtprotoRepoDescribeRepo.HandlerInput,
      ComAtprotoRepoDescribeRepo.HandlerOutput
    >
  ) {
    const nsid = 'com.atproto.repo.describeRepo'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoGetRecord.QueryParams,
      ComAtprotoRepoGetRecord.HandlerInput,
      ComAtprotoRepoGetRecord.HandlerOutput
    >
  ) {
    const nsid = 'com.atproto.repo.getRecord'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  importRepo<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoImportRepo.QueryParams,
      ComAtprotoRepoImportRepo.HandlerInput,
      ComAtprotoRepoImportRepo.HandlerOutput
    >
  ) {
    const nsid = 'com.atproto.repo.importRepo'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listMissingBlobs<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoListMissingBlobs.QueryParams,
      ComAtprotoRepoListMissingBlobs.HandlerInput,
      ComAtprotoRepoListMissingBlobs.HandlerOutput
    >
  ) {
    const nsid = 'com.atproto.repo.listMissingBlobs'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listRecords<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoListRecords.QueryParams,
      ComAtprotoRepoListRecords.HandlerInput,
      ComAtprotoRepoListRecords.HandlerOutput
    >
  ) {
    const nsid = 'com.atproto.repo.listRecords'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  putRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoPutRecord.QueryParams,
      ComAtprotoRepoPutRecord.HandlerInput,
      ComAtprotoRepoPutRecord.HandlerOutput
    >
  ) {
    const nsid = 'com.atproto.repo.putRecord'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  uploadBlob<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      ComAtprotoRepoUploadBlob.QueryParams,
      ComAtprotoRepoUploadBlob.HandlerInput,
      ComAtprotoRepoUploadBlob.HandlerOutput
    >
  ) {
    const nsid = 'com.atproto.repo.uploadBlob'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubNS {
  _server: Server;
  chive: PubChiveNS;

  constructor(server: Server) {
    this._server = server;
    this.chive = new PubChiveNS(server);
  }
}

export class PubChiveNS {
  _server: Server;
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

  constructor(server: Server) {
    this._server = server;
    this.activity = new PubChiveActivityNS(server);
    this.actor = new PubChiveActorNS(server);
    this.alpha = new PubChiveAlphaNS(server);
    this.author = new PubChiveAuthorNS(server);
    this.backlink = new PubChiveBacklinkNS(server);
    this.claiming = new PubChiveClaimingNS(server);
    this.discovery = new PubChiveDiscoveryNS(server);
    this.endorsement = new PubChiveEndorsementNS(server);
    this.eprint = new PubChiveEprintNS(server);
    this.governance = new PubChiveGovernanceNS(server);
    this.graph = new PubChiveGraphNS(server);
    this.import = new PubChiveImportNS(server);
    this.metrics = new PubChiveMetricsNS(server);
    this.notification = new PubChiveNotificationNS(server);
    this.review = new PubChiveReviewNS(server);
    this.sync = new PubChiveSyncNS(server);
    this.tag = new PubChiveTagNS(server);
  }
}

export class PubChiveActivityNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  getCorrelationMetrics<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveActivityGetCorrelationMetrics.QueryParams,
      PubChiveActivityGetCorrelationMetrics.HandlerInput,
      PubChiveActivityGetCorrelationMetrics.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.activity.getCorrelationMetrics'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getFeed<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveActivityGetFeed.QueryParams,
      PubChiveActivityGetFeed.HandlerInput,
      PubChiveActivityGetFeed.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.activity.getFeed'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  log<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveActivityLog.QueryParams,
      PubChiveActivityLog.HandlerInput,
      PubChiveActivityLog.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.activity.log'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  markFailed<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveActivityMarkFailed.QueryParams,
      PubChiveActivityMarkFailed.HandlerInput,
      PubChiveActivityMarkFailed.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.activity.markFailed'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveActorNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  autocompleteAffiliation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveActorAutocompleteAffiliation.QueryParams,
      PubChiveActorAutocompleteAffiliation.HandlerInput,
      PubChiveActorAutocompleteAffiliation.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.actor.autocompleteAffiliation'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  autocompleteKeyword<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveActorAutocompleteKeyword.QueryParams,
      PubChiveActorAutocompleteKeyword.HandlerInput,
      PubChiveActorAutocompleteKeyword.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.actor.autocompleteKeyword'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  autocompleteOpenReview<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveActorAutocompleteOpenReview.QueryParams,
      PubChiveActorAutocompleteOpenReview.HandlerInput,
      PubChiveActorAutocompleteOpenReview.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.actor.autocompleteOpenReview'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  autocompleteOrcid<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveActorAutocompleteOrcid.QueryParams,
      PubChiveActorAutocompleteOrcid.HandlerInput,
      PubChiveActorAutocompleteOrcid.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.actor.autocompleteOrcid'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  discoverAuthorIds<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveActorDiscoverAuthorIds.QueryParams,
      PubChiveActorDiscoverAuthorIds.HandlerInput,
      PubChiveActorDiscoverAuthorIds.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.actor.discoverAuthorIds'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getDiscoverySettings<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveActorGetDiscoverySettings.QueryParams,
      PubChiveActorGetDiscoverySettings.HandlerInput,
      PubChiveActorGetDiscoverySettings.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.actor.getDiscoverySettings'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getMyProfile<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveActorGetMyProfile.QueryParams,
      PubChiveActorGetMyProfile.HandlerInput,
      PubChiveActorGetMyProfile.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.actor.getMyProfile'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveAlphaNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  apply<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveAlphaApply.QueryParams,
      PubChiveAlphaApply.HandlerInput,
      PubChiveAlphaApply.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.alpha.apply'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  checkStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveAlphaCheckStatus.QueryParams,
      PubChiveAlphaCheckStatus.HandlerInput,
      PubChiveAlphaCheckStatus.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.alpha.checkStatus'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveAuthorNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  getProfile<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveAuthorGetProfile.QueryParams,
      PubChiveAuthorGetProfile.HandlerInput,
      PubChiveAuthorGetProfile.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.author.getProfile'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  searchAuthors<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveAuthorSearchAuthors.QueryParams,
      PubChiveAuthorSearchAuthors.HandlerInput,
      PubChiveAuthorSearchAuthors.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.author.searchAuthors'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveBacklinkNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  create<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveBacklinkCreate.QueryParams,
      PubChiveBacklinkCreate.HandlerInput,
      PubChiveBacklinkCreate.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.backlink.create'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  delete<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveBacklinkDelete.QueryParams,
      PubChiveBacklinkDelete.HandlerInput,
      PubChiveBacklinkDelete.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.backlink.delete'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getCounts<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveBacklinkGetCounts.QueryParams,
      PubChiveBacklinkGetCounts.HandlerInput,
      PubChiveBacklinkGetCounts.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.backlink.getCounts'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  list<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveBacklinkList.QueryParams,
      PubChiveBacklinkList.HandlerInput,
      PubChiveBacklinkList.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.backlink.list'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveClaimingNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  approveClaim<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingApproveClaim.QueryParams,
      PubChiveClaimingApproveClaim.HandlerInput,
      PubChiveClaimingApproveClaim.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.approveClaim'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  approveCoauthor<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingApproveCoauthor.QueryParams,
      PubChiveClaimingApproveCoauthor.HandlerInput,
      PubChiveClaimingApproveCoauthor.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.approveCoauthor'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  autocomplete<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingAutocomplete.QueryParams,
      PubChiveClaimingAutocomplete.HandlerInput,
      PubChiveClaimingAutocomplete.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.autocomplete'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  completeClaim<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingCompleteClaim.QueryParams,
      PubChiveClaimingCompleteClaim.HandlerInput,
      PubChiveClaimingCompleteClaim.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.completeClaim'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  fetchExternalPdf<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingFetchExternalPdf.QueryParams,
      PubChiveClaimingFetchExternalPdf.HandlerInput,
      PubChiveClaimingFetchExternalPdf.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.fetchExternalPdf'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  findClaimable<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingFindClaimable.QueryParams,
      PubChiveClaimingFindClaimable.HandlerInput,
      PubChiveClaimingFindClaimable.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.findClaimable'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getClaim<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingGetClaim.QueryParams,
      PubChiveClaimingGetClaim.HandlerInput,
      PubChiveClaimingGetClaim.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.getClaim'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getCoauthorRequests<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingGetCoauthorRequests.QueryParams,
      PubChiveClaimingGetCoauthorRequests.HandlerInput,
      PubChiveClaimingGetCoauthorRequests.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.getCoauthorRequests'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getMyCoauthorRequests<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingGetMyCoauthorRequests.QueryParams,
      PubChiveClaimingGetMyCoauthorRequests.HandlerInput,
      PubChiveClaimingGetMyCoauthorRequests.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.getMyCoauthorRequests'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getPendingClaims<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingGetPendingClaims.QueryParams,
      PubChiveClaimingGetPendingClaims.HandlerInput,
      PubChiveClaimingGetPendingClaims.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.getPendingClaims'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getSubmissionData<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingGetSubmissionData.QueryParams,
      PubChiveClaimingGetSubmissionData.HandlerInput,
      PubChiveClaimingGetSubmissionData.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.getSubmissionData'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getSuggestions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingGetSuggestions.QueryParams,
      PubChiveClaimingGetSuggestions.HandlerInput,
      PubChiveClaimingGetSuggestions.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.getSuggestions'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getUserClaims<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingGetUserClaims.QueryParams,
      PubChiveClaimingGetUserClaims.HandlerInput,
      PubChiveClaimingGetUserClaims.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.getUserClaims'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  rejectClaim<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingRejectClaim.QueryParams,
      PubChiveClaimingRejectClaim.HandlerInput,
      PubChiveClaimingRejectClaim.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.rejectClaim'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  rejectCoauthor<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingRejectCoauthor.QueryParams,
      PubChiveClaimingRejectCoauthor.HandlerInput,
      PubChiveClaimingRejectCoauthor.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.rejectCoauthor'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  requestCoauthorship<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingRequestCoauthorship.QueryParams,
      PubChiveClaimingRequestCoauthorship.HandlerInput,
      PubChiveClaimingRequestCoauthorship.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.requestCoauthorship'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  searchEprints<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingSearchEprints.QueryParams,
      PubChiveClaimingSearchEprints.HandlerInput,
      PubChiveClaimingSearchEprints.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.searchEprints'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  startClaim<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingStartClaim.QueryParams,
      PubChiveClaimingStartClaim.HandlerInput,
      PubChiveClaimingStartClaim.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.startClaim'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  startClaimFromExternal<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveClaimingStartClaimFromExternal.QueryParams,
      PubChiveClaimingStartClaimFromExternal.HandlerInput,
      PubChiveClaimingStartClaimFromExternal.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.claiming.startClaimFromExternal'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveDiscoveryNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  getCitations<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveDiscoveryGetCitations.QueryParams,
      PubChiveDiscoveryGetCitations.HandlerInput,
      PubChiveDiscoveryGetCitations.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.discovery.getCitations'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getEnrichment<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveDiscoveryGetEnrichment.QueryParams,
      PubChiveDiscoveryGetEnrichment.HandlerInput,
      PubChiveDiscoveryGetEnrichment.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.discovery.getEnrichment'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getForYou<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveDiscoveryGetForYou.QueryParams,
      PubChiveDiscoveryGetForYou.HandlerInput,
      PubChiveDiscoveryGetForYou.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.discovery.getForYou'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getRecommendations<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveDiscoveryGetRecommendations.QueryParams,
      PubChiveDiscoveryGetRecommendations.HandlerInput,
      PubChiveDiscoveryGetRecommendations.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.discovery.getRecommendations'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getSimilar<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveDiscoveryGetSimilar.QueryParams,
      PubChiveDiscoveryGetSimilar.HandlerInput,
      PubChiveDiscoveryGetSimilar.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.discovery.getSimilar'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  recordInteraction<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveDiscoveryRecordInteraction.QueryParams,
      PubChiveDiscoveryRecordInteraction.HandlerInput,
      PubChiveDiscoveryRecordInteraction.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.discovery.recordInteraction'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveEndorsementNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  getSummary<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveEndorsementGetSummary.QueryParams,
      PubChiveEndorsementGetSummary.HandlerInput,
      PubChiveEndorsementGetSummary.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.endorsement.getSummary'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getUserEndorsement<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveEndorsementGetUserEndorsement.QueryParams,
      PubChiveEndorsementGetUserEndorsement.HandlerInput,
      PubChiveEndorsementGetUserEndorsement.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.endorsement.getUserEndorsement'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listForEprint<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveEndorsementListForEprint.QueryParams,
      PubChiveEndorsementListForEprint.HandlerInput,
      PubChiveEndorsementListForEprint.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.endorsement.listForEprint'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveEprintNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  getSubmission<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveEprintGetSubmission.QueryParams,
      PubChiveEprintGetSubmission.HandlerInput,
      PubChiveEprintGetSubmission.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.eprint.getSubmission'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listByAuthor<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveEprintListByAuthor.QueryParams,
      PubChiveEprintListByAuthor.HandlerInput,
      PubChiveEprintListByAuthor.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.eprint.listByAuthor'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  searchSubmissions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveEprintSearchSubmissions.QueryParams,
      PubChiveEprintSearchSubmissions.HandlerInput,
      PubChiveEprintSearchSubmissions.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.eprint.searchSubmissions'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveGovernanceNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  approveElevation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceApproveElevation.QueryParams,
      PubChiveGovernanceApproveElevation.HandlerInput,
      PubChiveGovernanceApproveElevation.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.approveElevation'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getEditorStatus<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceGetEditorStatus.QueryParams,
      PubChiveGovernanceGetEditorStatus.HandlerInput,
      PubChiveGovernanceGetEditorStatus.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.getEditorStatus'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getPendingCount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceGetPendingCount.QueryParams,
      PubChiveGovernanceGetPendingCount.HandlerInput,
      PubChiveGovernanceGetPendingCount.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.getPendingCount'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getProposal<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceGetProposal.QueryParams,
      PubChiveGovernanceGetProposal.HandlerInput,
      PubChiveGovernanceGetProposal.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.getProposal'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getUserVote<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceGetUserVote.QueryParams,
      PubChiveGovernanceGetUserVote.HandlerInput,
      PubChiveGovernanceGetUserVote.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.getUserVote'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  grantDelegation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceGrantDelegation.QueryParams,
      PubChiveGovernanceGrantDelegation.HandlerInput,
      PubChiveGovernanceGrantDelegation.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.grantDelegation'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listDelegations<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceListDelegations.QueryParams,
      PubChiveGovernanceListDelegations.HandlerInput,
      PubChiveGovernanceListDelegations.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.listDelegations'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listElevationRequests<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceListElevationRequests.QueryParams,
      PubChiveGovernanceListElevationRequests.HandlerInput,
      PubChiveGovernanceListElevationRequests.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.listElevationRequests'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listProposals<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceListProposals.QueryParams,
      PubChiveGovernanceListProposals.HandlerInput,
      PubChiveGovernanceListProposals.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.listProposals'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listTrustedEditors<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceListTrustedEditors.QueryParams,
      PubChiveGovernanceListTrustedEditors.HandlerInput,
      PubChiveGovernanceListTrustedEditors.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.listTrustedEditors'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listVotes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceListVotes.QueryParams,
      PubChiveGovernanceListVotes.HandlerInput,
      PubChiveGovernanceListVotes.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.listVotes'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  rejectElevation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceRejectElevation.QueryParams,
      PubChiveGovernanceRejectElevation.HandlerInput,
      PubChiveGovernanceRejectElevation.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.rejectElevation'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  requestElevation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceRequestElevation.QueryParams,
      PubChiveGovernanceRequestElevation.HandlerInput,
      PubChiveGovernanceRequestElevation.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.requestElevation'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  revokeDelegation<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceRevokeDelegation.QueryParams,
      PubChiveGovernanceRevokeDelegation.HandlerInput,
      PubChiveGovernanceRevokeDelegation.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.revokeDelegation'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  revokeRole<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGovernanceRevokeRole.QueryParams,
      PubChiveGovernanceRevokeRole.HandlerInput,
      PubChiveGovernanceRevokeRole.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.governance.revokeRole'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveGraphNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  browseFaceted<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGraphBrowseFaceted.QueryParams,
      PubChiveGraphBrowseFaceted.HandlerInput,
      PubChiveGraphBrowseFaceted.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.graph.browseFaceted'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getCommunities<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGraphGetCommunities.QueryParams,
      PubChiveGraphGetCommunities.HandlerInput,
      PubChiveGraphGetCommunities.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.graph.getCommunities'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getEdge<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGraphGetEdge.QueryParams,
      PubChiveGraphGetEdge.HandlerInput,
      PubChiveGraphGetEdge.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.graph.getEdge'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getHierarchy<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGraphGetHierarchy.QueryParams,
      PubChiveGraphGetHierarchy.HandlerInput,
      PubChiveGraphGetHierarchy.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.graph.getHierarchy'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getNode<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGraphGetNode.QueryParams,
      PubChiveGraphGetNode.HandlerInput,
      PubChiveGraphGetNode.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.graph.getNode'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getRelations<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGraphGetRelations.QueryParams,
      PubChiveGraphGetRelations.HandlerInput,
      PubChiveGraphGetRelations.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.graph.getRelations'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getSubkinds<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGraphGetSubkinds.QueryParams,
      PubChiveGraphGetSubkinds.HandlerInput,
      PubChiveGraphGetSubkinds.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.graph.getSubkinds'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listEdges<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGraphListEdges.QueryParams,
      PubChiveGraphListEdges.HandlerInput,
      PubChiveGraphListEdges.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.graph.listEdges'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listNodes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGraphListNodes.QueryParams,
      PubChiveGraphListNodes.HandlerInput,
      PubChiveGraphListNodes.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.graph.listNodes'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  searchNodes<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveGraphSearchNodes.QueryParams,
      PubChiveGraphSearchNodes.HandlerInput,
      PubChiveGraphSearchNodes.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.graph.searchNodes'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveImportNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  exists<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveImportExists.QueryParams,
      PubChiveImportExists.HandlerInput,
      PubChiveImportExists.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.import.exists'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  get<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveImportGet.QueryParams,
      PubChiveImportGet.HandlerInput,
      PubChiveImportGet.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.import.get'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  search<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveImportSearch.QueryParams,
      PubChiveImportSearch.HandlerInput,
      PubChiveImportSearch.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.import.search'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveMetricsNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  getMetrics<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveMetricsGetMetrics.QueryParams,
      PubChiveMetricsGetMetrics.HandlerInput,
      PubChiveMetricsGetMetrics.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.metrics.getMetrics'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getTrending<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveMetricsGetTrending.QueryParams,
      PubChiveMetricsGetTrending.HandlerInput,
      PubChiveMetricsGetTrending.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.metrics.getTrending'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getViewCount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveMetricsGetViewCount.QueryParams,
      PubChiveMetricsGetViewCount.HandlerInput,
      PubChiveMetricsGetViewCount.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.metrics.getViewCount'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  recordDownload<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveMetricsRecordDownload.QueryParams,
      PubChiveMetricsRecordDownload.HandlerInput,
      PubChiveMetricsRecordDownload.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.metrics.recordDownload'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  recordDwellTime<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveMetricsRecordDwellTime.QueryParams,
      PubChiveMetricsRecordDwellTime.HandlerInput,
      PubChiveMetricsRecordDwellTime.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.metrics.recordDwellTime'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  recordSearchClick<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveMetricsRecordSearchClick.QueryParams,
      PubChiveMetricsRecordSearchClick.HandlerInput,
      PubChiveMetricsRecordSearchClick.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.metrics.recordSearchClick'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  recordSearchDownload<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveMetricsRecordSearchDownload.QueryParams,
      PubChiveMetricsRecordSearchDownload.HandlerInput,
      PubChiveMetricsRecordSearchDownload.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.metrics.recordSearchDownload'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  recordView<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveMetricsRecordView.QueryParams,
      PubChiveMetricsRecordView.HandlerInput,
      PubChiveMetricsRecordView.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.metrics.recordView'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveNotificationNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  listEndorsementsOnMyPapers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveNotificationListEndorsementsOnMyPapers.QueryParams,
      PubChiveNotificationListEndorsementsOnMyPapers.HandlerInput,
      PubChiveNotificationListEndorsementsOnMyPapers.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.notification.listEndorsementsOnMyPapers'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listReviewsOnMyPapers<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveNotificationListReviewsOnMyPapers.QueryParams,
      PubChiveNotificationListReviewsOnMyPapers.HandlerInput,
      PubChiveNotificationListReviewsOnMyPapers.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.notification.listReviewsOnMyPapers'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveReviewNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  getThread<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveReviewGetThread.QueryParams,
      PubChiveReviewGetThread.HandlerInput,
      PubChiveReviewGetThread.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.review.getThread'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listForAuthor<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveReviewListForAuthor.QueryParams,
      PubChiveReviewListForAuthor.HandlerInput,
      PubChiveReviewListForAuthor.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.review.listForAuthor'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listForEprint<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveReviewListForEprint.QueryParams,
      PubChiveReviewListForEprint.HandlerInput,
      PubChiveReviewListForEprint.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.review.listForEprint'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveSyncNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  checkStaleness<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveSyncCheckStaleness.QueryParams,
      PubChiveSyncCheckStaleness.HandlerInput,
      PubChiveSyncCheckStaleness.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.sync.checkStaleness'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  indexRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveSyncIndexRecord.QueryParams,
      PubChiveSyncIndexRecord.HandlerInput,
      PubChiveSyncIndexRecord.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.sync.indexRecord'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  refreshRecord<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveSyncRefreshRecord.QueryParams,
      PubChiveSyncRefreshRecord.HandlerInput,
      PubChiveSyncRefreshRecord.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.sync.refreshRecord'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  registerPDS<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveSyncRegisterPDS.QueryParams,
      PubChiveSyncRegisterPDS.HandlerInput,
      PubChiveSyncRegisterPDS.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.sync.registerPDS'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  verify<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveSyncVerify.QueryParams,
      PubChiveSyncVerify.HandlerInput,
      PubChiveSyncVerify.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.sync.verify'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}

export class PubChiveTagNS {
  _server: Server;

  constructor(server: Server) {
    this._server = server;
  }

  getDetail<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveTagGetDetail.QueryParams,
      PubChiveTagGetDetail.HandlerInput,
      PubChiveTagGetDetail.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.tag.getDetail'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getSuggestions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveTagGetSuggestions.QueryParams,
      PubChiveTagGetSuggestions.HandlerInput,
      PubChiveTagGetSuggestions.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.tag.getSuggestions'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  getTrending<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveTagGetTrending.QueryParams,
      PubChiveTagGetTrending.HandlerInput,
      PubChiveTagGetTrending.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.tag.getTrending'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  listForEprint<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveTagListForEprint.QueryParams,
      PubChiveTagListForEprint.HandlerInput,
      PubChiveTagListForEprint.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.tag.listForEprint'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }

  search<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      PubChiveTagSearch.QueryParams,
      PubChiveTagSearch.HandlerInput,
      PubChiveTagSearch.HandlerOutput
    >
  ) {
    const nsid = 'pub.chive.tag.search'; // @ts-ignore
    return this._server.xrpc.method(nsid, cfg);
  }
}
