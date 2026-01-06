/**
 * Handler for pub.chive.governance.getUserVote.
 *
 * @remarks
 * Gets a user's vote on a specific proposal, if they have voted.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import { NotFoundError } from '../../../../types/errors.js';
import {
  getUserVoteParamsSchema,
  voteSchema,
  type GetUserVoteParams,
  type Vote,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Response schema for getUserVote (nullable vote).
 */
const getUserVoteResponseSchema = z.object({
  vote: voteSchema.nullable(),
});

type GetUserVoteResponse = z.infer<typeof getUserVoteResponseSchema>;

/**
 * Handler for pub.chive.governance.getUserVote.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns User's vote or null if not voted
 *
 * @throws {NotFoundError} When proposal is not found
 */
export async function getUserVoteHandler(
  c: Context<ChiveEnv>,
  params: GetUserVoteParams
): Promise<GetUserVoteResponse> {
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
    return { vote: null };
  }

  // Convert to API format
  const vote: Vote = {
    id: userVote.id ?? userVote.uri.split('/').pop() ?? '',
    uri: userVote.uri,
    proposalUri: proposal.uri,
    voterDid: userVote.voterDid,
    voterRole: userVote.voterRole as Vote['voterRole'],
    vote: userVote.vote as Vote['vote'],
    weight: userVote.weight,
    rationale: userVote.rationale,
    createdAt:
      userVote.createdAt instanceof Date ? userVote.createdAt.toISOString() : userVote.createdAt,
  };

  return { vote };
}

/**
 * Endpoint definition for pub.chive.governance.getUserVote.
 *
 * @public
 */
export const getUserVoteEndpoint: XRPCEndpoint<GetUserVoteParams, GetUserVoteResponse> = {
  method: 'pub.chive.governance.getUserVote' as never,
  type: 'query',
  description: "Get a user's vote on a proposal",
  inputSchema: getUserVoteParamsSchema,
  outputSchema: getUserVoteResponseSchema,
  handler: getUserVoteHandler,
  auth: 'optional',
  rateLimit: 'authenticated',
};
