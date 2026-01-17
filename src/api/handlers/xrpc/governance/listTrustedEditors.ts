/**
 * XRPC handler for pub.chive.governance.listTrustedEditors.
 *
 * @remarks
 * Lists all users with trusted editor or higher roles.
 * Only accessible to administrators.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import {
  listTrustedEditorsParamsSchema,
  trustedEditorsResponseSchema,
  type ListTrustedEditorsParams,
  type TrustedEditorsResponse,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.listTrustedEditors query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns List of trusted editors
 *
 * @public
 */
export async function listTrustedEditorsHandler(
  c: Context<ChiveEnv>,
  params: ListTrustedEditorsParams
): Promise<TrustedEditorsResponse> {
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

  const callerStatusResult = await trustedEditorService.getEditorStatus(user.did);
  if (!callerStatusResult.ok || callerStatusResult.value.role !== 'administrator') {
    throw new AuthorizationError('Administrator access required');
  }

  logger.debug('Listing trusted editors', {
    role: params.role,
    limit: params.limit,
    cursor: params.cursor,
  });

  // Get trusted editors from service
  const result = await trustedEditorService.listTrustedEditors(params.limit, params.cursor);

  if (!result.ok) {
    throw new Error(`Failed to list trusted editors: ${result.error.message}`);
  }

  // Map to API response format
  const editors = result.value.editors
    .filter((e) => !params.role || e.role === params.role)
    .map((e) => ({
      did: e.did,
      handle: undefined,
      displayName: e.displayName,
      role: e.role,
      roleGrantedAt: e.roleGrantedAt ?? Date.now(),
      roleGrantedBy: e.roleGrantedBy,
      hasDelegation: e.hasDelegation,
      delegationExpiresAt: e.delegationExpiresAt,
      recordsCreatedToday: e.recordsCreatedToday,
      dailyRateLimit: e.dailyRateLimit,
      metrics: e.metrics,
    }));

  logger.info('Trusted editors listed', {
    count: editors.length,
    total: editors.length,
  });

  return {
    editors,
    cursor: result.value.cursor,
    total: editors.length,
  };
}

/**
 * Endpoint definition for pub.chive.governance.listTrustedEditors.
 *
 * @public
 */
export const listTrustedEditorsEndpoint: XRPCEndpoint<
  ListTrustedEditorsParams,
  TrustedEditorsResponse
> = {
  method: 'pub.chive.governance.listTrustedEditors' as never,
  type: 'query',
  description: 'List all users with trusted editor or higher roles (admin only)',
  inputSchema: listTrustedEditorsParamsSchema,
  outputSchema: trustedEditorsResponseSchema,
  handler: listTrustedEditorsHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
