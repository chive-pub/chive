/**
 * XRPC handler for pub.chive.governance.rejectElevation.
 *
 * @remarks
 * Rejects a pending elevation request.
 * Only accessible by administrators.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import {
  rejectElevationInputSchema,
  elevationResultSchema,
  type RejectElevationInput,
  type ElevationResult,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.rejectElevation procedure.
 *
 * @param c - Hono context with Chive environment
 * @param input - Validated input
 * @returns Result of the rejection
 *
 * @public
 */
export async function rejectElevationHandler(
  c: Context<ChiveEnv>,
  input: RejectElevationInput
): Promise<ElevationResult> {
  const logger = c.get('logger');
  const user = c.get('user');

  if (!user?.did) {
    throw new AuthenticationError('Authentication required');
  }

  // Check if user is admin
  const trustedEditorService = c.get('services').trustedEditor;
  if (!trustedEditorService) {
    throw new Error('Trusted editor service not configured');
  }

  const statusResult = await trustedEditorService.getEditorStatus(user.did);
  if (!statusResult.ok || statusResult.value.role !== 'administrator') {
    throw new AuthorizationError('Administrator access required');
  }

  logger.debug('Processing elevation rejection', {
    requestId: input.requestId,
    adminDid: user.did,
  });

  // Use service method to reject the request
  const result = await trustedEditorService.rejectElevationRequest(
    input.requestId,
    user.did,
    input.reason
  );

  if (!result.ok) {
    logger.warn('Failed to reject elevation request', {
      requestId: input.requestId,
      error: result.error.message,
    });

    return {
      success: false,
      message: result.error.message,
    };
  }

  logger.info('Elevation request rejected', {
    requestId: input.requestId,
    adminDid: user.did,
    reason: input.reason,
  });

  return {
    success: true,
    requestId: result.value.requestId,
    message: result.value.message,
  };
}

/**
 * Endpoint definition for pub.chive.governance.rejectElevation.
 *
 * @public
 */
export const rejectElevationEndpoint: XRPCEndpoint<RejectElevationInput, ElevationResult> = {
  method: 'pub.chive.governance.rejectElevation' as never,
  type: 'procedure',
  description: 'Reject a pending elevation request (admin only)',
  inputSchema: rejectElevationInputSchema,
  outputSchema: elevationResultSchema,
  handler: rejectElevationHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
