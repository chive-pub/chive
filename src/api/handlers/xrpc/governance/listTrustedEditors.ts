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

import type {
  QueryParams,
  OutputSchema,
  TrustedEditor,
} from '../../../../lexicons/generated/types/pub/chive/governance/listTrustedEditors.js';
import { AuthenticationError, AuthorizationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.listTrustedEditors.
 *
 * @public
 */
export const listTrustedEditors: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
    // Convert reputationScore from 0-1 float to integer for lexicon compliance
    const editors: TrustedEditor[] = result.value.editors
      .filter((e) => !params.role || e.role === params.role)
      .map((e) => {
        // Default metrics if service doesn't provide them
        const rawMetrics = e.metrics ?? {
          did: e.did,
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
          role: e.role,
          eligibleForTrustedEditor: false,
          missingCriteria: [],
        };

        return {
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
          metrics: {
            ...rawMetrics,
            reputationScore: Math.round((rawMetrics.reputationScore ?? 0) * 100),
          },
        };
      });

    logger.info('Trusted editors listed', {
      count: editors.length,
      total: editors.length,
    });

    return {
      encoding: 'application/json',
      body: {
        editors,
        cursor: result.value.cursor,
        total: editors.length,
      },
    };
  },
};
