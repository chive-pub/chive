/**
 * XRPC handler for pub.chive.admin.listWarnings.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface ListWarningsParams {
  readonly limit?: number;
  readonly did?: string;
}

export const listWarnings: XRPCMethod<ListWarningsParams, void, unknown> = {
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

    const { warnings } = await admin.listWarnings(params.limit ?? 50, params.did);

    return {
      encoding: 'application/json',
      body: { warnings },
    };
  },
};
