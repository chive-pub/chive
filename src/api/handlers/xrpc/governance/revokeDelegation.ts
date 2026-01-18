/**
 * XRPC handler for pub.chive.governance.revokeDelegation.
 *
 * @remarks
 * Revokes an active PDS delegation. Only accessible to administrators.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import {
  revokeDelegationInputSchema,
  delegationResultSchema,
  type RevokeDelegationInput,
  type DelegationResult,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.revokeDelegation procedure.
 *
 * @param c - Hono context with Chive environment
 * @param input - Validated input
 * @returns Result of the delegation revocation
 *
 * @public
 */
export async function revokeDelegationHandler(
  c: Context<ChiveEnv>,
  input: RevokeDelegationInput
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
      success: true,
      delegationId: input.delegationId,
      message: 'Delegation revoked successfully',
    };
  } else {
    logger.error('Failed to revoke delegation', result.error, {
      delegationId: input.delegationId,
    });

    return {
      success: false,
      message: `Failed to revoke delegation: ${result.error.message}`,
    };
  }
}

/**
 * Endpoint definition for pub.chive.governance.revokeDelegation.
 *
 * @public
 */
export const revokeDelegationEndpoint: XRPCEndpoint<RevokeDelegationInput, DelegationResult> = {
  method: 'pub.chive.governance.revokeDelegation' as never,
  type: 'procedure',
  description: 'Revoke an active PDS delegation (admin only)',
  inputSchema: revokeDelegationInputSchema,
  outputSchema: delegationResultSchema,
  handler: revokeDelegationHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
