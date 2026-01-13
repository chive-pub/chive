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

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  findClaimableParamsSchema,
  findClaimableResponseSchema,
  type FindClaimableParams,
  type FindClaimableResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.findClaimable.
 *
 * @param c - Hono context
 * @param params - Search parameters
 * @returns Claimable eprints
 *
 * @public
 */
export async function findClaimableHandler(
  c: Context<ChiveEnv>,
  params: FindClaimableParams
): Promise<FindClaimableResponse> {
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
  };
}

/**
 * Endpoint definition for pub.chive.claiming.findClaimable.
 *
 * @public
 */
export const findClaimableEndpoint: XRPCEndpoint<FindClaimableParams, FindClaimableResponse> = {
  method: 'pub.chive.claiming.findClaimable' as never,
  type: 'query',
  description: 'Find claimable eprints matching identity',
  inputSchema: findClaimableParamsSchema,
  outputSchema: findClaimableResponseSchema,
  handler: findClaimableHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
