/**
 * Handler for pub.chive.activity.getFeed.
 *
 * @remarks
 * Gets the authenticated user's activity feed with pagination.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  getActivityFeedParamsSchema,
  getActivityFeedResponseSchema,
  type GetActivityFeedParams,
  type GetActivityFeedResponse,
} from '../../../schemas/activity.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.activity.getFeed.
 *
 * @param c - Hono context
 * @param params - Query parameters
 * @returns Activity feed with pagination
 *
 * @public
 */
export async function getActivityFeedHandler(
  c: Context<ChiveEnv>,
  params: GetActivityFeedParams
): Promise<GetActivityFeedResponse> {
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
    category: params.category,
    status: params.status,
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
    confirmedAt: a.confirmedAt?.toISOString() ?? null,
    firehoseUri: a.firehoseUri,
    firehoseCid: a.firehoseCid,
    targetUri: a.targetUri,
    targetTitle: a.targetTitle,
    latencyMs:
      a.confirmedAt && a.initiatedAt ? a.confirmedAt.getTime() - a.initiatedAt.getTime() : null,
    errorCode: a.errorCode,
    errorMessage: a.errorMessage,
  }));

  return {
    activities: mappedActivities,
    cursor,
    hasMore: cursor !== null,
  };
}

/**
 * Endpoint definition for pub.chive.activity.getFeed.
 *
 * @public
 */
export const getActivityFeedEndpoint: XRPCEndpoint<GetActivityFeedParams, GetActivityFeedResponse> =
  {
    method: 'pub.chive.activity.getFeed' as never,
    type: 'query',
    description: "Get the authenticated user's activity feed",
    inputSchema: getActivityFeedParamsSchema,
    outputSchema: getActivityFeedResponseSchema,
    handler: getActivityFeedHandler,
    auth: 'required',
    rateLimit: 'authenticated',
  };
