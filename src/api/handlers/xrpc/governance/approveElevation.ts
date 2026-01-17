/**
 * XRPC handler for pub.chive.governance.approveElevation.
 *
 * @remarks
 * Approves a pending elevation request.
 * Only accessible by administrators.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import {
  approveElevationInputSchema,
  elevationResultSchema,
  type ApproveElevationInput,
  type ElevationResult,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.approveElevation procedure.
 *
 * @param c - Hono context with Chive environment
 * @param input - Validated input
 * @returns Result of the approval
 *
 * @public
 */
export async function approveElevationHandler(
  c: Context<ChiveEnv>,
  input: ApproveElevationInput
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

  logger.debug('Processing elevation approval', {
    requestId: input.requestId,
    adminDid: user.did,
  });

  // Use service method to approve the request
  const result = await trustedEditorService.approveElevationRequest(
    input.requestId,
    user.did,
    input.verificationNotes
  );

  if (!result.ok) {
    logger.warn('Failed to approve elevation request', {
      requestId: input.requestId,
      error: result.error.message,
    });

    return {
      success: false,
      message: result.error.message,
    };
  }

  logger.info('Elevation request approved', {
    requestId: input.requestId,
    adminDid: user.did,
  });

  return {
    success: true,
    requestId: result.value.requestId,
    message: result.value.message,
  };
}

/**
 * Endpoint definition for pub.chive.governance.approveElevation.
 *
 * @public
 */
export const approveElevationEndpoint: XRPCEndpoint<ApproveElevationInput, ElevationResult> = {
  method: 'pub.chive.governance.approveElevation' as never,
  type: 'procedure',
  description: 'Approve a pending elevation request (admin only)',
  inputSchema: approveElevationInputSchema,
  outputSchema: elevationResultSchema,
  handler: approveElevationHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
