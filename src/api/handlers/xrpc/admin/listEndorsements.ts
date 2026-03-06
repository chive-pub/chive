/**
 * XRPC handler for pub.chive.admin.listEndorsements.
 *
 * @remarks
 * Queries endorsements_index via admin service. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface ListEndorsementsParams {
  readonly limit?: number;
  readonly cursor?: string;
}

export const listEndorsements: XRPCMethod<ListEndorsementsParams, void, unknown> = {
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
    const { items, total } = await admin.listEndorsements(limit, offset);

    return {
      encoding: 'application/json',
      body: { items, total },
    };
  },
};
