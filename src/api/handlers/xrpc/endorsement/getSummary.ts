/**
 * XRPC handler for pub.chive.endorsement.getSummary.
 *
 * @remarks
 * Gets endorsement summary (counts by type) for a eprint.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import {
  getEndorsementSummaryParamsSchema,
  endorsementSummarySchema,
  type GetEndorsementSummaryParams,
  type EndorsementSummary,
} from '../../../schemas/endorsement.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.endorsement.getSummary query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Endorsement summary
 *
 * @public
 */
export async function getSummaryHandler(
  c: Context<ChiveEnv>,
  params: GetEndorsementSummaryParams
): Promise<EndorsementSummary> {
  const logger = c.get('logger');
  const reviewService = c.get('services').review;

  logger.debug('Getting endorsement summary', {
    eprintUri: params.eprintUri,
  });

  // Get summary from ReviewService
  const summary = await reviewService.getEndorsementSummary(params.eprintUri as AtUri);

  // Map to API format
  const response: EndorsementSummary = {
    total: summary.total,
    endorserCount: summary.endorserCount,
    byType: summary.byType,
  };

  logger.info('Endorsement summary returned', {
    eprintUri: params.eprintUri,
    total: response.total,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.endorsement.getSummary.
 *
 * @public
 */
export const getSummaryEndpoint: XRPCEndpoint<GetEndorsementSummaryParams, EndorsementSummary> = {
  method: 'pub.chive.endorsement.getSummary' as never,
  type: 'query',
  description: 'Get endorsement summary for a eprint',
  inputSchema: getEndorsementSummaryParamsSchema,
  outputSchema: endorsementSummarySchema,
  handler: getSummaryHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
