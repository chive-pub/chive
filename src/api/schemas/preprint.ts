/**
 * Preprint API schemas.
 *
 * @remarks
 * Zod schemas for preprint-related API requests and responses.
 * All preprint responses include pdsUrl for ATProto compliance.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

import {
  atUriSchema,
  didSchema,
  cidSchema,
  authorRefSchema,
  paginationQuerySchema,
  searchQuerySchema,
} from './common.js';

/**
 * PDS source information schema.
 *
 * @remarks
 * Provides transparency about where data originates.
 * Enables verification and credible exit.
 *
 * @public
 */
export const preprintSourceInfoSchema = z.object({
  pdsEndpoint: z.string().url().describe('User PDS endpoint'),
  recordUrl: z.string().url().describe('Direct URL to fetch authoritative record'),
  blobUrl: z.string().url().optional().describe('Direct URL to fetch PDF blob from PDS'),
  lastVerifiedAt: z.string().datetime().optional().describe('Last time Chive verified with PDS'),
  stale: z.boolean().describe('True if not verified in > 7 days'),
});

/**
 * PDS source information type.
 *
 * @public
 */
export type PreprintSourceInfo = z.infer<typeof preprintSourceInfoSchema>;

/**
 * Blob reference schema.
 *
 * @public
 */
export const blobRefSchema = z.object({
  $type: z.literal('blob'),
  ref: cidSchema.describe('CID of blob'),
  mimeType: z.string().describe('MIME type'),
  size: z.number().int().describe('Size in bytes'),
});

/**
 * Preprint metrics schema.
 *
 * @public
 */
export const preprintMetricsSchema = z.object({
  views: z.number().int().describe('Total view count'),
  downloads: z.number().int().describe('Total download count'),
  endorsements: z.number().int().optional().describe('Endorsement count'),
});

/**
 * Field reference schema.
 *
 * @public
 */
export const fieldRefSchema = z.object({
  id: z.string().optional().describe('Field ID'),
  uri: z.string().describe('Field URI'),
  name: z.string().describe('Field name'),
  parentUri: z.string().optional().describe('Parent field URI'),
});

/**
 * Preprint summary schema (for list views).
 *
 * @public
 */
