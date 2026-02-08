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

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/governance/getEditorStatus.js';
import type { DID } from '../../../../types/atproto.js';
import {
  AuthenticationError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.governance.getEditorStatus.
 *
 * @public
 */
export const getEditorStatus: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
      throw new ServiceUnavailableError('Trusted editor service not configured', 'trustedEditor');
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

    // Convert reputationScore from 0-1 float to integer for lexicon compliance
    // The service always returns metrics for a valid status
    const rawMetrics = status.metrics ?? {
      did: status.did,
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
      role: status.role,
      eligibleForTrustedEditor: false,
      missingCriteria: [],
    };

    return {
      encoding: 'application/json',
      body: {
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
        metrics: {
          ...rawMetrics,
          reputationScore: Math.round((rawMetrics.reputationScore ?? 0) * 100),
        },
      },
    };
  },
};
