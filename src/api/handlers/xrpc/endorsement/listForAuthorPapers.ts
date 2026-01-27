/**
 * XRPC handler for pub.chive.endorsement.listForAuthorPapers.
 *
 * @remarks
 * Lists endorsements received on an author's papers.
 * This is a public endpoint for displaying on author profile pages.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/endorsement/listForAuthorPapers.js';
import type { DID } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.endorsement.listForAuthorPapers.
 *
 * @public
 */
export const listForAuthorPapers: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const reviewService = c.get('services').review;

    logger.debug('Listing endorsements on author papers', {
      authorDid: params.authorDid,
      limit: params.limit,
      cursor: params.cursor,
    });

    // Get paginated endorsements from service
    const result = await reviewService.listEndorsementsOnAuthorPapers(params.authorDid as DID, {
      limit: params.limit,
      cursor: params.cursor,
    });

    // Map service results to API format
    const endorsements = result.items.map((item) => ({
      uri: item.uri,
      cid: 'placeholder', // CID not stored in index
      eprintUri: item.eprintUri,
      eprintTitle: item.eprintTitle,
      endorser: {
        did: item.endorserDid,
        handle: item.endorserHandle,
        displayName: item.endorserDisplayName,
      },
      contributions: [...item.contributions],
      comment: item.comment,
      createdAt: item.createdAt.toISOString(),
    }));

    const response: OutputSchema = {
      endorsements,
      cursor: result.cursor,
      hasMore: result.hasMore,
      total: result.total,
    };

    logger.info('Endorsements on author papers listed', {
      authorDid: params.authorDid,
      count: response.endorsements.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
