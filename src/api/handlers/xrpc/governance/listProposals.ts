/**
 * XRPC handler for pub.chive.governance.listProposals.
 *
 * @remarks
 * Lists governance proposals with optional filtering by status and type.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  ProposalView,
  ConsensusProgress,
} from '../../../../lexicons/generated/types/pub/chive/governance/listProposals.js';
import type { DID } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import { calculateConsensus } from './consensus.js';

/**
 * XRPC method for pub.chive.governance.listProposals.
 *
 * @public
 */
export const listProposals: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const graphService = c.get('services').graph;

    logger.debug('Listing governance proposals', {
      status: params.status,
      type: params.type,
      limit: params.limit,
    });

    // Map API status to service status (filter out 'expired' which is not supported)
    const supportedStatuses = ['pending', 'approved', 'rejected'] as const;
    const filteredStatus = params.status
      ? supportedStatuses.filter((s) => s === params.status)
      : undefined;

    // Get proposals from the knowledge graph service
    const result = await graphService.listProposals({
      status: filteredStatus && filteredStatus.length > 0 ? filteredStatus[0] : undefined,
      type: params.type as 'create' | 'update' | 'merge' | 'deprecate' | undefined,
      nodeUri: params.nodeUri,
      proposedBy: params.proposedBy,
      limit: params.limit,
      cursor: params.cursor,
    });

    // Collect unique node URIs and proposer DIDs for batch lookup
    const nodeUris = new Set<string>();
    const proposerDids = new Set<string>();

    for (const p of result.proposals) {
      if (p.nodeUri) {
        nodeUris.add(p.nodeUri);
      }
      proposerDids.add(p.proposedBy);
    }

    // Batch lookup node labels
    const nodeLabels = new Map<string, string>();
    for (const nodeUri of nodeUris) {
      try {
        const node = await graphService.getNode(nodeUri);
        if (node) {
          nodeLabels.set(nodeUri, node.label);
        }
      } catch {
        // Node not found, label will be undefined
      }
    }

    // Batch lookup proposer names from authors_index
    const proposerNames = new Map<string, string>();
    const trustedEditorService = c.get('services').trustedEditor;
    if (trustedEditorService) {
      for (const did of proposerDids) {
        try {
          const status = await trustedEditorService.getEditorStatus(did as DID);
          if (status.ok && status.value.displayName) {
            proposerNames.set(did, status.value.displayName);
          }
        } catch {
          // Proposer not found, name will be undefined
        }
      }
    }

    // Map to API response format with enriched data
    const proposals: ProposalView[] = result.proposals.map((p) => ({
      id: p.id,
      uri: p.uri,
      cid: (p as { cid?: string }).cid ?? 'placeholder', // CID from proposal record
      nodeUri: p.nodeUri,
      label: p.nodeUri ? nodeLabels.get(p.nodeUri) : (p.changes as { label?: string }).label,
      type: p.type,
      changes: p.changes as ProposalView['changes'],
      rationale: p.rationale,
      status: p.status,
      proposedBy: p.proposedBy,
      proposerName: proposerNames.get(p.proposedBy),
      votes: p.votes,
      consensus: calculateConsensus(p.votes) as unknown as ConsensusProgress,
      createdAt: p.createdAt.toISOString(),
      updatedAt: undefined,
      expiresAt: undefined,
    }));

    const body: OutputSchema = {
      proposals,
      cursor: result.cursor,
      total: result.total,
    };

    logger.info('Governance proposals listed', {
      count: body.proposals.length,
      total: body.total,
    });

    return { encoding: 'application/json', body };
  },
};
