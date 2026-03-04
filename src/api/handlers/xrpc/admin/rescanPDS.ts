/**
 * XRPC handler for pub.chive.admin.rescanPDS.
 *
 * @packageDocumentation
 * @public
 */

import { adminMetrics } from '../../../../observability/prometheus-registry.js';
import { AuthorizationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface RescanPDSInput {
  readonly pdsUrl: string;
}

export const rescanPDS: XRPCMethod<void, RescanPDSInput, unknown> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (!input?.pdsUrl) {
      throw new ValidationError('PDS URL is required', 'pdsUrl', 'required');
    }

    const pdsRegistry = c.get('services').pdsRegistry;
    if (pdsRegistry) {
      // Re-register the PDS to trigger a rescan
      await pdsRegistry.registerPDS(input.pdsUrl, 'did_mention');
    }

    adminMetrics.actionsTotal.inc({ action: 'rescan', target: 'pds' });

    c.get('logger').info('PDS rescan triggered', { pdsUrl: input.pdsUrl });

    return {
      encoding: 'application/json',
      body: { success: true, pdsUrl: input.pdsUrl },
    };
  },
};
