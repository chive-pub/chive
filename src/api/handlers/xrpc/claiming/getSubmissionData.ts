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

import type { Context } from 'hono';
import { z } from 'zod';

import { NotFoundError } from '../../../../types/errors.js';
import { importSourceSchema } from '../../../schemas/claiming.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Parameters for getting submission data.
 */
export const getSubmissionDataParamsSchema = z.object({
  source: importSourceSchema.describe('External source (e.g., arxiv, semanticscholar)'),
  externalId: z.string().min(1).describe('Source-specific identifier'),
});

export type GetSubmissionDataParams = z.infer<typeof getSubmissionDataParamsSchema>;

/**
 * Author data for the submission form.
 */
const submissionAuthorSchema = z.object({
  order: z.number().int().min(1),
  name: z.string(),
  orcid: z.string().optional(),
  email: z.string().email().optional(),
  affiliation: z.string().optional(),
});

/**
 * Existing Chive paper info for duplicate detection.
 */
const existingChivePaperSchema = z.object({
  uri: z.string().describe('AT-URI of the existing paper'),
  title: z.string().describe('Paper title'),
  authors: z.array(
    z.object({
      did: z.string().optional(),
      name: z.string(),
    })
  ),
  createdAt: z.string().datetime().describe('When the paper was indexed'),
});

/**
 * Response schema for submission data.
 */
export const getSubmissionDataResponseSchema = z.object({
  /** Prefilled title */
  title: z.string(),

  /** Prefilled abstract */
  abstract: z.string(),

  /** Prefilled authors */
  authors: z.array(submissionAuthorSchema),

  /** Prefilled keywords/categories */
  keywords: z.array(z.string()),

  /** DOI if available */
  doi: z.string().optional(),

  /** PDF URL if available */
  pdfUrl: z.string().url().optional(),

  /** Source system */
  source: importSourceSchema,

  /** Source-specific external ID */
  externalId: z.string(),

  /** External URL to the paper */
  externalUrl: z.string().url(),

  /** Publication date */
  publicationDate: z.string().datetime().optional(),

  /** Pre-filled external IDs for step 6 */
  externalIds: z
    .object({
      arxivId: z.string().optional(),
      doi: z.string().optional(),
    })
    .optional(),

  /** Existing Chive paper if this is a duplicate */
  existingChivePaper: existingChivePaperSchema.optional(),
});

export type GetSubmissionDataResponse = z.infer<typeof getSubmissionDataResponseSchema>;

/**
 * Handler for pub.chive.claiming.getSubmissionData.
 *
 * @param c - Hono context
 * @param params - Source and external ID
 * @returns Prefilled form data for submission wizard
 *
 * @public
 */
export async function getSubmissionDataHandler(
  c: Context<ChiveEnv>,
  params: GetSubmissionDataParams
): Promise<GetSubmissionDataResponse> {
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
  let existingChivePaper: GetSubmissionDataResponse['existingChivePaper'];

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
  const response: GetSubmissionDataResponse = {
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

  return response;
}

/**
 * Endpoint definition for pub.chive.claiming.getSubmissionData.
 *
 * @public
 */
export const getSubmissionDataEndpoint: XRPCEndpoint<
  GetSubmissionDataParams,
  GetSubmissionDataResponse
> = {
  method: 'pub.chive.claiming.getSubmissionData' as never,
  type: 'query',
  description: 'Get prefilled submission data for claiming a paper from an external source',
  inputSchema: getSubmissionDataParamsSchema,
  outputSchema: getSubmissionDataResponseSchema,
  handler: getSubmissionDataHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
