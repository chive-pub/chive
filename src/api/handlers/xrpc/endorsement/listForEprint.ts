/**
 * XRPC handler for pub.chive.endorsement.listForEprint.
 *
 * @remarks
 * Lists endorsements for a specific eprint.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/endorsement/listForEprint.js';
import type { AtUri } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

// Use generated types from lexicons

/**
 * XRPC method for pub.chive.endorsement.listForEprint.
 *
 * @public
 */
export const listForEprint: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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

    // Map service results to API format
    let endorsements = result.items.map((item) => ({
      uri: item.uri,
      cid: (item as { cid?: string }).cid ?? 'placeholder', // CID from endorsement record
      eprintUri: item.eprintUri,
      endorser: {
        did: item.endorser,
        handle: 'unknown', // Handle would need to be resolved via DID
      },
      contributions: [...item.contributions],
      comment: item.comment,
      createdAt: item.createdAt.toISOString(),
    }));

    // Filter by contribution type if specified
    if (params.contributionType) {
      endorsements = endorsements.filter((e) =>
        e.contributions.includes(params.contributionType as never)
      );
    }

    const response: OutputSchema = {
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

    return { encoding: 'application/json', body: response };
  },
};
