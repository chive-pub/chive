/**
 * Get current user's roles handler.
 *
 * @remarks
 * Returns the authenticated user's roles and boolean flags for
 * admin, alpha tester, and premium status. Reads from the
 * authorization service backed by Redis.
 *
 * @packageDocumentation
 * @public
 */

import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Output schema for getMyRoles.
 */
interface GetMyRolesOutput {
  readonly roles: string[];
  readonly isAdmin: boolean;
  readonly isAlphaTester: boolean;
  readonly isPremium: boolean;
}

/**
 * XRPC method for pub.chive.actor.getMyRoles.
 *
 * @public
 */
export const getMyRoles: XRPCMethod<void, void, GetMyRolesOutput> = {
  auth: true,
  handler: async ({ c }): Promise<XRPCResponse<GetMyRolesOutput>> => {
    const user = c.get('user');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    // The auth middleware already resolves roles and sets boolean flags,
    // but we fetch fresh roles from the authz service for accuracy.
    const redis = c.get('redis');
    const roleKey = `chive:authz:roles:${user.did}`;
    const roles = await redis.smembers(roleKey);

    const isAdmin = roles.includes('admin');
    const isAlphaTester = roles.includes('alpha-tester') || isAdmin;
    const isPremium = roles.includes('premium') || isAdmin;

    return {
      encoding: 'application/json',
      body: {
        roles,
        isAdmin,
        isAlphaTester,
        isPremium,
      },
    };
  },
};
