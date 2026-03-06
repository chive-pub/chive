/**
 * XRPC handler for pub.chive.admin.getGraphStats.
 *
 * @remarks
 * Returns knowledge graph statistics including node counts by type,
 * edge count, and pending governance proposal count.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface GraphStatsOutput {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly fieldNodes: number;
  readonly authorNodes: number;
  readonly institutionNodes: number;
  readonly pendingProposals: number;
}

export const getGraphStats: XRPCMethod<void, void, GraphStatsOutput> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<GraphStatsOutput>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const { nodeRepository, edgeRepository, admin } = c.get('services');

    // Query node/edge totals and per-type counts in parallel with graceful fallback
    const [totalNodesResult, totalEdgesResult, fieldResult, authorResult, institutionResult] =
      await Promise.all([
        nodeRepository.listNodes({ limit: 0 }).catch(() => ({ total: 0 })),
        edgeRepository.listEdges({ limit: 0 }).catch(() => ({ total: 0 })),
        nodeRepository.listNodes({ subkind: 'field', limit: 0 }).catch(() => ({ total: 0 })),
        nodeRepository.listNodes({ subkind: 'author', limit: 0 }).catch(() => ({ total: 0 })),
        nodeRepository.listNodes({ subkind: 'institution', limit: 0 }).catch(() => ({ total: 0 })),
      ]);

    // Count pending proposals from PostgreSQL
    const pendingProposals = admin ? await admin.getPendingProposalCount().catch(() => 0) : 0;

    return {
      encoding: 'application/json',
      body: {
        totalNodes: totalNodesResult.total,
        totalEdges: totalEdgesResult.total,
        fieldNodes: fieldResult.total,
        authorNodes: authorResult.total,
        institutionNodes: institutionResult.total,
        pendingProposals,
      },
    };
  },
};
