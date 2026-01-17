/**
 * Governance XRPC endpoint exports.
 *
 * @packageDocumentation
 * @public
 */

// Proposal endpoints
export { listProposalsEndpoint, listProposalsHandler } from './listProposals.js';
export { getProposalEndpoint, getProposalHandler } from './getProposal.js';
export { listVotesEndpoint, listVotesHandler } from './listVotes.js';
export { getUserVoteEndpoint, getUserVoteHandler } from './getUserVote.js';
export { getPendingCountEndpoint, getPendingCountHandler } from './getPendingCount.js';

// Trusted editor endpoints
export { getEditorStatusEndpoint, getEditorStatusHandler } from './getEditorStatus.js';
export { listTrustedEditorsEndpoint, listTrustedEditorsHandler } from './listTrustedEditors.js';
export { requestElevationEndpoint, requestElevationHandler } from './requestElevation.js';
export { grantDelegationEndpoint, grantDelegationHandler } from './grantDelegation.js';
export { revokeDelegationEndpoint, revokeDelegationHandler } from './revokeDelegation.js';
export { revokeRoleEndpoint, revokeRoleHandler } from './revokeRole.js';

// Admin endpoints
export {
  listElevationRequestsEndpoint,
  listElevationRequestsHandler,
} from './listElevationRequests.js';
export { approveElevationEndpoint, approveElevationHandler } from './approveElevation.js';
export { rejectElevationEndpoint, rejectElevationHandler } from './rejectElevation.js';
export { listDelegationsEndpoint, listDelegationsHandler } from './listDelegations.js';

import { approveElevationEndpoint } from './approveElevation.js';
import { getEditorStatusEndpoint } from './getEditorStatus.js';
import { getPendingCountEndpoint } from './getPendingCount.js';
import { getProposalEndpoint } from './getProposal.js';
import { getUserVoteEndpoint } from './getUserVote.js';
import { grantDelegationEndpoint } from './grantDelegation.js';
import { listDelegationsEndpoint } from './listDelegations.js';
import { listElevationRequestsEndpoint } from './listElevationRequests.js';
import { listProposalsEndpoint } from './listProposals.js';
import { listTrustedEditorsEndpoint } from './listTrustedEditors.js';
import { listVotesEndpoint } from './listVotes.js';
import { rejectElevationEndpoint } from './rejectElevation.js';
import { requestElevationEndpoint } from './requestElevation.js';
import { revokeDelegationEndpoint } from './revokeDelegation.js';
import { revokeRoleEndpoint } from './revokeRole.js';

/**
 * All governance XRPC endpoints.
 */
export const governanceEndpoints = [
  // Proposal endpoints
  listProposalsEndpoint,
  getProposalEndpoint,
  listVotesEndpoint,
  getUserVoteEndpoint,
  getPendingCountEndpoint,
  // Trusted editor endpoints
  getEditorStatusEndpoint,
  listTrustedEditorsEndpoint,
  requestElevationEndpoint,
  grantDelegationEndpoint,
  revokeDelegationEndpoint,
  revokeRoleEndpoint,
  // Admin endpoints
  listElevationRequestsEndpoint,
  approveElevationEndpoint,
  rejectElevationEndpoint,
  listDelegationsEndpoint,
] as const;
