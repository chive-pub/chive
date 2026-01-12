/**
 * Knowledge graph API schemas.
 *
 * @remarks
 * Zod schemas for knowledge graph field, authority, and faceted
 * browsing API requests and responses.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

import { paginationQuerySchema, searchQuerySchema, didSchema } from './common.js';
import { eprintAuthorRefSchema, eprintSourceInfoSchema, fieldRefSchema } from './eprint.js';

/**
 * External identifier schema.
 *
 * @remarks
 * Links to external knowledge bases (Wikidata, LCSH, etc.).
 *
 * @public
 */
export const externalIdSchema = z.object({
  source: z.enum(['wikidata', 'lcsh', 'fast', 'mesh', 'arxiv']).describe('Source system'),
  id: z.string().describe('External identifier'),
  url: z.string().url().optional().describe('External URL'),
});

/**
 * External identifier type.
 *
 * @public
 */
export type ExternalId = z.infer<typeof externalIdSchema>;

/**
 * Field status schema.
 *
 * @public
 */
export const fieldStatusSchema = z
  .enum(['proposed', 'under_review', 'approved', 'deprecated'])
  .describe('Field status');

/**
 * Field node schema.
 *
 * @public
 */
export const fieldNodeSchema = z.object({
  id: z.string().describe('Field identifier'),
  uri: z.string().describe('Field URI'),
  name: z.string().describe('Field name'),
  description: z.string().optional().describe('Field description'),
  parentId: z.string().optional().describe('Parent field ID'),
  status: fieldStatusSchema,
  eprintCount: z.number().int().optional().describe('Number of eprints'),
  childCount: z.number().int().optional().describe('Number of child fields'),
  externalIds: z.array(externalIdSchema).optional().describe('External identifiers'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().optional().describe('Last update'),
});

/**
 * Field node type.
 *
 * @public
 */
export type FieldNode = z.infer<typeof fieldNodeSchema>;

/**
 * Field relationship schema.
 *
 * @public
 */
export const fieldRelationshipSchema = z.object({
  type: z
    .enum(['broader', 'narrower', 'related', 'equivalent', 'influences', 'influenced_by'])
    .describe('Relationship type'),
  targetId: z.string().describe('Target field ID'),
  targetName: z.string().describe('Target field name'),
  strength: z.number().min(0).max(1).optional().describe('Relationship strength'),
});

/**
 * Field detail response schema.
 *
 * @public
 */
export const fieldDetailSchema = fieldNodeSchema.extend({
  relationships: z.array(fieldRelationshipSchema).optional().describe('Related fields'),
  children: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        eprintCount: z.number().int().optional(),
      })
    )
    .optional()
    .describe('Child fields'),
  ancestors: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    )
    .optional()
    .describe('Ancestor path'),
});

/**
 * Field detail type.
 *
 * @public
 */
export type FieldDetail = z.infer<typeof fieldDetailSchema>;

/**
 * Get field query params schema.
 *
 * @public
 */
export const getFieldParamsSchema = z.object({
  id: z.string().describe('Field identifier'),
  includeRelationships: z.coerce.boolean().default(false).describe('Include related fields'),
  includeChildren: z.coerce.boolean().default(false).describe('Include child fields'),
  includeAncestors: z.coerce.boolean().default(true).describe('Include ancestor path'),
});

/**
 * Get field params type.
 *
 * @public
 */
export type GetFieldParams = z.infer<typeof getFieldParamsSchema>;

/**
 * Authority record schema.
 *
 * @public
 */
