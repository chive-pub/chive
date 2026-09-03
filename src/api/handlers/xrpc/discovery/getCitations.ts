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

    // Name both ends of every edge.
    //
    // The citation graph stores only URIs on its nodes, so an edge read back
    // from it carries nothing a reader could recognise -- which is why the
    // network rendered as boxes labelled "Citing paper 1", "Citing paper 2".
    //
    // These go in a lookup rather than on each edge: one paper is commonly at
    // the end of many of them, and repeating its author list per edge would
    // send the same names back a dozen times in one response. One query for the
    // page, not one per edge.
    const refs = await discovery.getEprintRefs(citations.flatMap((c) => [c.citingUri, c.citedUri]));

    const papers: OutputSchema['papers'] = [...refs.values()].map((ref) => ({
      uri: ref.uri,
      title: ref.title,
      authors: [...ref.authors],
      ...(ref.year !== undefined ? { year: ref.year } : {}),
      ...(ref.venue !== undefined ? { venue: ref.venue } : {}),
    }));

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
        papers,
        cursor,
        hasMore,
      },
    };
  },
};
