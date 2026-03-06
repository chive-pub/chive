/**
 * XRPC handler for pub.chive.admin.listEprints.
 *
 * @remarks
 * Queries eprints_index with pagination. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface ListEprintsParams {
  readonly q?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export const listEprints: XRPCMethod<ListEprintsParams, void, unknown> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const admin = c.get('services').admin;
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }

    const result = await admin.listEprints(params.q, params.limit ?? 50, params.offset ?? 0);

    return { encoding: 'application/json', body: result };
  },
};
