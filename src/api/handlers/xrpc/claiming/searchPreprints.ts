/**
 * Handler for pub.chive.claiming.searchEprints.
 *
 * @remarks
 * Searches external eprint sources for papers to claim.
 * Performs federated search across all SearchablePlugin instances.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { ImportSource } from '../../../../types/interfaces/plugin.interface.js';
import {
  searchEprintsParamsSchema,
  searchEprintsResponseSchema,
  type SearchEprintsParams,
  type SearchEprintsResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.searchEprints.
 *
 * @param c - Hono context
 * @param params - Search parameters
 * @returns External eprints matching query
 *
 * @remarks
 * Searches are performed across multiple external sources in parallel.
 * Non-searchable sources (LingBuzz, Semantics Archive) are searched
 * from the local import database.
 *
 * Results include source facets for filtering UI.
 *
 * @public
 */
export async function searchEprintsHandler(
  c: Context<ChiveEnv>,
  params: SearchEprintsParams
): Promise<SearchEprintsResponse> {
  const logger = c.get('logger');
  const { claiming } = c.get('services');

  logger.debug('Searching external eprints', {
    query: params.query,
    author: params.author,
    sources: params.sources,
    limit: params.limit,
  });

  // Parse sources filter
  const sourcesFilter: ImportSource[] | undefined = params.sources
    ? params.sources.split(',').map((s) => s.trim())
    : undefined;

  // Perform federated search
  const results = await claiming.searchAllSources({
    query: params.query,
    author: params.author,
    sources: sourcesFilter,
    limit: params.limit ?? 20,
  });

  // Build facets (result counts by source)
  const sourceCounts: Record<string, number> = {};
  for (const eprint of results) {
    const source = eprint.source;
    sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
  }

  // Map to response format
  const eprints = results.map((p) => ({
    externalId: p.externalId,
    url: p.url,
    title: p.title,
    abstract: p.abstract,
    authors: p.authors.map((a) => ({
      name: a.name,
      orcid: a.orcid,
      affiliation: a.affiliation,
      email: a.email,
    })),
    publicationDate: p.publicationDate?.toISOString(),
    doi: p.doi,
    pdfUrl: p.pdfUrl,
    categories: p.categories ? [...p.categories] : undefined,
    source: p.source,
  }));

  logger.info('External search completed', {
    query: params.query,
    resultCount: eprints.length,
    sourceCount: Object.keys(sourceCounts).length,
  });

  return {
    eprints,
    facets: {
      sources: sourceCounts,
    },
  };
}

/**
 * Endpoint definition for pub.chive.claiming.searchEprints.
 *
 * @public
 */
export const searchEprintsEndpoint: XRPCEndpoint<SearchEprintsParams, SearchEprintsResponse> =
  {
    method: 'pub.chive.claiming.searchEprints' as never,
    type: 'query',
    description: 'Search external eprint sources for papers to claim',
    inputSchema: searchEprintsParamsSchema,
    outputSchema: searchEprintsResponseSchema,
    handler: searchEprintsHandler,
    auth: 'optional',
    rateLimit: 'anonymous',
  };
