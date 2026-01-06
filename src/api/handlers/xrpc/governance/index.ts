/**
 * Governance XRPC endpoint exports.
 *
 * @packageDocumentation
 * @public
 */

export { listProposalsEndpoint, listProposalsHandler } from './listProposals.js';
export { getProposalEndpoint, getProposalHandler } from './getProposal.js';
export { listVotesEndpoint, listVotesHandler } from './listVotes.js';
export { getUserVoteEndpoint, getUserVoteHandler } from './getUserVote.js';
export { getPendingCountEndpoint, getPendingCountHandler } from './getPendingCount.js';

import { getPendingCountEndpoint } from './getPendingCount.js';
import { getProposalEndpoint } from './getProposal.js';
import { getUserVoteEndpoint } from './getUserVote.js';
import { listProposalsEndpoint } from './listProposals.js';
import { listVotesEndpoint } from './listVotes.js';

/**
 * All governance XRPC endpoints.
 */
export const governanceEndpoints = [
  listProposalsEndpoint,
  getProposalEndpoint,
  listVotesEndpoint,
  getUserVoteEndpoint,
  getPendingCountEndpoint,
] as const;
