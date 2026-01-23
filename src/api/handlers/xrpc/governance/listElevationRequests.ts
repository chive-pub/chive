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

import type {
  QueryParams,
  OutputSchema,
  ElevationRequest,
  ReputationMetrics,
} from '../../../../lexicons/generated/types/pub/chive/governance/listElevationRequests.js';
import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.listElevationRequests.
 *
 * @public
 */
export const listElevationRequests: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
    // Convert reputationScore from 0-1 float to integer for lexicon compliance
    const enrichedRequests: ElevationRequest[] = await Promise.all(
      result.value.requests.map(async (req) => {
        const metricsResult = await trustedEditorService.calculateReputationMetrics(req.did);
        const rawMetrics = metricsResult.ok
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

        // Scale reputationScore to 0-100 integer
        const metrics: ReputationMetrics = {
          ...rawMetrics,
          reputationScore: Math.round((rawMetrics.reputationScore ?? 0) * 100),
        };

        return {
          id: req.id,
          did: req.did,
          handle: req.handle,
          displayName: req.displayName,
          requestedRole: req.requestedRole as ElevationRequest['requestedRole'],
          currentRole: req.currentRole as ElevationRequest['currentRole'],
          requestedAt:
            typeof req.requestedAt === 'number'
              ? new Date(req.requestedAt).toISOString()
              : req.requestedAt,
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
      encoding: 'application/json',
      body: {
        requests: enrichedRequests,
        cursor: result.value.cursor,
        total: result.value.total,
      },
    };
  },
};
