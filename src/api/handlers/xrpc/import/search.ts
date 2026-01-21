/**
 * Handler for pub.chive.import.search.
 *
 * @remarks
 * Searches imported eprints in the AppView cache.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/import/search.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Search imported eprints.
 *
 * @public
 */
export const search: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { import: importService } = c.get('services');

    logger.debug('Searching imports', {
      query: params.query,
      source: params.source,
      claimStatus: params.claimStatus,
    });

    // Cast lexicon type to service type (lexicon uses (string & {}) for extensibility)
    type ServiceClaimStatus = 'unclaimed' | 'pending' | 'claimed';

    const result = await importService.search({
      query: params.query,
      source: params.source,
      claimStatus: params.claimStatus as ServiceClaimStatus | undefined,
      authorName: params.authorName,
      authorOrcid: params.authorOrcid,
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
      },
    };
  },
};
