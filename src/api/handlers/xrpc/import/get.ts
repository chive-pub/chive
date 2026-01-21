/**
 * Handler for pub.chive.import.get.
 *
 * @remarks
 * Gets an imported eprint by source and external ID.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/import/get.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Get an imported eprint by source and external ID.
 *
 * @public
 */
export const get: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { import: importService } = c.get('services');

    logger.debug('Getting import', { source: params.source, externalId: params.externalId });

    const result = await importService.get(params.source, params.externalId);

    if (!result) {
      throw new NotFoundError('ImportedEprint', `${params.source}:${params.externalId}`);
    }

    return {
      encoding: 'application/json',
      body: {
        id: result.id,
        source: result.source,
        externalId: result.externalId,
        url: result.url,
        title: result.title,
        abstract: result.abstract,
        authors: result.authors.map((a) => ({
          name: a.name,
          orcid: a.orcid,
          affiliation: a.affiliation,
          email: a.email,
        })),
        publicationDate: result.publicationDate?.toISOString(),
        categories: result.categories as string[] | undefined,
        doi: result.doi,
        pdfUrl: result.pdfUrl,
        importedByPlugin: result.importedByPlugin,
        importedAt: result.importedAt.toISOString(),
        lastSyncedAt: result.lastSyncedAt?.toISOString(),
        syncStatus: result.syncStatus,
        claimStatus: result.claimStatus,
        canonicalUri: result.canonicalUri,
        claimedByDid: result.claimedByDid,
        claimedAt: result.claimedAt?.toISOString(),
      },
    };
  },
};
