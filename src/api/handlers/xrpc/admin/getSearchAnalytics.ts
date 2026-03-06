/**
 * XRPC handler for pub.chive.admin.getSearchAnalytics.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export const getSearchAnalytics: XRPCMethod<void, void, unknown> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const admin = c.get('services').admin;
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }

    const analytics = await admin.getSearchAnalytics();

    return {
      encoding: 'application/json',
      body: analytics,
    };
  },
};
