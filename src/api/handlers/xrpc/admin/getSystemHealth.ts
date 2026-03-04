/**
 * XRPC handler for pub.chive.admin.getSystemHealth.
 *
 * @remarks
 * Returns health status for each database connection.
 * Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import type { SystemHealth } from '../../../../services/admin/admin-service.js';
import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

export const getSystemHealth: XRPCMethod<void, void, SystemHealth> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<SystemHealth>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    const admin = c.get('services').admin;
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }

    const health = await admin.getSystemHealth();

    return { encoding: 'application/json', body: health };
  },
};
