/**
 * XRPC handler for pub.chive.admin.triggerPDSScan.
 *
 * @remarks
 * Triggers a PDS scan by fetching PDSes ready for scanning from the registry
 * and invoking the PDSScanner against each. The actual work runs in the
 * background; the handler returns immediately with the operation ID.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export const triggerPDSScan: XRPCMethod<void, void, unknown> = {
  type: 'procedure',
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const logger = c.get('logger');
    const { backfillManager, pdsRegistry, pdsScanner } = c.get('services');
    if (!backfillManager) {
      throw new ServiceUnavailableError('Backfill manager is not configured');
    }
    if (!pdsRegistry || !pdsScanner) {
      throw new ServiceUnavailableError('PDS discovery services are not configured');
    }

    const { operation } = await backfillManager.startOperation('pdsScan');

    logger.info('PDS scan triggered', { operationId: operation.id });

    // Fire-and-forget: run the actual PDS scan in the background
    void (async () => {
      try {
        const batchSize = 10;
        const concurrency = 2;
        const pendingScan = await pdsRegistry.getPDSesForScan(batchSize);

        if (pendingScan.length === 0) {
          await backfillManager.completeOperation(operation.id, 0);
          return;
        }

        const pdsUrls = pendingScan.map((p) => p.pdsUrl);
        const scanResults = await pdsScanner.scanMultiplePDSes(pdsUrls, concurrency);

        let recordsProcessed = 0;
        for (const [, scanResult] of scanResults) {
          if (!(scanResult instanceof Error)) {
            recordsProcessed += scanResult.chiveRecordCount;
          }
        }

        await backfillManager.completeOperation(operation.id, recordsProcessed);
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
