/**
 * XRPC handler for pub.chive.endorsement.listForUser.
 *
 * @remarks
 * Lists endorsements given by a specific user.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/endorsement/listForUser.js';
import type { DID } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.endorsement.listForUser.
 *
 * @public
 */
export const listForUser: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { review, eprint } = c.get('services');

    logger.debug('Listing endorsements for user', {
      endorserDid: params.endorserDid,
      contributionType: params.contributionType,
      limit: params.limit,
      cursor: params.cursor,
    });

    // Get paginated endorsements from service
    const result = await review.listEndorsementsByUser(params.endorserDid as DID, {
      limit: params.limit,
      cursor: params.cursor,
    });

    // Fetch eprint titles for each endorsement
    const endorsementsWithTitles = await Promise.all(
      result.items.map(async (item) => {
        let eprintTitle: string | undefined;
        try {
          const eprintData = await eprint.getEprint(item.eprintUri);
          eprintTitle = eprintData?.title;
        } catch {
          // Eprint may have been deleted
        }

        return {
          uri: item.uri,
          cid: 'placeholder', // CID not stored in index
          eprintUri: item.eprintUri,
          eprintTitle,
          endorser: {
            did: item.endorser,
            handle: 'unknown', // Handle would need DID resolution
          },
          contributions: [...item.contributions],
          comment: item.comment,
          createdAt: item.createdAt.toISOString(),
        };
      })
    );

    // Filter by contribution type if specified
    let endorsements = endorsementsWithTitles;
    if (params.contributionType) {
      endorsements = endorsements.filter((e) =>
        e.contributions.includes(params.contributionType as string)
      );
    }

    const response: OutputSchema = {
      endorsements,
      cursor: result.cursor,
      hasMore: result.hasMore,
      total: result.total,
    };

    logger.info('Endorsements listed for user', {
      endorserDid: params.endorserDid,
      count: response.endorsements.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
