/**
 * XRPC handler for pub.chive.governance.revokeDelegation.
 *
 * @remarks
 * Revokes an active PDS delegation. Only accessible to administrators.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/governance/revokeDelegation.js';
import {
  AuthenticationError,
  AuthorizationError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.revokeDelegation.
 *
 * @public
 */
export const revokeDelegation: XRPCMethod<void, InputSchema, OutputSchema> = {
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
      throw new ValidationError('Request body is required', 'input', 'required');
    }

    const trustedEditorService = c.get('services').trustedEditor;
    const governancePdsWriter = c.get('services').governancePdsWriter;
    if (!trustedEditorService || !governancePdsWriter) {
      throw new ServiceUnavailableError('Governance services not configured', 'governance');
    }

    const adminDid = user.did;

    // Check if caller is administrator
    const callerStatusResult = await trustedEditorService.getEditorStatus(adminDid);
    if (!callerStatusResult.ok || callerStatusResult.value.role !== 'administrator') {
      throw new AuthorizationError('Administrator access required');
    }

    logger.debug('Revoking delegation', {
      adminDid,
      delegationId: input.delegationId,
    });

    // Revoke delegation
    const result = await governancePdsWriter.revokeDelegation(input.delegationId, adminDid);

    if (result.ok) {
      logger.info('Delegation revoked', {
        delegationId: input.delegationId,
        revokedBy: adminDid,
      });

      return {
        encoding: 'application/json',
        body: {
          success: true,
          delegationId: input.delegationId,
          message: 'Delegation revoked successfully',
        },
      };
    } else {
      logger.error('Failed to revoke delegation', result.error, {
        delegationId: input.delegationId,
      });

      return {
        encoding: 'application/json',
        body: {
          success: false,
          message: `Failed to revoke delegation: ${result.error.message}`,
        },
      };
    }
  },
};
