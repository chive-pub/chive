/**
 * Handler for pub.chive.claiming.startClaimFromExternal.
 *
 * @remarks
 * Starts a claim directly from an external search result.
 * Imports the eprint on-demand if not already imported.
 *
 * @packageDocumentation
 * @public
 */

import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/startClaimFromExternal.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.startClaimFromExternal.
 *
 * @remarks
 * Implements "import on demand" - only imports the eprint when
 * a user actually wants to claim it.
 *
 * Flow:
 * 1. Check if eprint already imported
 * 2. If not, fetch from external source and import
 * 3. Create claim request
 *
 * @public
 */
export const startClaimFromExternal: XRPCMethod<void, InputSchema, OutputSchema> = {
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    if (!input) {
      throw new ValidationError('Input is required', 'input');
    }
    const params = input;
    const logger = c.get('logger');
    const user = c.get('user');
    const { claiming } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required to claim eprints');
    }

    logger.info('Starting claim from external', {
      source: params.source,
      externalId: params.externalId,
      claimantDid: user.did,
    });

    // Start claim (imports on demand if needed)
    const claim = await claiming.startClaimFromExternal(params.source, params.externalId, user.did);

    logger.info('Claim started from external', {
      claimId: claim.id,
      source: params.source,
      externalId: params.externalId,
      claimantDid: user.did,
    });

    return {
      encoding: 'application/json',
      body: {
        claim: {
          id: claim.id,
          importId: claim.importId,
          claimantDid: claim.claimantDid,
          status: claim.status,
          canonicalUri: claim.canonicalUri,
          rejectionReason: claim.rejectionReason,
          reviewedBy: claim.reviewedBy,
          reviewedAt: claim.reviewedAt?.toISOString(),
          createdAt: claim.createdAt.toISOString(),
          expiresAt: claim.expiresAt?.toISOString(),
        },
      },
    };
  },
};