export const authorityRecordSchema = z.object({
  id: z.string().describe('Authority record ID'),
  uri: z.string().describe('Authority record URI'),
  name: z.string().describe('Canonical name'),
  type: z.enum(['person', 'organization', 'concept', 'place']).describe('Entity type'),
  alternateNames: z.array(z.string()).optional().describe('Alternate names'),
  description: z.string().optional().describe('Description'),
  externalIds: z.array(externalIdSchema).optional().describe('External identifiers'),
  linkedEprints: z.number().int().optional().describe('Number of linked eprints'),
  status: fieldStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

/**
 * Authority record type.
 *
 * @public
 */
export type AuthorityRecord = z.infer<typeof authorityRecordSchema>;

/**
 * Search authorities query params schema.
 *
 * @public
 */
export const searchAuthoritiesParamsSchema = searchQuerySchema.extend({
  type: z
    .enum(['person', 'organization', 'concept', 'place'])
    .optional()
    .describe('Filter by type'),
  status: fieldStatusSchema.optional().describe('Filter by status'),
});

/**
 * Search authorities params type.
 *
 * @public
 */
export type SearchAuthoritiesParams = z.infer<typeof searchAuthoritiesParamsSchema>;

/**
 * Authority search response schema.
 *
 * @public
 */
export const authoritySearchResponseSchema = z.object({
  authorities: z.array(authorityRecordSchema).describe('Search results'),
  cursor: z.string().optional(),
  hasMore: z.boolean(),
  total: z.number().int(),
});

/**
 * Authority search response type.
 *
 * @public
 */
export type AuthoritySearchResponse = z.infer<typeof authoritySearchResponseSchema>;

/**
 * PMEST facet schema.
 *
 * @remarks
 * Ranganathan's PMEST (Personality, Matter, Energy, Space, Time)
 * faceted classification system.
 *
 * Each facet dimension accepts an array of values for multi-select filtering,
 * following industry standard faceted search API design (Algolia, Azure AI Search).
 *
 * @public
 */
export const pmestFacetSchema = z.object({
  personality: z.array(z.string()).optional().describe('Discipline/subject values'),
  matter: z.array(z.string()).optional().describe('Material/substance values'),
  energy: z.array(z.string()).optional().describe('Process/action values'),
  space: z.array(z.string()).optional().describe('Location/geography values'),
  time: z.array(z.string()).optional().describe('Time period/era values'),
});

/**
 * PMEST facet type.
 *
 * @public
 */
export type PMESTFacet = z.infer<typeof pmestFacetSchema>;

/**
 * Browse faceted query params schema.
 *
 * @public
 */
export const browseFacetedParamsSchema = paginationQuerySchema.merge(pmestFacetSchema);

/**
 * Browse faceted params type.
 *
 * @public
 */
export type BrowseFacetedParams = z.infer<typeof browseFacetedParamsSchema>;

/**
 * Facet value with count schema.
 *
 * @public
 */
export const facetValueSchema = z.object({
  value: z.string().describe('Facet value'),
  label: z.string().optional().describe('Display label'),
  count: z.number().int().describe('Number of eprints'),
});

/**
 * Eprint summary for faceted browse results.
 *
 * @remarks
 * Uses the unified author model matching EprintSummary.
 *
 * @public
 */
export const facetedEprintSummarySchema = z.object({
  uri: z.string().describe('AT URI'),
  cid: z.string().describe('CID of indexed version'),
  title: z.string().describe('Eprint title'),
  abstract: z.string().describe('Eprint abstract'),
  authors: z.array(eprintAuthorRefSchema).describe('All authors with contributions'),
  submittedBy: didSchema.describe('DID of human user who submitted'),
  paperDid: didSchema.optional().describe('Paper DID if paper has its own PDS'),
  fields: z.array(fieldRefSchema).optional().describe('Subject fields'),
  license: z.string().describe('License identifier'),
  keywords: z.array(z.string()).optional().describe('Keywords'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  indexedAt: z.string().datetime().describe('Index timestamp'),
  source: eprintSourceInfoSchema.describe('Source PDS information'),
  score: z.number().optional().describe('Relevance score'),
  highlights: z.record(z.string(), z.array(z.string())).optional().describe('Search highlights'),
});

/**
 * Faceted eprint summary type.
 *
 * @public
 */
export type FacetedEprintSummary = z.infer<typeof facetedEprintSummarySchema>;

/**
 * Faceted browse response schema.
 *
 * @remarks
 * Uses `hits` to match the frontend SearchResultsResponse interface.
 *
 * @public
 */
export const facetedBrowseResponseSchema = z.object({
  hits: z.array(facetedEprintSummarySchema).describe('Matching eprints'),
  facets: z
    .object({
      // PMEST dimensions
      personality: z.array(facetValueSchema).optional(),
      matter: z.array(facetValueSchema).optional(),
      energy: z.array(facetValueSchema).optional(),
      space: z.array(facetValueSchema).optional(),
      time: z.array(facetValueSchema).optional(),
      // FAST dimensions
      person: z.array(facetValueSchema).optional(),
      organization: z.array(facetValueSchema).optional(),
      event: z.array(facetValueSchema).optional(),
      work: z.array(facetValueSchema).optional(),
      formGenre: z.array(facetValueSchema).optional(),
    })
    .describe('Available facet refinements'),
  cursor: z.string().optional(),
  hasMore: z.boolean(),
  total: z.number().int(),
  impressionId: z.string().uuid().optional().describe('Impression ID for click tracking'),
});

/**
 * Faceted browse response type.
 *
 * @public
 */
export type FacetedBrowseResponse = z.infer<typeof facetedBrowseResponseSchema>;

/**
 * List fields query params schema.
 *
 * @public
 */
export const listFieldsParamsSchema = z.object({
  status: fieldStatusSchema.optional().describe('Filter by status'),
  parentId: z.string().optional().describe('Filter by parent field ID'),
  limit: z.coerce.number().int().min(1).max(100).default(50).describe('Maximum results'),
  cursor: z.string().optional().describe('Pagination cursor'),
});

/**
 * List fields params type.
 *
 * @public
 */
export type ListFieldsParams = z.infer<typeof listFieldsParamsSchema>;

/**
 * Field list response schema.
 *
 * @public
 */
export const fieldListResponseSchema = z.object({
  fields: z.array(fieldNodeSchema).describe('Field list'),
  cursor: z.string().optional(),
  hasMore: z.boolean(),
  total: z.number().int().optional(),
});

/**
 * Field list response type.
 *
 * @public
 */
export type FieldListResponse = z.infer<typeof fieldListResponseSchema>;

// =============================================================================
// FIELD EPRINTS SCHEMAS
// =============================================================================

/**
 * Get field eprints query params schema.
 *
 * @public
 */
export const getFieldEprintsParamsSchema = paginationQuerySchema.extend({
  fieldId: z.string().describe('Field identifier'),
});

/**
 * Get field eprints params type.
 *
 * @public
 */
export type GetFieldEprintsParams = z.infer<typeof getFieldEprintsParamsSchema>;

/**
 * Eprint summary for field listings schema.
 *
 * @public
 */
export const fieldEprintSummarySchema = z.object({
  uri: z.string().describe('Eprint AT URI'),
  title: z.string().describe('Eprint title'),
  abstract: z.string().max(500).optional().describe('Truncated abstract'),
  authorDid: z.string().describe('Primary author DID'),
  authorName: z.string().optional().describe('Author display name'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  pdsUrl: z.string().url().describe('PDS endpoint URL'),
  views: z.number().int().optional().describe('View count'),
});

/**
 * Eprint summary type.
 *
 * @public
 */
export type FieldEprintSummary = z.infer<typeof fieldEprintSummarySchema>;

/**
 * Field eprints response schema.
 *
 * @public
 */
export const fieldEprintsResponseSchema = z.object({
  eprints: z.array(fieldEprintSummarySchema).describe('Eprints in this field'),
  cursor: z.string().optional().describe('Pagination cursor'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().describe('Total count'),
});

/**
 * Field eprints response type.
 *
 * @public
 */
export type FieldEprintsResponse = z.infer<typeof fieldEprintsResponseSchema>;

// =============================================================================
// AUTHORITY DETAIL SCHEMAS
// =============================================================================

/**
 * Get authority query params schema.
 *
 * @public
 */
export const getAuthorityParamsSchema = z.object({
  id: z.string().describe('Authority record ID'),
});

/**
 * Get authority params type.
 *
 * @public
 */
export type GetAuthorityParams = z.infer<typeof getAuthorityParamsSchema>;

/**
 * Authority detail response schema.
 *
 * @public
 */
export const authorityDetailSchema = authorityRecordSchema.extend({
  linkedEprints: z.number().int().optional().describe('Number of linked eprints'),
  linkedAuthors: z.number().int().optional().describe('Number of linked authors'),
  reconciliationCount: z.number().int().optional().describe('Number of reconciliations'),
});

/**
 * Authority detail type.
 *
 * @public
 */
export type AuthorityDetail = z.infer<typeof authorityDetailSchema>;

// =============================================================================
// AUTHORITY RECONCILIATIONS SCHEMAS
// =============================================================================

/**
 * Get authority reconciliations query params schema.
 *
 * @public
 */
export const getAuthorityReconciliationsParamsSchema = paginationQuerySchema.extend({
  authorityId: z.string().describe('Authority record ID'),
});

/**
 * Get authority reconciliations params type.
 *
 * @public
 */
export type GetAuthorityReconciliationsParams = z.infer<
  typeof getAuthorityReconciliationsParamsSchema
>;

/**
 * Reconciliation record schema.
 *
 * @public
 */
export const reconciliationRecordSchema = z.object({
  id: z.string().describe('Reconciliation ID'),
  authorityId: z.string().describe('Authority record ID'),
  externalSource: z.string().describe('External source (e.g., arxiv, orcid)'),
  externalId: z.string().describe('External identifier'),
  externalUrl: z.string().url().optional().describe('External URL'),
  status: z.enum(['pending', 'approved', 'rejected']).describe('Reconciliation status'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  approvedAt: z.string().datetime().optional().describe('Approval timestamp'),
  approvedBy: z.string().optional().describe('Approver DID'),
});

/**
 * Reconciliation record type.
 *
 * @public
 */
export type ReconciliationRecord = z.infer<typeof reconciliationRecordSchema>;

/**
 * Authority reconciliations response schema.
 *
 * @public
 */
export const authorityReconciliationsResponseSchema = z.object({
  reconciliations: z.array(reconciliationRecordSchema).describe('Reconciliation records'),
  cursor: z.string().optional().describe('Pagination cursor'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().describe('Total count'),
});

/**
 * Authority reconciliations response type.
 *
 * @public
 */
export type AuthorityReconciliationsResponse = z.infer<
  typeof authorityReconciliationsResponseSchema
>;
