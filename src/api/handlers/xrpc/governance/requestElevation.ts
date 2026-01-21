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

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/governance/requestElevation.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.requestElevation.
 *
 * @public
 */
export const requestElevation: XRPCMethod<void, InputSchema, OutputSchema> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');

    // Check auth first for better error messages
    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    if (!input) {
      throw new Error('Input required');
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
        encoding: 'application/json',
        body: {
          success: false,
          message: `You already have the ${status.role} role`,
        },
      };
    }

    // Check eligibility criteria
    if (!status.metrics.eligibleForTrustedEditor) {
      const missingCriteria = status.metrics.missingCriteria.join(', ');
      return {
        encoding: 'application/json',
        body: {
          success: false,
          message: `Not yet eligible. Missing criteria: ${missingCriteria}`,
        },
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
          encoding: 'application/json',
          body: {
            success: true,
            message: 'Successfully elevated to trusted editor',
          },
        };
      } else {
        logger.warn('Elevation request failed', {
          userDid,
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
    }

    return {
      encoding: 'application/json',
      body: {
        success: false,
        message: 'Invalid target role',
      },
    };
  },
};
