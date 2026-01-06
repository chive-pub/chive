/**
 * XRPC handler for pub.chive.governance.getProposal.
 *
 * @remarks
 * Gets a single governance proposal by ID.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { NotFoundError } from '../../../../types/errors.js';
import {
  getProposalParamsSchema,
  proposalSchema,
  type GetProposalParams,
  type Proposal,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.getProposal query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns The requested proposal
 *
 * @public
 */
export async function getProposalHandler(
  c: Context<ChiveEnv>,
  params: GetProposalParams
): Promise<Proposal> {
  const logger = c.get('logger');
  const graphService = c.get('services').graph;

  logger.debug('Getting governance proposal', {
    proposalId: params.proposalId,
  });

  // Get proposal from the knowledge graph service
  const proposal = await graphService.getProposalById(params.proposalId);

  if (!proposal) {
    throw new NotFoundError('Proposal', params.proposalId);
  }

  // Map to API response format
  const response: Proposal = {
    id: proposal.id,
    uri: proposal.uri,
    fieldId: proposal.fieldId,
    label: undefined, // Would need field lookup
    type: proposal.type,
    changes: proposal.changes,
    rationale: proposal.rationale,
    status: proposal.status,
    proposedBy: proposal.proposedBy,
    proposerName: undefined, // Would need DID resolution
    votes: proposal.votes,
    consensus: undefined, // Would need consensus calculation
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: undefined,
    expiresAt: undefined,
  };

  logger.info('Governance proposal retrieved', {
    proposalId: params.proposalId,
    status: response.status,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.governance.getProposal.
 *
 * @public
 */
export const getProposalEndpoint: XRPCEndpoint<GetProposalParams, Proposal> = {
  method: 'pub.chive.governance.getProposal' as never,
  type: 'query',
  description: 'Get a governance proposal by ID',
  inputSchema: getProposalParamsSchema,
  outputSchema: proposalSchema,
  handler: getProposalHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
