/**
 * XRPC method for pub.chive.discovery.getCitationNetwork.
 *
 * @remarks
 * Returns the citation graph between Chive-indexed eprints as a graph, rather
 * than as one paper's neighbours.
 *
 * `getCitations` beside this answers "who cites this paper", and cannot answer
 * anything else: every edge it returns touches the paper asked about, so a view
 * built on it draws a star and calls it a network. Reading the graph whole is
 * what lets a reader see where a paper sits among the others -- which papers
 * its citers also cite, which clusters it belongs to, and what surrounds it.
 *
 * Only Chive-to-Chive citations exist here. A reference to a work Chive does
 * not hold has nowhere to point, and the counts on `getCitations` remain the
 * place where external citations are reflected.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/discovery/getCitationNetwork.js';
import type { AtUri } from '../../../../types/atproto.js';
import { ServiceUnavailableError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.discovery.getCitationNetwork.
 *
 * @public
 */
export const getCitationNetwork: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { discovery } = c.get('services');

    if (!discovery) {
      throw new ServiceUnavailableError('Discovery service not available');
    }

    const network = await discovery.getCitationNetwork({
      ...(params.uri ? { focusUri: params.uri as AtUri } : {}),
      ...(params.limit !== undefined ? { limit: params.limit } : {}),
      ...(params.onlyInfluential !== undefined ? { onlyInfluential: params.onlyInfluential } : {}),
    });

    // Name both ends of every edge. The graph stores only URIs on its nodes, so
    // an edge read back from it carries nothing a reader could recognise -- the
    // reason the old network rendered boxes labelled "Citing paper 1".
    //
    // One lookup for the page rather than one per edge: in a network a paper is
    // commonly at the end of many edges, and repeating its author list on each
    // would send the same names back dozens of times.
    const refs = await discovery.getEprintRefs(
      network.citations.flatMap((citation) => [citation.citingUri, citation.citedUri])
    );

    const papers: OutputSchema['papers'] = [...refs.values()].map((ref) => ({
      uri: ref.uri,
      title: ref.title,
      authors: [...ref.authors],
      ...(ref.year !== undefined ? { year: ref.year } : {}),
      ...(ref.venue !== undefined ? { venue: ref.venue } : {}),
      ...(ref.doi !== undefined ? { doi: ref.doi } : {}),
    }));

    // The focus is echoed only when it is actually in the network. A paper with
    // no citations either way is absent from the graph, and saying otherwise
    // would have the client draw a focused node with nothing attached to it and
    // no way to tell that apart from a load that went wrong.
    const focusPresent =
      params.uri !== undefined &&
      network.citations.some(
        (citation) => citation.citingUri === params.uri || citation.citedUri === params.uri
      );

    logger.info('Citation network returned', {
      focusUri: params.uri,
      edges: network.citations.length,
      papers: papers.length,
      total: network.total,
      truncated: network.truncated,
    });

    return {
      encoding: 'application/json',
      body: {
        ...(focusPresent ? { focusUri: params.uri } : {}),
        papers,
        citations: network.citations.map((citation) => ({
          citingUri: citation.citingUri as string,
          citedUri: citation.citedUri as string,
          ...(citation.isInfluential !== undefined
            ? { isInfluential: citation.isInfluential }
            : {}),
        })),
        truncated: network.truncated,
        totalCitations: network.total,
      },
    };
  },
};
