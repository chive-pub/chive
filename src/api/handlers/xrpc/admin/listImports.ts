/**
 * XRPC handler for pub.chive.admin.listImports.
 *
 * @remarks
 * Queries imported eprints. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import { AuthorizationError, ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface ListImportsParams {
  readonly limit?: number;
  readonly source?: string;
}

export const listImports: XRPCMethod<ListImportsParams, void, unknown> = {
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
    const { items, total } = await admin.listImports(limit, 0, params.source);

    return {
      encoding: 'application/json',
      body: { items, total },
    };
  },
};
