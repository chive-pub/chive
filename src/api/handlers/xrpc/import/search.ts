/**
 * Handler for pub.chive.import.search.
 *
 * @remarks
 * Searches imported eprints in the AppView cache.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  searchImportsParamsSchema,
  searchImportsResponseSchema,
  type SearchImportsParams,
  type SearchImportsResponse,
} from '../../../schemas/import.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.import.search.
 *
 * @param c - Hono context
 * @param params - Search parameters
 * @returns Matching imported eprints
 *
 * @public
 */
export async function searchImportsHandler(
  c: Context<ChiveEnv>,
  params: SearchImportsParams
): Promise<SearchImportsResponse> {
  const logger = c.get('logger');
  const { import: importService } = c.get('services');

  logger.debug('Searching imports', {
    query: params.query,
    source: params.source,
    claimStatus: params.claimStatus,
  });

  const result = await importService.search({
    query: params.query,
    source: params.source,
    claimStatus: params.claimStatus,
    authorName: params.authorName,
    authorOrcid: params.authorOrcid,
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
      abstract: p.abstract,
      authors: p.authors.map((a) => ({
        name: a.name,
        orcid: a.orcid,
        affiliation: a.affiliation,
        email: a.email,
      })),
      publicationDate: p.publicationDate?.toISOString(),
      categories: p.categories as string[] | undefined,
      doi: p.doi,
      pdfUrl: p.pdfUrl,
      importedByPlugin: p.importedByPlugin,
      importedAt: p.importedAt.toISOString(),
      lastSyncedAt: p.lastSyncedAt?.toISOString(),
      syncStatus: p.syncStatus,
      claimStatus: p.claimStatus,
      canonicalUri: p.canonicalUri,
      claimedByDid: p.claimedByDid,
      claimedAt: p.claimedAt?.toISOString(),
    })),
    cursor: result.cursor,
    hasMore: result.cursor !== undefined,
  };
}

/**
 * Endpoint definition for pub.chive.import.search.
 *
 * @public
 */
export const searchImportsEndpoint: XRPCEndpoint<SearchImportsParams, SearchImportsResponse> = {
  method: 'pub.chive.import.search' as never,
  type: 'query',
  description: 'Search imported eprints',
  inputSchema: searchImportsParamsSchema,
  outputSchema: searchImportsResponseSchema,
  handler: searchImportsHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
