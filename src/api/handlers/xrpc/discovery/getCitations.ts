/**
 * XRPC method for pub.chive.discovery.getCitations.
 *
 * @remarks
 * Returns citation network data for an eprint, including papers that
 * cite it and papers it references (within the Chive index).
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/discovery/getCitations.js';
import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError, ServiceUnavailableError } from '../../../../types/errors.js';
// Use generated types from lexicons
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.discovery.getCitations.
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
export const getCitations: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
      throw new NotFoundError('Eprint', params.uri);
    }

    // Get citation counts
    const counts = await discovery.getCitationCounts(params.uri as AtUri);

    // Get citations based on direction
    let citations: OutputSchema['citations'] = [];
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
      encoding: 'application/json',
      body: {
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
      },
    };
  },
};
