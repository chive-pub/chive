/**
 * Handler for pub.chive.discovery.getCitations.
 *
 * @remarks
 * Returns citation network data for a eprint, including papers that
 * cite it and papers it references (within the Chive index).
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError, ServiceUnavailableError } from '../../../../types/errors.js';
import {
  getCitationsParamsSchema,
  getCitationsResponseSchema,
  type GetCitationsParams,
  type GetCitationsResponse,
} from '../../../schemas/discovery.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.discovery.getCitations.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Citation network data with counts and relationships
 *
 * @remarks
 * Returns only citations between Chive-indexed eprints.
 * External citations are reflected in counts but not in the citations array.
 *
 * Citation data is enriched from Semantic Scholar and OpenAlex,
 * including influential citation markers.
 *
 * @public
 */
export async function getCitationsHandler(
  c: Context<ChiveEnv>,
  params: GetCitationsParams
): Promise<GetCitationsResponse> {
  const logger = c.get('logger');
  const { discovery, eprint } = c.get('services');

  logger.debug('Getting citations', {
    uri: params.uri,
    direction: params.direction,
    limit: params.limit,
  });

  if (!discovery) {
    throw new ServiceUnavailableError('Discovery service not available');
  }

  // Get the source eprint
  const sourceEprint = await eprint.getEprint(params.uri as AtUri);
  if (!sourceEprint) {
    throw new NotFoundError('Eprint not found', params.uri);
  }

  // Get citation counts
  const counts = await discovery.getCitationCounts(params.uri as AtUri);

  // Get citations based on direction
  let citations: GetCitationsResponse['citations'] = [];
  let hasMore = false;
  let cursor: string | undefined;

  if (params.direction === 'citing' || params.direction === 'both') {
    const citingResult = await discovery.getCitingPapers(params.uri as AtUri, {
      limit: params.limit,
      cursor: params.cursor,
      onlyInfluential: params.onlyInfluential,
    });
    citations = citations.concat(
      citingResult.citations.map((c) => ({
        citingUri: c.citingUri as string,
        citedUri: c.citedUri as string,
        isInfluential: c.isInfluential,
        source: c.source,
        discoveredAt: c.discoveredAt?.toISOString(),
      }))
    );
    hasMore = citingResult.hasMore;
    cursor = citingResult.cursor;
  }

  if (params.direction === 'cited-by' || params.direction === 'both') {
    const referencesResult = await discovery.getReferences(params.uri as AtUri, {
      limit: params.limit,
      cursor: params.cursor,
    });
    citations = citations.concat(
      referencesResult.citations.map((c) => ({
        citingUri: c.citingUri as string,
        citedUri: c.citedUri as string,
        isInfluential: c.isInfluential,
        source: c.source,
        discoveredAt: c.discoveredAt?.toISOString(),
      }))
    );
    if (params.direction === 'cited-by') {
      hasMore = referencesResult.hasMore;
      cursor = referencesResult.cursor;
    }
  }

  logger.info('Citations returned', {
    uri: params.uri,
    citedByCount: counts.citedByCount,
    referencesCount: counts.referencesCount,
    returnedCount: citations.length,
  });

  return {
    eprint: {
      uri: params.uri,
      title: sourceEprint.title,
    },
    counts: {
      citedByCount: counts.citedByCount,
      referencesCount: counts.referencesCount,
      influentialCitedByCount: counts.influentialCitedByCount,
    },
    citations,
    cursor,
    hasMore,
  };
}

/**
 * Endpoint definition for pub.chive.discovery.getCitations.
 *
 * @public
 */
export const getCitationsEndpoint: XRPCEndpoint<GetCitationsParams, GetCitationsResponse> = {
  method: 'pub.chive.discovery.getCitations' as never,
  type: 'query',
  description: 'Get citation network for a eprint',
  inputSchema: getCitationsParamsSchema,
  outputSchema: getCitationsResponseSchema,
  handler: getCitationsHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
