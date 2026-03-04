/**
 * XRPC handler for pub.chive.admin.getAuditLog.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface AuditLogParams {
  readonly limit?: number;
  readonly cursor?: string;
  readonly actorDid?: string;
}

export const getAuditLog: XRPCMethod<AuditLogParams, void, unknown> = {
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

    const limit = params.limit ?? 50;
    const offset = params.cursor ? parseInt(params.cursor, 10) : 0;

    const { entries, total } = await admin.getAuditLog(limit, offset, params.actorDid);

    const nextCursor =
      offset + entries.length < total ? String(offset + entries.length) : undefined;

    return {
      encoding: 'application/json',
      body: { entries, cursor: nextCursor, total },
    };
  },
};
