/**
 * XRPC handler for pub.chive.endorsement.getUserEndorsement.
 *
 * @remarks
 * Gets a user's endorsement for a specific eprint.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  EndorsementView,
} from '../../../../lexicons/generated/types/pub/chive/endorsement/getUserEndorsement.js';
import type { AtUri, DID } from '../../../../types/atproto.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

// Use generated types from lexicons

/**
 * XRPC method for pub.chive.endorsement.getUserEndorsement.
 *
 * @public
 */
export const getUserEndorsement: XRPCMethod<QueryParams, void, EndorsementView> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<EndorsementView>> => {
    const logger = c.get('logger');
    const reviewService = c.get('services').review;

    logger.debug('Getting user endorsement', {
      eprintUri: params.eprintUri,
      userDid: params.userDid,
    });

    // Get user's endorsement from ReviewService
    const endorsement = await reviewService.getEndorsementByUser(
      params.eprintUri as AtUri,
      params.userDid as DID
    );

    if (!endorsement) {
      throw new NotFoundError('Endorsement', `user=${params.userDid}, eprint=${params.eprintUri}`);
    }

    // Map to API format using generated types
    const response: EndorsementView = {
      uri: endorsement.uri,
      cid: (endorsement as { cid?: string }).cid ?? 'placeholder', // CID from endorsement record
      eprintUri: endorsement.eprintUri,
      endorser: {
        did: endorsement.endorser,
        handle: 'unknown', // Handle would need to be resolved via DID
      },
      contributions: [...endorsement.contributions],
      comment: endorsement.comment,
      createdAt: endorsement.createdAt.toISOString(),
    };

    logger.info('User endorsement returned', {
      eprintUri: params.eprintUri,
      userDid: params.userDid,
      uri: response.uri,
    });

    return { encoding: 'application/json', body: response };
  },
};
