/**
 * XRPC handler for pub.chive.admin.getAlphaApplication.
 *
 * @remarks
 * Returns a single alpha application by DID. Requires admin authentication.
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

interface GetAlphaParams {
  readonly did: string;
}

export const getAlphaApplication: XRPCMethod<GetAlphaParams, void, unknown> = {
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
    const application = await admin.getAlphaApplication(params.did);

    if (!application) {
      throw new NotFoundError('AlphaApplication', params.did);
    }

    return { encoding: 'application/json', body: application };
  },
};
