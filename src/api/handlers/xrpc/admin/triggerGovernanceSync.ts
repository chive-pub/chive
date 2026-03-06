/**
 * XRPC handler for pub.chive.admin.triggerGovernanceSync.
 *
 * @remarks
 * Triggers an immediate governance sync by creating a temporary
 * GovernanceSyncJob and running a single sync cycle. The actual work
 * runs in the background; the handler returns immediately with the
 * operation ID.
 *
 * @packageDocumentation
 * @public
 */

import { getGraphPdsDid } from '../../../../config/graph.js';
import { GovernanceSyncJob } from '../../../../jobs/governance-sync-job.js';
import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Default Graph PDS URL. */
const GRAPH_PDS_URL = process.env.GRAPH_PDS_URL ?? 'https://governance.chive.pub';

export const triggerGovernanceSync: XRPCMethod<void, void, unknown> = {
  type: 'procedure',
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const logger = c.get('logger');
    const { backfillManager, nodeService, edgeService } = c.get('services');
    if (!backfillManager) {
      throw new ServiceUnavailableError('Backfill manager is not configured');
    }

    const { operation } = await backfillManager.startOperation('governanceSync');

    logger.info('Governance sync triggered', { operationId: operation.id });

    // Fire-and-forget: run a one-shot governance sync in the background
    void (async () => {
      try {
        const syncJob = new GovernanceSyncJob({
          pdsUrl: GRAPH_PDS_URL,
          graphPdsDid: getGraphPdsDid(),
          nodeService,
          edgeService,
          logger,
        });

        // Run a single sync cycle (do not start the periodic timer)
        await syncJob.run();

        await backfillManager.completeOperation(operation.id);
      } catch (error) {
        await backfillManager.failOperation(
          operation.id,
          error instanceof Error ? error.message : String(error)
        );
      }
    })();

    return { encoding: 'application/json', body: { operationId: operation.id, status: 'running' } };
  },
};
