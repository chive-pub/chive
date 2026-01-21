/**
 * Handler for pub.chive.claiming.getSubmissionData.
 *
 * @remarks
 * Returns prefilled form data for claiming a paper from an external source.
 * This enables the new claiming flow where claiming works exactly like
 * importing an eprint, but with fields prefilled from the external source.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  ExistingChivePaper,
} from '../../../../lexicons/generated/types/pub/chive/claiming/getSubmissionData.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';
// Use generated types from lexicons

/**
 * XRPC method for pub.chive.claiming.getSubmissionData.
 *
 * @public
 */
export const getSubmissionData: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const { claiming, eprint } = c.get('services');

    logger.debug('Getting submission data for claim', {
      source: params.source,
      externalId: params.externalId,
    });

    // Fetch or import the paper from external source
    const imported = await claiming.getOrImportFromExternal(params.source, params.externalId);

    if (!imported) {
      logger.warn('Paper not found in external source', {
        source: params.source,
        externalId: params.externalId,
      });
      throw new NotFoundError('ExternalEprint', `${params.source}/${params.externalId}`);
    }

    // Check for existing Chive paper (duplicate detection)
    let existingChivePaper: ExistingChivePaper | undefined;

    try {
      const existing = await eprint.findByExternalIds({
        doi: imported.doi,
        arxivId: params.source === 'arxiv' ? params.externalId : undefined,
        semanticScholarId: params.source === 'semanticscholar' ? params.externalId : undefined,
        openAlexId: params.source === 'openalex' ? params.externalId : undefined,
        dblpId: params.source === 'dblp' ? params.externalId : undefined,
        openReviewId: params.source === 'openreview' ? params.externalId : undefined,
        pmid: params.source === 'pubmed' ? params.externalId : undefined,
        ssrnId: params.source === 'ssrn' ? params.externalId : undefined,
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

        logger.info('Found existing Chive paper (duplicate)', {
          source: params.source,
          externalId: params.externalId,
          existingUri: existing.uri,
        });
      }
    } catch (err) {
      logger.warn('Error checking for duplicate paper', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue without duplicate detection
    }

    // Build prefilled form data
    const response: OutputSchema = {
      title: imported.title,
      abstract: imported.abstract ?? '',
      authors: imported.authors.map((a, i) => ({
        order: i + 1,
        name: a.name,
        orcid: a.orcid,
        email: a.email,
        affiliation: a.affiliation,
      })),
      keywords: imported.categories ? [...imported.categories] : [],
      doi: imported.doi,
      pdfUrl: imported.pdfUrl,
      source: params.source,
      externalId: params.externalId,
      externalUrl: imported.url,
      publicationDate: imported.publicationDate?.toISOString(),
      externalIds: {
        arxivId: params.source === 'arxiv' ? params.externalId : undefined,
        doi: imported.doi,
      },
      existingChivePaper,
    };

    logger.info('Submission data prepared', {
      source: params.source,
      externalId: params.externalId,
      authorCount: response.authors.length,
      hasDuplicate: !!existingChivePaper,
    });

    return {
      encoding: 'application/json',
      body: response,
    };
  },
};
