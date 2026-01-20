/**
 * XRPC handler for pub.chive.endorsement.listForEprint.
 *
 * @remarks
 * Lists endorsements for a specific eprint.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import {
  listEndorsementsForEprintParamsSchema,
  endorsementsResponseSchema,
  type ListEndorsementsForEprintParams,
  type EndorsementsResponse,
} from '../../../schemas/endorsement.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.endorsement.listForEprint query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Paginated list of endorsements
 *
 * @public
 */
export async function listForEprintHandler(
  c: Context<ChiveEnv>,
  params: ListEndorsementsForEprintParams
): Promise<EndorsementsResponse> {
  const logger = c.get('logger');
  const reviewService = c.get('services').review;

  logger.debug('Listing endorsements for eprint', {
    eprintUri: params.eprintUri,
    contributionType: params.contributionType,
    limit: params.limit,
    cursor: params.cursor,
  });

  // Get paginated endorsements from service
  const result = await reviewService.listEndorsementsForEprint(params.eprintUri as AtUri, {
    limit: params.limit,
    cursor: params.cursor,
  });

  // Get summary for this eprint
  const summary = await reviewService.getEndorsementSummary(params.eprintUri as AtUri);

  // Map service results to API format (contributions now comes directly from service)
  let endorsements = result.items.map((item) => ({
    uri: item.uri,
    eprintUri: item.eprintUri,
    endorser: {
      did: item.endorser,
      handle: 'unknown', // Handle would need to be resolved via DID
    },
    contributions: item.contributions as string[],
    comment: item.comment,
    createdAt: item.createdAt.toISOString(),
  }));

  // Filter by contribution type if specified
  if (params.contributionType) {
    endorsements = endorsements.filter((e) =>
      e.contributions.includes(params.contributionType as never)
    );
  }

  const response: EndorsementsResponse = {
    endorsements,
    summary: {
      total: summary.total,
      endorserCount: summary.endorserCount,
      byType: summary.byType,
    },
    cursor: result.cursor,
    hasMore: result.hasMore,
    total: result.total,
  };

  logger.info('Endorsements listed for eprint', {
    eprintUri: params.eprintUri,
    count: response.endorsements.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.endorsement.listForEprint.
 *
 * @public
 */
export const listForEprintEndpoint: XRPCEndpoint<
  ListEndorsementsForEprintParams,
  EndorsementsResponse
> = {
  method: 'pub.chive.endorsement.listForEprint' as never,
  type: 'query',
  description: 'List endorsements for an eprint',
  inputSchema: listEndorsementsForEprintParamsSchema,
  outputSchema: endorsementsResponseSchema,
  handler: listForEprintHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
