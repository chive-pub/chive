/**
 * XRPC handler for pub.chive.governance.listElevationRequests.
 *
 * @remarks
 * Lists pending elevation requests for admin review.
 * Only accessible by administrators.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import {
  listTrustedEditorsParamsSchema,
  elevationRequestsResponseSchema,
  type ListTrustedEditorsParams,
  type ElevationRequestsResponse,
  type ElevationRequest,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.listElevationRequests query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns List of pending elevation requests
 *
 * @public
 */
export async function listElevationRequestsHandler(
  c: Context<ChiveEnv>,
  params: ListTrustedEditorsParams
): Promise<ElevationRequestsResponse> {
  const logger = c.get('logger');
  const user = c.get('user');

  if (!user?.did) {
    throw new AuthenticationError('Authentication required');
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

  const limit = params.limit ?? 20;

  logger.debug('Listing elevation requests', { limit, cursor: params.cursor });

  // Use service method to get elevation requests
  const result = await trustedEditorService.listElevationRequests(limit, params.cursor);

  if (!result.ok) {
    throw new Error(`Failed to list elevation requests: ${result.error.message}`);
  }

  // Enrich with metrics
  const enrichedRequests: ElevationRequest[] = await Promise.all(
    result.value.requests.map(async (req) => {
      const metricsResult = await trustedEditorService.calculateReputationMetrics(req.did);
      const metrics = metricsResult.ok
        ? metricsResult.value
        : {
            did: req.did,
            accountCreatedAt: Date.now(),
            accountAgeDays: 0,
            eprintCount: 0,
            wellEndorsedEprintCount: 0,
            totalEndorsements: 0,
            proposalCount: 0,
            voteCount: 0,
            successfulProposals: 0,
            warningCount: 0,
            violationCount: 0,
            reputationScore: 0,
            role: req.currentRole,
            eligibleForTrustedEditor: false,
            missingCriteria: [],
          };

      return {
        id: req.id,
        did: req.did,
        handle: req.handle,
        displayName: req.displayName,
        requestedRole: req.requestedRole as ElevationRequest['requestedRole'],
        currentRole: req.currentRole as ElevationRequest['currentRole'],
        requestedAt: req.requestedAt,
        metrics,
        verificationNotes: req.verificationNotes,
      };
    })
  );

  logger.info('Elevation requests listed', {
    count: enrichedRequests.length,
    total: result.value.total,
  });

  return {
    requests: enrichedRequests,
    cursor: result.value.cursor,
    total: result.value.total,
  };
}

/**
 * Endpoint definition for pub.chive.governance.listElevationRequests.
 *
 * @public
 */
export const listElevationRequestsEndpoint: XRPCEndpoint<
  ListTrustedEditorsParams,
  ElevationRequestsResponse
> = {
  method: 'pub.chive.governance.listElevationRequests' as never,
  type: 'query',
  description: 'List pending elevation requests (admin only)',
  inputSchema: listTrustedEditorsParamsSchema,
  outputSchema: elevationRequestsResponseSchema,
  handler: listElevationRequestsHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
