/**
 * XRPC handler for pub.chive.admin.searchUsers.
 *
 * @remarks
 * Searches users by handle or DID. Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import {
  AuthorizationError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface SearchUsersParams {
  readonly query: string;
  readonly limit?: number;
}

export const searchUsers: XRPCMethod<SearchUsersParams, void, unknown> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (!params.query) {
      throw new ValidationError('Query is required', 'query', 'required');
    }

    const admin = c.get('services').admin;
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }
    const users = await admin.searchUsers(params.query, params.limit ?? 20);

    return { encoding: 'application/json', body: { users } };
  },
};
