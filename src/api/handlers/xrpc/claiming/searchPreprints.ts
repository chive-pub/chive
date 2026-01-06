/**
 * Handler for pub.chive.claiming.searchPreprints.
 *
 * @remarks
 * Searches external preprint sources for papers to claim.
 * Performs federated search across all SearchablePlugin instances.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { ImportSource } from '../../../../types/interfaces/plugin.interface.js';
import {
  searchPreprintsParamsSchema,
  searchPreprintsResponseSchema,
  type SearchPreprintsParams,
  type SearchPreprintsResponse,
} from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.claiming.searchPreprints.
 *
 * @param c - Hono context
 * @param params - Search parameters
 * @returns External preprints matching query
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
export async function searchPreprintsHandler(
  c: Context<ChiveEnv>,
  params: SearchPreprintsParams
): Promise<SearchPreprintsResponse> {
  const logger = c.get('logger');
  const { claiming } = c.get('services');

  logger.debug('Searching external preprints', {
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
  for (const preprint of results) {
    const source = preprint.source;
    sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
  }

  // Map to response format
  const preprints = results.map((p) => ({
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
    resultCount: preprints.length,
    sourceCount: Object.keys(sourceCounts).length,
  });

  return {
    preprints,
    facets: {
      sources: sourceCounts,
    },
  };
}

/**
 * Endpoint definition for pub.chive.claiming.searchPreprints.
 *
 * @public
 */
export const searchPreprintsEndpoint: XRPCEndpoint<SearchPreprintsParams, SearchPreprintsResponse> =
  {
    method: 'pub.chive.claiming.searchPreprints' as never,
    type: 'query',
    description: 'Search external preprint sources for papers to claim',
    inputSchema: searchPreprintsParamsSchema,
    outputSchema: searchPreprintsResponseSchema,
    handler: searchPreprintsHandler,
    auth: 'optional',
    rateLimit: 'anonymous',
  };
