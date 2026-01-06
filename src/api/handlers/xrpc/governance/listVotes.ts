/**
 * XRPC handler for pub.chive.governance.listVotes.
 *
 * @remarks
 * Lists votes for a specific governance proposal.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  listVotesParamsSchema,
  votesResponseSchema,
  type ListVotesParams,
  type VotesResponse,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.listVotes query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns List of votes for the proposal
 *
 * @public
 */
export async function listVotesHandler(
  c: Context<ChiveEnv>,
  params: ListVotesParams
): Promise<VotesResponse> {
  const logger = c.get('logger');
  const graphService = c.get('services').graph;

  logger.debug('Listing votes for proposal', {
    proposalId: params.proposalId,
    limit: params.limit,
  });

  // Construct proposal URI from ID
  const proposalUri = `at://chive.governance/pub.chive.graph.fieldProposal/${params.proposalId}`;

  // Get votes from the knowledge graph service
  const allVotes = await graphService.getVotesForProposal(proposalUri);

  // Apply pagination
  const limit = params.limit ?? 100;
  const offset = params.cursor ? parseInt(params.cursor, 10) : 0;
  const paginatedVotes = allVotes.slice(offset, offset + limit);
  const hasMore = offset + limit < allVotes.length;

  // Map to API response format
  const votes = paginatedVotes.map((v) => ({
    id: v.id,
    uri: v.uri,
    proposalUri: v.proposalUri,
    voterDid: v.voterDid,
    voterName: undefined, // Would need DID resolution
    voterRole: v.voterRole as 'community-member' | 'reviewer' | 'domain-expert' | 'administrator',
    vote: v.vote as 'approve' | 'reject' | 'abstain' | 'request-changes',
    weight: v.weight,
    rationale: v.rationale,
    createdAt: v.createdAt.toISOString(),
  }));

  const response: VotesResponse = {
    votes,
    cursor: hasMore ? String(offset + limit) : undefined,
    total: allVotes.length,
  };

  logger.info('Votes listed for proposal', {
    proposalId: params.proposalId,
    count: response.votes.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.governance.listVotes.
 *
 * @public
 */
export const listVotesEndpoint: XRPCEndpoint<ListVotesParams, VotesResponse> = {
  method: 'pub.chive.governance.listVotes' as never,
  type: 'query',
  description: 'List votes for a governance proposal',
  inputSchema: listVotesParamsSchema,
  outputSchema: votesResponseSchema,
  handler: listVotesHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
