/**
 * Handler for pub.chive.governance.getUserVote.
 *
 * @remarks
 * Gets a user's vote on a specific proposal, if they have voted.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  VoteView,
} from '../../../../lexicons/generated/types/pub/chive/governance/getUserVote.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.getUserVote.
 *
 * @public
 */
export const getUserVote: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { graph } = c.get('services');

    logger.debug('Getting user vote', { proposalId: params.proposalId, userDid: params.userDid });

    // Verify proposal exists
    const proposal = await graph.getProposalById(params.proposalId);
    if (!proposal) {
      throw new NotFoundError('Proposal', params.proposalId);
    }

    // Get all votes for the proposal
    const votes = await graph.getVotesForProposal(proposal.uri);

    // Find the user's vote
    const userVote = votes.find((v) => v.voterDid === params.userDid);

    if (!userVote) {
      // Return an empty vote object when no vote exists
      // The lexicon type requires either a VoteView or an object with $type
      return {
        encoding: 'application/json',
        body: { vote: { $type: 'pub.chive.governance.getUserVote#noVote' } },
      };
    }

    // Convert to API format
    const vote: OutputSchema['vote'] = {
      $type: 'pub.chive.governance.getUserVote#voteView',
      id: userVote.id ?? userVote.uri.split('/').pop() ?? '',
      uri: userVote.uri,
      proposalUri: proposal.uri,
      voterDid: userVote.voterDid,
      voterRole: userVote.voterRole as VoteView['voterRole'],
      vote: userVote.vote as VoteView['vote'],
      weight: userVote.weight,
      rationale: userVote.rationale,
      createdAt:
        userVote.createdAt instanceof Date ? userVote.createdAt.toISOString() : userVote.createdAt,
    };

    return { encoding: 'application/json', body: { vote } };
  },
};
