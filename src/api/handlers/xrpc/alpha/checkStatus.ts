/**
 * Handler for pub.chive.alpha.checkStatus.
 *
 * @remarks
 * Checks alpha tester application status. Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  alphaCheckStatusParamsSchema,
  alphaCheckStatusResponseSchema,
  type AlphaCheckStatusParams,
  type AlphaCheckStatusResponse,
} from '../../../schemas/alpha.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.alpha.checkStatus.
 *
 * @param c - Hono context
 * @param _params - Empty parameters (uses authenticated user)
 * @returns Alpha status
 *
 * @public
 */
export async function checkStatusHandler(
  c: Context<ChiveEnv>,
  _params: AlphaCheckStatusParams
): Promise<AlphaCheckStatusResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const alphaService = c.get('alphaService');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.debug('Checking alpha status', { did: user.did });

  const result = await alphaService.getStatus(user.did);

  return {
    status: result.status,
    appliedAt: result.appliedAt?.toISOString(),
    reviewedAt: result.reviewedAt?.toISOString(),
  };
}

/**
 * Endpoint definition for pub.chive.alpha.checkStatus.
 *
 * @public
 */
export const checkStatusEndpoint: XRPCEndpoint<AlphaCheckStatusParams, AlphaCheckStatusResponse> = {
  method: 'pub.chive.alpha.checkStatus' as never,
  type: 'query',
  description: 'Check alpha tester application status',
  inputSchema: alphaCheckStatusParamsSchema,
  outputSchema: alphaCheckStatusResponseSchema,
  handler: checkStatusHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