export const preprintSummarySchema = z.object({
  uri: atUriSchema,
  cid: cidSchema,
  title: z.string().describe('Preprint title'),
  abstract: z.string().max(500).describe('Truncated abstract'),
  author: authorRefSchema.describe('Primary author'),
  coAuthors: z.array(authorRefSchema).optional().describe('Co-authors'),
  fields: z.array(fieldRefSchema).optional().describe('Subject fields'),
  license: z.string().describe('License identifier'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  indexedAt: z.string().datetime().describe('Index timestamp'),
  // ATProto compliance: source information for verification and credible exit
  source: preprintSourceInfoSchema.describe('PDS source information'),
  metrics: preprintMetricsSchema.optional().describe('Engagement metrics'),
});

/**
 * Preprint summary type.
 *
 * @public
 */
export type PreprintSummary = z.infer<typeof preprintSummarySchema>;

/**
 * Full preprint response schema.
 *
 * @remarks
 * Complete preprint data including version history and full metadata.
 * Always includes pdsUrl for ATProto compliance.
 *
 * @public
 */
export const preprintResponseSchema = z.object({
  uri: atUriSchema,
  cid: cidSchema,
  title: z.string().describe('Preprint title'),
  abstract: z.string().describe('Full abstract'),
  author: authorRefSchema.describe('Primary author'),
  coAuthors: z.array(authorRefSchema).optional().describe('Co-authors'),
  document: blobRefSchema.describe('PDF document blob reference'),
  supplementary: z.array(blobRefSchema).optional().describe('Supplementary files'),
  fields: z.array(fieldRefSchema).optional().describe('Subject fields'),
  keywords: z.array(z.string()).optional().describe('Keywords'),
  license: z.string().describe('License identifier'),
  doi: z.string().optional().describe('DOI if assigned'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
  indexedAt: z.string().datetime().describe('Index timestamp'),

  // ATProto compliance: source information for verification and credible exit
  source: preprintSourceInfoSchema.describe('PDS source information'),

  // Enriched data
  metrics: preprintMetricsSchema.optional().describe('Engagement metrics'),
  versions: z
    .array(
      z.object({
        version: z.number().int(),
        cid: cidSchema,
        createdAt: z.string().datetime(),
        changelog: z.string().optional(),
      })
    )
    .optional()
    .describe('Version history'),
});

/**
 * Full preprint response type.
 *
 * @public
 */
export type PreprintResponse = z.infer<typeof preprintResponseSchema>;

/**
 * Get preprint submission query params schema.
 *
 * @public
 */
export const getSubmissionParamsSchema = z.object({
  uri: atUriSchema.describe('Preprint AT URI'),
});

/**
 * Get preprint submission params type.
 *
 * @public
 */
export type GetSubmissionParams = z.infer<typeof getSubmissionParamsSchema>;

/**
 * List preprints by author query params schema.
 *
 * @public
 */
export const listByAuthorParamsSchema = paginationQuerySchema.extend({
  did: didSchema.describe('Author DID'),
  sort: z.enum(['date', 'views']).default('date').describe('Sort order'),
});

/**
 * List by author params type.
 *
 * @public
 */
export type ListByAuthorParams = z.infer<typeof listByAuthorParamsSchema>;

/**
 * Search preprints query params schema.
 *
 * @public
 */
export const searchPreprintsParamsSchema = searchQuerySchema.extend({
  field: z.string().optional().describe('Filter by field URI'),
  author: didSchema.optional().describe('Filter by author DID'),
  license: z.string().optional().describe('Filter by license'),
  dateFrom: z.string().datetime().optional().describe('Filter by date range start'),
  dateTo: z.string().datetime().optional().describe('Filter by date range end'),
});

/**
 * Search preprints params type.
 *
 * @public
 */
export type SearchPreprintsParams = z.infer<typeof searchPreprintsParamsSchema>;

/**
 * Preprint list response schema.
 *
 * @public
 */
export const preprintListResponseSchema = z.object({
  preprints: z.array(preprintSummarySchema).describe('Preprint list'),
  cursor: z.string().optional().describe('Cursor for next page'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().optional().describe('Total count'),
});

/**
 * Preprint list response type.
 *
 * @public
 */
export type PreprintListResponse = z.infer<typeof preprintListResponseSchema>;

/**
 * Search results response schema.
 *
 * @public
 */
export const searchResultsResponseSchema = z.object({
  hits: z
    .array(
      preprintSummarySchema.extend({
        score: z.number().optional().describe('Relevance score'),
        highlights: z
          .record(z.string(), z.array(z.string()))
          .optional()
          .describe('Search highlights'),
      })
    )
    .describe('Search results'),
  cursor: z.string().optional().describe('Cursor for next page'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().describe('Total matching results'),
  facets: z
    .record(
      z.string(),
      z.array(
        z.object({
          value: z.string(),
          count: z.number().int(),
        })
      )
    )
    .optional()
    .describe('Facet counts'),
  impressionId: z
    .string()
    .uuid()
    .optional()
    .describe('Impression ID for click tracking (LTR training data)'),
});

/**
 * Search results response type.
 *
 * @public
 */
export type SearchResultsResponse = z.infer<typeof searchResultsResponseSchema>;

/**
 * Author input schema for preprint submission.
 *
 * @public
 */
export const preprintAuthorInputSchema = z.object({
  did: didSchema.optional().describe('Author DID if they have an ATProto account'),
  name: z.string().min(1).max(200).describe('Author display name'),
  orcid: z
    .string()
    .regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/)
    .optional()
    .describe('ORCID identifier'),
  affiliation: z.string().max(500).optional().describe('Institutional affiliation'),
  isCorresponding: z.boolean().optional().describe('Whether this is the corresponding author'),
});

/**
 * Author input type.
 *
 * @public
 */
export type PreprintAuthorInput = z.infer<typeof preprintAuthorInputSchema>;

/**
 * Facet dimension enum.
 *
 * @public
 */
export const facetDimensionSchema = z.enum([
  'personality',
  'matter',
  'energy',
  'space',
  'time',
  'form',
  'topical',
]);

/**
 * Facet input schema for preprint classification.
 *
 * @public
 */
export const preprintFacetInputSchema = z.object({
  dimension: facetDimensionSchema.describe('PMEST/FAST facet dimension'),
  value: z.string().min(1).max(200).describe('Facet value'),
});

/**
 * Facet input type.
 *
 * @public
 */
export type PreprintFacetInput = z.infer<typeof preprintFacetInputSchema>;

/**
 * Create preprint submission input schema.
 *
 * @remarks
 * Input for creating a new preprint submission. The document must be uploaded
 * to the user's PDS first, and the BlobRef provided here references that blob.
 *
 * @public
 */
export const createSubmissionInputSchema = z.object({
  title: z.string().min(1).max(500).describe('Preprint title'),
  abstract: z.string().min(1).max(10000).describe('Abstract/summary'),
  authors: z
    .array(preprintAuthorInputSchema)
    .min(1)
    .max(100)
    .describe('Author list (first is primary author)'),
  document: blobRefSchema.describe('BlobRef to uploaded PDF in user PDS'),
  fieldNodes: z.array(atUriSchema).optional().describe('Field node URIs for categorization'),
  keywords: z
    .array(z.string().min(1).max(100))
    .max(20)
    .optional()
    .describe('Keywords for discovery'),
  facets: z.array(preprintFacetInputSchema).optional().describe('Faceted classification'),
  license: z.string().max(50).optional().describe('License identifier (e.g., CC-BY-4.0)'),
  doi: z.string().max(100).optional().describe('External DOI if already assigned'),
});

/**
 * Create submission input type.
 *
 * @public
 */
export type CreateSubmissionInput = z.infer<typeof createSubmissionInputSchema>;

/**
 * Create submission response schema.
 *
 * @public
 */
export const createSubmissionResponseSchema = z.object({
  uri: atUriSchema.describe('AT URI of created preprint record'),
  cid: cidSchema.describe('CID of created record'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
});

/**
 * Create submission response type.
 *
 * @public
 */
export type CreateSubmissionResponse = z.infer<typeof createSubmissionResponseSchema>;
