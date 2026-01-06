/**
 * Tag API schemas.
 *
 * @remarks
 * Zod schemas for tag-related API requests and responses.
 * Tags provide folksonomy-style classification with TaxoFolk suggestions.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

import { atUriSchema, authorRefSchema, paginationQuerySchema } from './common.js';

/**
 * User tag schema.
 *
 * @public
 */
export const userTagSchema = z.object({
  uri: atUriSchema.describe('Tag AT-URI'),
  preprintUri: atUriSchema.describe('Tagged preprint AT-URI'),
  author: authorRefSchema.describe('Tag creator'),
  displayForm: z.string().describe('Original display form'),
  normalizedForm: z.string().describe('Normalized form (lowercase, hyphenated)'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
});

/**
 * User tag type.
 *
 * @public
 */
export type UserTag = z.infer<typeof userTagSchema>;

/**
 * Tag summary schema.
 *
 * @public
 */
export const tagSummarySchema = z.object({
  normalizedForm: z.string().describe('Normalized tag form'),
  displayForms: z.array(z.string()).describe('All display forms used'),
  usageCount: z.number().int().describe('Number of preprints tagged'),
  qualityScore: z.number().min(0).max(1).describe('Tag quality score'),
  isPromoted: z.boolean().describe('Promoted to facet/authority'),
  promotedTo: z
    .object({
      type: z.enum(['facet', 'authority']),
      uri: z.string(),
    })
    .optional()
    .describe('Promotion target'),
});

/**
 * Tag summary type.
 *
 * @public
 */
export type TagSummary = z.infer<typeof tagSummarySchema>;

/**
 * Tag suggestion schema.
 *
 * @public
 */
export const tagSuggestionSchema = z.object({
  displayForm: z.string().describe('Suggested display form'),
  normalizedForm: z.string().describe('Normalized form'),
  confidence: z.number().min(0).max(1).describe('Suggestion confidence'),
  source: z.enum(['cooccurrence', 'authority', 'facet']).describe('Suggestion source'),
  matchedTerm: z.string().optional().describe('Term that triggered suggestion'),
});

/**
 * Tag suggestion type.
 *
 * @public
 */
export type TagSuggestion = z.infer<typeof tagSuggestionSchema>;

/**
 * List tags for preprint params schema.
 *
 * @public
 */
export const listTagsForPreprintParamsSchema = z.object({
  preprintUri: atUriSchema.describe('Preprint AT-URI'),
});

/**
 * List tags for preprint params type.
 *
 * @public
 */
export type ListTagsForPreprintParams = z.infer<typeof listTagsForPreprintParamsSchema>;

/**
 * Get tag suggestions params schema.
 *
 * @public
 */
export const getTagSuggestionsParamsSchema = z.object({
  q: z.string().min(2).max(100).describe('Query string'),
  limit: z.coerce.number().int().min(1).max(20).default(10).optional(),
});

/**
 * Get tag suggestions params type.
 *
 * @public
 */
export type GetTagSuggestionsParams = z.infer<typeof getTagSuggestionsParamsSchema>;

/**
 * Get trending tags params schema.
 *
 * @public
 */
export const getTrendingTagsParamsSchema = z.object({
  timeWindow: z.enum(['day', 'week', 'month']).default('week').describe('Time window'),
  limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
});

/**
 * Get trending tags params type.
 *
 * @public
 */
export type GetTrendingTagsParams = z.infer<typeof getTrendingTagsParamsSchema>;

/**
 * Search tags params schema.
 *
 * @public
 */
export const searchTagsParamsSchema = paginationQuerySchema.extend({
  q: z.string().min(2).max(100).describe('Search query'),
  minQuality: z.coerce.number().min(0).max(1).optional().describe('Minimum quality score'),
  includeSpam: z.coerce.boolean().optional().describe('Include spam tags'),
});

/**
 * Search tags params type.
 *
 * @public
 */
export type SearchTagsParams = z.infer<typeof searchTagsParamsSchema>;

/**
 * Get tag detail params schema.
 *
 * @public
 */
export const getTagDetailParamsSchema = z.object({
  tag: z.string().describe('Normalized tag form'),
});

/**
 * Get tag detail params type.
 *
 * @public
 */
export type GetTagDetailParams = z.infer<typeof getTagDetailParamsSchema>;

/**
 * Create tag input schema.
 *
 * @public
 */
export const createTagInputSchema = z.object({
  preprintUri: atUriSchema.describe('Preprint AT-URI'),
  displayForm: z.string().min(1).max(100).describe('Tag display form'),
});

/**
 * Create tag input type.
 *
 * @public
 */
export type CreateTagInput = z.infer<typeof createTagInputSchema>;

/**
 * Delete tag input schema.
 *
 * @public
 */
export const deleteTagInputSchema = z.object({
  uri: atUriSchema.describe('Tag AT-URI to delete'),
});

/**
 * Delete tag input type.
 *
 * @public
 */
export type DeleteTagInput = z.infer<typeof deleteTagInputSchema>;

/**
 * Preprint tags response schema.
 *
 * @public
 */
export const preprintTagsResponseSchema = z.object({
  tags: z.array(userTagSchema).describe('Tags for the preprint'),
  suggestions: z.array(tagSuggestionSchema).optional().describe('TaxoFolk suggestions'),
});

/**
 * Preprint tags response type.
 *
 * @public
 */
export type PreprintTagsResponse = z.infer<typeof preprintTagsResponseSchema>;

/**
 * Tag suggestions response schema.
 *
 * @public
 */
export const tagSuggestionsResponseSchema = z.object({
  suggestions: z.array(tagSuggestionSchema).describe('Tag suggestions'),
});

/**
 * Tag suggestions response type.
 *
 * @public
 */
export type TagSuggestionsResponse = z.infer<typeof tagSuggestionsResponseSchema>;

/**
 * Trending tags response schema.
 *
 * @public
 */
export const trendingTagsResponseSchema = z.object({
  tags: z.array(tagSummarySchema).describe('Trending tags'),
  timeWindow: z.enum(['day', 'week', 'month']).describe('Time window'),
});

/**
 * Trending tags response type.
 *
 * @public
 */
export type TrendingTagsResponse = z.infer<typeof trendingTagsResponseSchema>;

/**
 * Tag search response schema.
 *
 * @public
 */
export const tagSearchResponseSchema = z.object({
  tags: z.array(tagSummarySchema).describe('Search results'),
  cursor: z.string().optional().describe('Cursor for next page'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().optional().describe('Total count'),
});

/**
 * Tag search response type.
 *
 * @public
 */
export type TagSearchResponse = z.infer<typeof tagSearchResponseSchema>;
