/**
 * Handler for pub.chive.activity.getFeed.
 *
 * @remarks
 * Gets the authenticated user's activity feed with pagination.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/activity/getFeed.js';
import type {
  ActivityCategory,
  ActivityStatus,
} from '../../../../services/activity/activity-service.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.activity.getFeed.
 *
 * @public
 */
export const getActivityFeed: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { activity } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    logger.debug('Getting activity feed', {
      actorDid: user.did,
      category: params.category,
      status: params.status,
      limit: params.limit,
    });

    const result = await activity.getActivityFeed({
      actorDid: user.did,
      category: params.category as ActivityCategory | undefined,
      status: params.status as ActivityStatus | undefined,
      limit: params.limit,
      cursor: params.cursor,
    });

    if (!result.ok) {
      throw result.error;
    }

    const { activities, cursor } = result.value;

    // Map to response format
    const mappedActivities = activities.map((a) => ({
      id: a.id,
      actorDid: a.actorDid,
      collection: a.collection,
      rkey: a.rkey,
      action: a.action,
      category: a.category,
      status: a.status,
      initiatedAt: a.initiatedAt.toISOString(),
      confirmedAt: a.confirmedAt?.toISOString(),
      firehoseUri: a.firehoseUri ?? undefined,
      firehoseCid: a.firehoseCid ?? undefined,
      targetUri: a.targetUri ?? undefined,
      targetTitle: a.targetTitle ?? undefined,
      latencyMs:
        a.confirmedAt && a.initiatedAt
          ? a.confirmedAt.getTime() - a.initiatedAt.getTime()
          : undefined,
      errorCode: a.errorCode ?? undefined,
      errorMessage: a.errorMessage ?? undefined,
    }));

    return {
      encoding: 'application/json',
      body: {
        activities: mappedActivities,
        cursor: cursor ?? undefined,
        hasMore: cursor !== null,
      },
    };
  },
};
