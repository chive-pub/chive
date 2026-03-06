/**
 * XRPC handler for pub.chive.admin.getOverview.
 *
 * @remarks
 * Returns aggregate counts from all index tables.
 * Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import type { AdminOverview } from '../../../../services/admin/admin-service.js';
import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export const getOverview: XRPCMethod<void, void, AdminOverview> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<AdminOverview>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const admin = c.get('services').admin;
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }

    const overview = await admin.getOverview();

    return { encoding: 'application/json', body: overview };
  },
};
