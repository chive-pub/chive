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
import { AuthenticationError, NotFoundError } from '../../../../types/errors.js';
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
        metrics: status.metrics,
      },
    };
  },
};
