/**
 * Governance XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { approveElevation } from './approveElevation.js';
import { getEditorStatus } from './getEditorStatus.js';
import { getPendingCount } from './getPendingCount.js';
import { getProposal } from './getProposal.js';
import { getUserVote } from './getUserVote.js';
import { grantDelegation } from './grantDelegation.js';
import { listDelegations } from './listDelegations.js';
import { listElevationRequests } from './listElevationRequests.js';
import { listProposals } from './listProposals.js';
import { listTrustedEditors } from './listTrustedEditors.js';
import { listVotes } from './listVotes.js';
import { rejectElevation } from './rejectElevation.js';
import { requestElevation } from './requestElevation.js';
import { revokeDelegation } from './revokeDelegation.js';
import { revokeRole } from './revokeRole.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyXRPCMethod = XRPCMethod<any, any, any>;

// Re-export individual methods
export { approveElevation } from './approveElevation.js';
export { getEditorStatus } from './getEditorStatus.js';
export { getPendingCount } from './getPendingCount.js';
export { getProposal } from './getProposal.js';
export { getUserVote } from './getUserVote.js';
export { grantDelegation } from './grantDelegation.js';
export { listDelegations } from './listDelegations.js';
export { listElevationRequests } from './listElevationRequests.js';
export { listProposals } from './listProposals.js';
export { listTrustedEditors } from './listTrustedEditors.js';
export { listVotes } from './listVotes.js';
export { rejectElevation } from './rejectElevation.js';
export { requestElevation } from './requestElevation.js';
export { revokeDelegation } from './revokeDelegation.js';
export { revokeRole } from './revokeRole.js';

// Re-export consensus utilities
export { calculateConsensus } from './consensus.js';

/**
 * All governance XRPC methods keyed by NSID.
 */
export const governanceMethods: Record<string, AnyXRPCMethod> = {
  // Proposal endpoints
  'pub.chive.governance.listProposals': listProposals,
  'pub.chive.governance.getProposal': getProposal,
  'pub.chive.governance.listVotes': listVotes,
  'pub.chive.governance.getUserVote': getUserVote,
  'pub.chive.governance.getPendingCount': getPendingCount,
  // Trusted editor endpoints
  'pub.chive.governance.getEditorStatus': getEditorStatus,
  'pub.chive.governance.listTrustedEditors': listTrustedEditors,
  'pub.chive.governance.requestElevation': requestElevation,
  'pub.chive.governance.grantDelegation': grantDelegation,
  'pub.chive.governance.revokeDelegation': revokeDelegation,
  'pub.chive.governance.revokeRole': revokeRole,
  // Admin endpoints
  'pub.chive.governance.listElevationRequests': listElevationRequests,
  'pub.chive.governance.approveElevation': approveElevation,
  'pub.chive.governance.rejectElevation': rejectElevation,
  'pub.chive.governance.listDelegations': listDelegations,
};
