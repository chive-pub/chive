/**
 * Handler for pub.chive.claiming.searchEprints.
 *
 * @remarks
 * Searches external eprint sources for papers to claim.
 * Performs federated search across all SearchablePlugin instances.
 * Includes duplicate detection to warn users if a paper already exists on Chive.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  ExistingChivePaper,
} from '../../../../lexicons/generated/types/pub/chive/claiming/searchEprints.js';
import type { ImportSource } from '../../../../types/interfaces/plugin.interface.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.searchEprints.
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
export const searchEprints: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { claiming, eprint } = c.get('services');

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
    for (const result of results) {
      const source = result.source;
      sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
    }

    // Map to response format with duplicate detection
    const eprints = await Promise.all(
      results.map(async (p) => {
        // Check for existing Chive paper (duplicate detection)
        let existingChivePaper: ExistingChivePaper | undefined;

        try {
          const existing = await eprint.findByExternalIds({
            doi: p.doi,
            arxivId: p.source === 'arxiv' ? p.externalId : undefined,
            semanticScholarId: p.source === 'semanticscholar' ? p.externalId : undefined,
            openAlexId: p.source === 'openalex' ? p.externalId : undefined,
            dblpId: p.source === 'dblp' ? p.externalId : undefined,
            openReviewId: p.source === 'openreview' ? p.externalId : undefined,
            pmid: p.source === 'pubmed' ? p.externalId : undefined,
            ssrnId: p.source === 'ssrn' ? p.externalId : undefined,
          });

          if (existing) {
            existingChivePaper = {
              uri: existing.uri,
              title: existing.title,
              authors: existing.authors.map((a) => ({
                did: a.did,
                name: a.name,
              })),
              createdAt: existing.createdAt.toISOString(),
            };
          }
        } catch (err) {
          logger.warn('Error checking for duplicate paper', {
            externalId: p.externalId,
            error: err instanceof Error ? err.message : String(err),
          });
          // Continue without duplicate detection
        }

        return {
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
          existingChivePaper,
        };
      })
    );

    const duplicateCount = eprints.filter((e) => e.existingChivePaper).length;

    logger.info('External search completed', {
      query: params.query,
      resultCount: eprints.length,
      sourceCount: Object.keys(sourceCounts).length,
      duplicateCount,
    });

    return {
      encoding: 'application/json',
      body: {
        eprints,
        facets: {
          sources: sourceCounts,
        },
      },
    };
  },
};
