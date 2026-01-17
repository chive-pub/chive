/**
 * XRPC handler for pub.chive.governance.getEditorStatus.
 *
 * @remarks
 * Gets the trusted editor status and reputation metrics for a user.
 * Returns the user's current governance role, delegation status,
 * and progress toward trusted editor eligibility.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { DID } from '../../../../types/atproto.js';
import { AuthenticationError, NotFoundError } from '../../../../types/errors.js';
import {
  getEditorStatusParamsSchema,
  editorStatusSchema,
  type GetEditorStatusParams,
  type EditorStatus,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.getEditorStatus query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns The editor status for the requested user
 *
 * @public
 */
export async function getEditorStatusHandler(
  c: Context<ChiveEnv>,
  params: GetEditorStatusParams
): Promise<EditorStatus> {
  const logger = c.get('logger');
  const user = c.get('user');

  // Determine which DID to look up - check auth first for better error messages
  let targetDid: DID;
  if (params.did) {
    targetDid = params.did as DID;
  } else if (user?.did) {
    targetDid = user.did;
  } else {
    throw new AuthenticationError('Authentication required when no DID specified');
  }

  const trustedEditorService = c.get('services').trustedEditor;
  if (!trustedEditorService) {
    throw new Error('Trusted editor service not configured');
  }

  logger.debug('Getting editor status', { targetDid });

  // Get editor status from service
  const result = await trustedEditorService.getEditorStatus(targetDid);

  if (!result.ok) {
    throw new NotFoundError('Editor status', targetDid);
  }

  const status = result.value;

  logger.info('Editor status retrieved', {
    did: targetDid,
    role: status.role,
    hasDelegation: status.hasDelegation,
  });

  return {
    did: status.did,
    displayName: status.displayName,
    role: status.role,
    roleGrantedAt: status.roleGrantedAt,
    roleGrantedBy: status.roleGrantedBy,
    hasDelegation: status.hasDelegation,
    delegationExpiresAt: status.delegationExpiresAt,
    delegationCollections: status.delegationCollections
      ? [...status.delegationCollections]
      : undefined,
    recordsCreatedToday: status.recordsCreatedToday,
    dailyRateLimit: status.dailyRateLimit,
    metrics: status.metrics,
  };
}

/**
 * Endpoint definition for pub.chive.governance.getEditorStatus.
 *
 * @public
 */
export const getEditorStatusEndpoint: XRPCEndpoint<GetEditorStatusParams, EditorStatus> = {
  method: 'pub.chive.governance.getEditorStatus' as never,
  type: 'query',
  description: 'Get trusted editor status and reputation metrics for a user',
  inputSchema: getEditorStatusParamsSchema,
  outputSchema: editorStatusSchema,
  handler: getEditorStatusHandler,
  auth: 'optional',
  rateLimit: 'authenticated',
};
