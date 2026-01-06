/**
 * XRPC handler for pub.chive.endorsement.listForPreprint.
 *
 * @remarks
 * Lists endorsements for a specific preprint.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import {
  listEndorsementsForPreprintParamsSchema,
  endorsementsResponseSchema,
  type ListEndorsementsForPreprintParams,
  type EndorsementsResponse,
} from '../../../schemas/endorsement.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Maps internal endorsement type to API contribution types.
 *
 * @internal
 */
function mapEndorsementTypeToContributions(
  endorsementType: 'methods' | 'results' | 'overall'
): ('methodological' | 'analytical' | 'theoretical' | 'empirical' | 'conceptual')[] {
  switch (endorsementType) {
    case 'methods':
      return ['methodological'];
    case 'results':
      return ['empirical'];
    case 'overall':
      return ['conceptual'];
    default:
      return ['conceptual'];
  }
}

/**
 * Handler for pub.chive.endorsement.listForPreprint query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Paginated list of endorsements
 *
 * @public
 */
export async function listForPreprintHandler(
  c: Context<ChiveEnv>,
  params: ListEndorsementsForPreprintParams
): Promise<EndorsementsResponse> {
  const logger = c.get('logger');
  const reviewService = c.get('services').review;

  logger.debug('Listing endorsements for preprint', {
    preprintUri: params.preprintUri,
    contributionType: params.contributionType,
    limit: params.limit,
    cursor: params.cursor,
  });

  // Get paginated endorsements from service
  const result = await reviewService.listEndorsementsForPreprint(params.preprintUri as AtUri, {
    limit: params.limit,
    cursor: params.cursor,
  });

  // Get summary for this preprint
  const summary = await reviewService.getEndorsementSummary(params.preprintUri as AtUri);

  // Map service results to API format
  let endorsements = result.items.map((item) => ({
    uri: item.uri,
    preprintUri: item.preprintUri,
    endorser: {
      did: item.endorser,
      handle: 'unknown', // Handle would need to be resolved via DID
    },
    contributions: mapEndorsementTypeToContributions(item.endorsementType),
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

  logger.info('Endorsements listed for preprint', {
    preprintUri: params.preprintUri,
    count: response.endorsements.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.endorsement.listForPreprint.
 *
 * @public
 */
export const listForPreprintEndpoint: XRPCEndpoint<
  ListEndorsementsForPreprintParams,
  EndorsementsResponse
> = {
  method: 'pub.chive.endorsement.listForPreprint' as never,
  type: 'query',
  description: 'List endorsements for a preprint',
  inputSchema: listEndorsementsForPreprintParamsSchema,
  outputSchema: endorsementsResponseSchema,
  handler: listForPreprintHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
