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

import type { Context } from 'hono';

import type { DID, NSID, Timestamp } from '../../../../types/atproto.js';
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from '../../../../types/errors.js';
import {
  grantDelegationInputSchema,
  delegationResultSchema,
  type GrantDelegationInput,
  type DelegationResult,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.grantDelegation procedure.
 *
 * @param c - Hono context with Chive environment
 * @param input - Validated input
 * @returns Result of the delegation grant
 *
 * @public
 */
export async function grantDelegationHandler(
  c: Context<ChiveEnv>,
  input: GrantDelegationInput
): Promise<DelegationResult> {
  const logger = c.get('logger');
  const user = c.get('user');

  // Check auth first for better error messages
  if (!user?.did) {
    throw new AuthenticationError('Authentication required');
  }

  const trustedEditorService = c.get('services').trustedEditor;
  const governancePdsWriter = c.get('services').governancePdsWriter;
  if (!trustedEditorService || !governancePdsWriter) {
    throw new Error('Governance services not configured');
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
  const delegateStatusResult = await trustedEditorService.getEditorStatus(input.delegateDid as DID);
  if (!delegateStatusResult.ok || delegateStatusResult.value.role === 'community-member') {
    throw new ValidationError('Delegate must have trusted editor or higher role');
  }

  const delegateStatus = delegateStatusResult.value;

  // Check if delegate already has active delegation
  if (delegateStatus.hasDelegation) {
    return {
      success: false,
      message: 'Delegate already has an active delegation',
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
      success: true,
      delegationId: result.value.id,
      message: 'Delegation granted successfully',
    };
  } else {
    logger.error('Failed to grant delegation', result.error, {
      delegateDid: input.delegateDid,
    });

    return {
      success: false,
      message: `Failed to grant delegation: ${result.error.message}`,
    };
  }
}

/**
 * Endpoint definition for pub.chive.governance.grantDelegation.
 *
 * @public
 */
export const grantDelegationEndpoint: XRPCEndpoint<GrantDelegationInput, DelegationResult> = {
  method: 'pub.chive.governance.grantDelegation' as never,
  type: 'procedure',
  description: 'Grant PDS delegation to a trusted editor (admin only)',
  inputSchema: grantDelegationInputSchema,
  outputSchema: delegationResultSchema,
  handler: grantDelegationHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
