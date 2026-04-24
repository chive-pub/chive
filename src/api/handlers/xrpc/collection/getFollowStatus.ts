/**
 * XRPC handler for pub.chive.collection.getFollowStatus.
 *
 * @remarks
 * Checks if a user follows a collection via network.cosmik.follow.
 * Returns the follow record URI if following, empty string otherwise.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/getFollowStatus.js';
import type { DID } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/** Re-exported query parameters. */
export type GetFollowStatusParams = QueryParams;

/** Re-exported output schema. */
export type GetFollowStatusOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.getFollowStatus query.
 *
 * @public
 */
export const getFollowStatus: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');

    if (!params.followerDid || !params.subject) {
      throw new ValidationError('Missing required parameters: followerDid, subject', 'params');
    }

    if (!collectionService) {
      return { encoding: 'application/json', body: { followUri: '' } };
    }

    const followUri = await collectionService.getFollowStatus(
      params.followerDid as DID,
      params.subject
    );

    logger.debug('Follow status checked', {
      followerDid: params.followerDid,
      subject: params.subject,
      isFollowing: !!followUri,
    });

    return {
      encoding: 'application/json',
      body: { followUri: followUri ?? '' },
    };
  },
};
