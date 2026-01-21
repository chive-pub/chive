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

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/governance/approveElevation.js';
import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.approveElevation.
 *
 * @public
 */
export const approveElevation: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    if (!input) {
      throw new Error('Input required');
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
        encoding: 'application/json',
        body: {
          success: false,
          message: result.error.message,
        },
      };
    }

    logger.info('Elevation request approved', {
      requestId: input.requestId,
      adminDid: user.did,
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
