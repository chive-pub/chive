/**
 * XRPC handler for pub.chive.governance.getProposal.
 *
 * @remarks
 * Gets a single governance proposal by ID with full enrichment.
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

import { calculateConsensus } from './consensus.js';

/**
 * Handler for pub.chive.governance.getProposal query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns The requested proposal with enriched data
 *
 * @public
 */
export async function getProposalHandler(
  c: Context<ChiveEnv>,
  params: GetProposalParams
): Promise<Proposal> {
  const logger = c.get('logger');
  const graphService = c.get('services').graph;
  const trustedEditorService = c.get('services').trustedEditor;

  logger.debug('Getting governance proposal', {
    proposalId: params.proposalId,
  });

  // Get proposal from the knowledge graph service
  const proposal = await graphService.getProposalById(params.proposalId);

  if (!proposal) {
    throw new NotFoundError('Proposal', params.proposalId);
  }

  // Look up node label if nodeUri is set
  let label: string | undefined;
  if (proposal.nodeUri) {
    try {
      const node = await graphService.getNode(proposal.nodeUri);
      if (node) {
        label = node.label;
      }
    } catch {
      // Node not found, label will be undefined
    }
  } else {
    // For create proposals, use the label from changes
    label = (proposal.changes as { label?: string }).label;
  }

  // Look up proposer display name
  let proposerName: string | undefined;
  if (trustedEditorService) {
    try {
      const status = await trustedEditorService.getEditorStatus(proposal.proposedBy);
      if (status.ok && status.value.displayName) {
        proposerName = status.value.displayName;
      }
    } catch {
      // Proposer not found, name will be undefined
    }
  }

  // Calculate consensus
  const consensus = calculateConsensus(proposal.votes);

  // Map to API response format
  const response: Proposal = {
    id: proposal.id,
    uri: proposal.uri,
    nodeUri: proposal.nodeUri,
    label,
    type: proposal.type,
    changes: proposal.changes,
    rationale: proposal.rationale,
    status: proposal.status,
    proposedBy: proposal.proposedBy,
    proposerName,
    votes: proposal.votes,
    consensus,
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
