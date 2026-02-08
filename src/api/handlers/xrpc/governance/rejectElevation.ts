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

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/governance/rejectElevation.js';
import {
  AuthenticationError,
  AuthorizationError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.rejectElevation.
 *
 * @public
 */
export const rejectElevation: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    if (!input) {
      throw new ValidationError('Request body is required', 'input', 'required');
    }

    // Check if user is admin
    const trustedEditorService = c.get('services').trustedEditor;
    if (!trustedEditorService) {
      throw new ServiceUnavailableError('Trusted editor service not configured', 'trustedEditor');
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
        encoding: 'application/json',
        body: {
          success: false,
          message: result.error.message,
        },
      };
    }

    logger.info('Elevation request rejected', {
      requestId: input.requestId,
      adminDid: user.did,
      reason: input.reason,
    });

    return {
      encoding: 'application/json',
      body: {
        success: true,
        requestId: result.value.requestId,
        message: result.value.message,
      },
    };
  },
};
