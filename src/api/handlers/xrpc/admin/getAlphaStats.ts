/**
 * XRPC handler for pub.chive.admin.getAlphaStats.
 *
 * @remarks
 * Returns aggregate statistics for alpha applications.
 * Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import type { AlphaStats } from '../../../../services/admin/admin-service.js';
import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export const getAlphaStats: XRPCMethod<void, void, AlphaStats> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<AlphaStats>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const admin = c.get('services').admin;
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }
    const stats = await admin.getAlphaStats();

    return { encoding: 'application/json', body: stats };
  },
};
