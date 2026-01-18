/**
 * XRPC handler for pub.chive.governance.requestElevation.
 *
 * @remarks
 * Allows users to request elevation to trusted editor role.
 * The request is validated against eligibility criteria.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import {
  requestElevationInputSchema,
  elevationResultSchema,
  type RequestElevationInput,
  type ElevationResult,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.requestElevation procedure.
 *
 * @param c - Hono context with Chive environment
 * @param input - Validated input
 * @returns Result of the elevation request
 *
 * @public
 */
export async function requestElevationHandler(
  c: Context<ChiveEnv>,
  input: RequestElevationInput
): Promise<ElevationResult> {
  const logger = c.get('logger');
  const user = c.get('user');

  // Check auth first for better error messages
  if (!user?.did) {
    throw new AuthenticationError('Authentication required');
  }

  const trustedEditorService = c.get('services').trustedEditor;
  if (!trustedEditorService) {
    throw new Error('Trusted editor service not configured');
  }

  const userDid = user.did;

  logger.debug('Processing elevation request', {
    userDid,
    targetRole: input.targetRole,
  });

  // Get current status to check eligibility
  const statusResult = await trustedEditorService.getEditorStatus(userDid);

  if (!statusResult.ok) {
    throw new ValidationError('Unable to retrieve user status');
  }

  const status = statusResult.value;

  // Check if already has the role or higher
  if (status.role !== 'community-member') {
    return {
      success: false,
      message: `You already have the ${status.role} role`,
    };
  }

  // Check eligibility criteria
  if (!status.metrics.eligibleForTrustedEditor) {
    const missingCriteria = status.metrics.missingCriteria.join(', ');
    return {
      success: false,
      message: `Not yet eligible. Missing criteria: ${missingCriteria}`,
    };
  }

  // Process automatic elevation for trusted-editor
  if (input.targetRole === 'trusted-editor') {
    // For automatic elevation, the system grants itself
    const result = await trustedEditorService.elevateToTrustedEditor(userDid, userDid);

    if (result.ok) {
      logger.info('User elevated to trusted editor', {
        userDid,
      });

      return {
        success: true,
        message: 'Successfully elevated to trusted editor',
      };
    } else {
      logger.warn('Elevation request failed', {
        userDid,
        error: result.error.message,
      });

      return {
        success: false,
        message: result.error.message,
      };
    }
  }

  return {
    success: false,
    message: 'Invalid target role',
  };
}

/**
 * Endpoint definition for pub.chive.governance.requestElevation.
 *
 * @public
 */
export const requestElevationEndpoint: XRPCEndpoint<RequestElevationInput, ElevationResult> = {
  method: 'pub.chive.governance.requestElevation' as never,
  type: 'procedure',
  description: 'Request elevation to trusted editor role',
  inputSchema: requestElevationInputSchema,
  outputSchema: elevationResultSchema,
  handler: requestElevationHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
