/**
 * Handler for pub.chive.claiming.findClaimable.
 *
 * @remarks
 * Finds claimable eprints matching the user's identity.
 * Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/claiming/findClaimable.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.findClaimable.
 *
 * @public
 */
export const findClaimable: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const { claiming } = c.get('services');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    logger.debug('Finding claimable eprints', {
      q: params.q,
      source: params.source,
      claimantDid: user.did,
    });

    const result = await claiming.findClaimable({
      q: params.q,
      source: params.source as
        | 'arxiv'
        | 'biorxiv'
        | 'medrxiv'
        | 'osf'
        | 'lingbuzz'
        | 'zenodo'
        | 'ssrn'
        | 'philpapers'
        | undefined,
      limit: params.limit ?? 50,
      cursor: params.cursor,
    });

    return {
      encoding: 'application/json',
      body: {
        eprints: result.eprints.map((p) => ({
          id: p.id,
          source: p.source,
          externalId: p.externalId,
          url: p.url,
          title: p.title,
          authors: p.authors.map((a) => ({
            name: a.name,
            orcid: a.orcid,
            affiliation: a.affiliation,
          })),
          publicationDate: p.publicationDate?.toISOString(),
          doi: p.doi,
        })),
        cursor: result.cursor,
        hasMore: result.cursor !== undefined,
      },
    };
  },
};
