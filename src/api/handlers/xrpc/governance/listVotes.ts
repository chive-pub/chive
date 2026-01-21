/**
 * XRPC handler for pub.chive.governance.listVotes.
 *
 * @remarks
 * Lists votes for a specific governance proposal.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  VoteView,
} from '../../../../lexicons/generated/types/pub/chive/governance/listVotes.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.listVotes.
 *
 * @public
 */
export const listVotes: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
    const votes: VoteView[] = paginatedVotes.map((v) => ({
      id: v.id,
      uri: v.uri,
      cid: (v as { cid?: string }).cid ?? 'placeholder', // CID from vote record
      proposalUri: v.proposalUri,
      voterDid: v.voterDid,
      voterName: undefined, // Would need DID resolution
      voterRole: v.voterRole as VoteView['voterRole'],
      vote: v.vote as VoteView['vote'],
      weight: v.weight,
      rationale: v.rationale,
      createdAt: v.createdAt.toISOString(),
    }));

    const body: OutputSchema = {
      votes,
      cursor: hasMore ? String(offset + limit) : undefined,
      total: allVotes.length,
    };

    logger.info('Votes listed for proposal', {
      proposalId: params.proposalId,
      count: body.votes.length,
    });

    return { encoding: 'application/json', body };
  },
};
