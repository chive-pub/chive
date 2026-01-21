/**
 * XRPC handler for pub.chive.endorsement.getSummary.
 *
 * @remarks
 * Gets endorsement summary (counts by type) for an eprint.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/endorsement/getSummary.js';
import type { AtUri } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

// Use generated types from lexicons

/**
 * XRPC method for pub.chive.endorsement.getSummary.
 *
 * @public
 */
export const getSummary: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const reviewService = c.get('services').review;

    logger.debug('Getting endorsement summary', {
      eprintUri: params.eprintUri,
    });

    // Get summary from ReviewService
    const summary = await reviewService.getEndorsementSummary(params.eprintUri as AtUri);

    // Map to API format
    const response: OutputSchema = {
      total: summary.total,
      endorserCount: summary.endorserCount,
      byType: summary.byType,
    };

    logger.info('Endorsement summary returned', {
      eprintUri: params.eprintUri,
      total: response.total,
    });

    return { encoding: 'application/json', body: response };
  },
};
