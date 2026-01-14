/**
 * XRPC handler for pub.chive.notification.listEndorsementsOnMyPapers.
 *
 * @remarks
 * Lists endorsements on papers where the authenticated user is an author.
 * Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  listEndorsementNotificationsParamsSchema,
  endorsementNotificationsResponseSchema,
  type ListEndorsementNotificationsParams,
  type EndorsementNotificationsResponse,
} from '../../../schemas/notification.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.notification.listEndorsementsOnMyPapers query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Paginated list of endorsement notifications
 *
 * @public
 */
export async function listEndorsementsOnMyPapersHandler(
  c: Context<ChiveEnv>,
  params: ListEndorsementNotificationsParams
): Promise<EndorsementNotificationsResponse> {
  const logger = c.get('logger');
  const reviewService = c.get('services').review;
  const user = c.get('user');

  if (!user?.did) {
    throw new Error('Authentication required');
  }

  logger.debug('Listing endorsement notifications for author', {
    authorDid: user.did,
    limit: params.limit,
    cursor: params.cursor,
  });

  const result = await reviewService.listEndorsementsOnAuthorPapers(user.did, {
    limit: params.limit,
    cursor: params.cursor,
  });

  const response: EndorsementNotificationsResponse = {
    notifications: result.items.map((item) => ({
      uri: item.uri,
      endorserDid: item.endorserDid,
      endorserHandle: item.endorserHandle,
      endorserDisplayName: item.endorserDisplayName,
      eprintUri: item.eprintUri,
      eprintTitle: item.eprintTitle,
      endorsementType: item.endorsementType,
      comment: item.comment,
      createdAt: item.createdAt.toISOString(),
    })),
    cursor: result.cursor,
    hasMore: result.hasMore,
    total: result.total,
  };

  logger.info('Endorsement notifications listed', {
    authorDid: user.did,
    count: response.notifications.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.notification.listEndorsementsOnMyPapers.
 *
 * @public
 */
export const listEndorsementsOnMyPapersEndpoint: XRPCEndpoint<
  ListEndorsementNotificationsParams,
  EndorsementNotificationsResponse
> = {
  method: 'pub.chive.notification.listEndorsementsOnMyPapers' as never,
  type: 'query',
  description: 'List endorsements on papers where authenticated user is an author',
  inputSchema: listEndorsementNotificationsParamsSchema,
  outputSchema: endorsementNotificationsResponseSchema,
  handler: listEndorsementsOnMyPapersHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
