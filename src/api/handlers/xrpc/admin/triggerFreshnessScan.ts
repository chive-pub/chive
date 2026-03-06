/**
 * XRPC handler for pub.chive.admin.triggerFreshnessScan.
 *
 * @remarks
 * Triggers a freshness scan by detecting stale records via the PDSSyncService
 * and refreshing each one from its source PDS. The actual work runs in the
 * background; the handler returns immediately with the operation ID.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export const triggerFreshnessScan: XRPCMethod<void, void, unknown> = {
  type: 'procedure',
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const logger = c.get('logger');
    const { backfillManager, pdsSync } = c.get('services');
    if (!backfillManager) {
      throw new ServiceUnavailableError('Backfill manager is not configured');
    }
    if (!pdsSync) {
      throw new ServiceUnavailableError('PDS sync service is not configured');
    }

    const { operation } = await backfillManager.startOperation('freshnessScan');

    logger.info('Freshness scan triggered', { operationId: operation.id });

    // Fire-and-forget: detect and refresh stale records in the background
    void (async () => {
      try {
        const staleUris = await pdsSync.detectStaleRecords();
        let refreshed = 0;

        for (const uri of staleUris) {
          const result = await pdsSync.refreshRecord(uri);
          if (result.ok) {
            refreshed++;
          }
          await backfillManager.updateProgress(
            operation.id,
            Math.round((refreshed / staleUris.length) * 100),
            refreshed
          );
        }

        await backfillManager.completeOperation(operation.id, refreshed);
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
