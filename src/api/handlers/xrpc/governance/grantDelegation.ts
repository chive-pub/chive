/**
 * XRPC handler for pub.chive.governance.grantDelegation.
 *
 * @remarks
 * Grants PDS delegation to a trusted editor. Only accessible to administrators.
 * Delegation allows the user to write records to the Governance PDS.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/governance/grantDelegation.js';
import type { DID, NSID, Timestamp } from '../../../../types/atproto.js';
import {
  AuthenticationError,
  AuthorizationError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.grantDelegation.
 *
 * @public
 */
export const grantDelegation: XRPCMethod<void, InputSchema, OutputSchema> = {
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

    logger.debug('Granting delegation', {
      adminDid,
      delegateDid: input.delegateDid,
      collections: input.collections,
      daysValid: input.daysValid,
    });

    // Check that delegate has trusted editor or higher role
    const delegateStatusResult = await trustedEditorService.getEditorStatus(
      input.delegateDid as DID
    );
    if (!delegateStatusResult.ok || delegateStatusResult.value.role === 'community-member') {
      throw new ValidationError('Delegate must have trusted editor or higher role');
    }

    const delegateStatus = delegateStatusResult.value;

    // Check if delegate already has active delegation
    if (delegateStatus.hasDelegation) {
      return {
        encoding: 'application/json',
        body: {
          success: false,
          message: 'Delegate already has an active delegation',
        },
      };
    }

    // Calculate expiration
    const expiresAt = (Date.now() + input.daysValid * 24 * 60 * 60 * 1000) as Timestamp;

    // Create delegation
    const result = await governancePdsWriter.createDelegation({
      delegateDid: input.delegateDid as DID,
      collections: input.collections as unknown as readonly NSID[],
      expiresAt,
      maxRecordsPerDay: input.maxRecordsPerDay,
      grantedBy: adminDid,
    });

    if (result.ok) {
      logger.info('Delegation granted', {
        delegationId: result.value.id,
        delegateDid: input.delegateDid,
        collections: input.collections,
        expiresAt: new Date(expiresAt).toISOString(),
      });

      return {
        encoding: 'application/json',
        body: {
          success: true,
          delegationId: result.value.id,
          message: 'Delegation granted successfully',
        },
      };
    } else {
      logger.error('Failed to grant delegation', result.error, {
        delegateDid: input.delegateDid,
      });

      return {
        encoding: 'application/json',
        body: {
          success: false,
          message: `Failed to grant delegation: ${result.error.message}`,
        },
      };
    }
  },
};
