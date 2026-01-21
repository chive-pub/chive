/**
 * XRPC handler for pub.chive.governance.getProposal.
 *
 * @remarks
 * Gets a single governance proposal by ID with full enrichment.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/governance/getProposal.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import { calculateConsensus } from './consensus.js';

/**
 * XRPC method for pub.chive.governance.getProposal.
 *
 * @public
 */
export const getProposal: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
    const body: OutputSchema = {
      id: proposal.id,
      uri: proposal.uri,
      cid: (proposal as { cid?: string }).cid ?? 'placeholder', // CID from proposal record
      nodeUri: proposal.nodeUri,
      label,
      type: proposal.type,
      changes: proposal.changes as OutputSchema['changes'],
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
      status: body.status,
    });

    return { encoding: 'application/json', body };
  },
};
