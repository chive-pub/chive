/**
 * XRPC handler for pub.chive.admin.getUserDetail.
 *
 * @remarks
 * Returns detailed user information including stats and roles.
 * Requires admin authentication.
 *
 * @packageDocumentation
 * @public
 */

import {
  AuthorizationError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

interface GetUserParams {
  readonly did: string;
}

export const getUserDetail: XRPCMethod<GetUserParams, void, unknown> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<unknown>> => {
    const user = c.get('user');
    if (!user?.isAdmin) {
      throw new AuthorizationError('Admin access required', 'admin');
    }

    if (!params.did) {
      throw new ValidationError('DID is required', 'did', 'required');
    }

    const admin = c.get('services').admin;
    if (!admin) {
      throw new ServiceUnavailableError('Admin service is not configured');
    }
    const detail = await admin.getUserDetail(params.did);

    if (!detail) {
      throw new NotFoundError('User', params.did);
    }

    return { encoding: 'application/json', body: detail };
  },
};
