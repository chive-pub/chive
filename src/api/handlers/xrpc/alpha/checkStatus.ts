/**
 * Handler for pub.chive.alpha.checkStatus.
 *
 * @remarks
 * Checks alpha tester application status. Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

// Use generated types from lexicons
import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/alpha/checkStatus.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.alpha.checkStatus.
 *
 * @public
 */
export const checkStatus: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params: _params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const alphaService = c.get('alphaService');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    logger.debug('Checking alpha status', { did: user.did });

    const result = await alphaService.getStatus(user.did);

    return {
      encoding: 'application/json',
      body: {
        status: result.status,
        appliedAt: result.appliedAt?.toISOString(),
        reviewedAt: result.reviewedAt?.toISOString(),
      },
    };
  },
};
