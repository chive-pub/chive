/**
 * Backlink API schemas.
 *
 * @remarks
 * Zod schemas for backlink-related XRPC endpoints.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

/**
 * Valid backlink source types.
 */
export const backlinkSourceTypeSchema = z.enum([
  'semble.collection',
  'leaflet.list',
  'whitewind.blog',
  'bluesky.post',
  'bluesky.embed',
  'other',
]);

export type BacklinkSourceType = z.infer<typeof backlinkSourceTypeSchema>;

/**
 * Backlink record schema.
 */
export const backlinkSchema = z.object({
  id: z.number().int(),
  sourceUri: z.string(),
  sourceType: backlinkSourceTypeSchema,
  targetUri: z.string(),
  context: z.string().optional(),
  indexedAt: z.string().datetime(),
  deleted: z.boolean(),
});

export type Backlink = z.infer<typeof backlinkSchema>;

/**
 * Backlink counts schema.
 *
 * @remarks
 * Matches the frontend BacklinkCounts interface in web/lib/hooks/use-backlinks.ts.
 * blueskyPosts and blueskyEmbeds are provided separately for UI flexibility.
 */
export const backlinkCountsSchema = z.object({
  sembleCollections: z.number().int(),
  leafletLists: z.number().int(),
  whitewindBlogs: z.number().int(),
  blueskyPosts: z.number().int(),
  blueskyEmbeds: z.number().int(),
  other: z.number().int(),
  total: z.number().int(),
});

export type BacklinkCounts = z.infer<typeof backlinkCountsSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Parameters for listing backlinks.
 */
export const listBacklinksParamsSchema = z.object({
  targetUri: z.string(),
  sourceType: backlinkSourceTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export type ListBacklinksParams = z.infer<typeof listBacklinksParamsSchema>;

/**
 * Response for listing backlinks.
 */
export const listBacklinksResponseSchema = z.object({
  backlinks: z.array(backlinkSchema),
  cursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type ListBacklinksResponse = z.infer<typeof listBacklinksResponseSchema>;

/**
 * Parameters for getting backlink counts.
 */
export const getBacklinkCountsParamsSchema = z.object({
  targetUri: z.string(),
});

export type GetBacklinkCountsParams = z.infer<typeof getBacklinkCountsParamsSchema>;

/**
 * Parameters for creating a backlink.
 */
export const createBacklinkInputSchema = z.object({
  sourceUri: z.string(),
  sourceType: backlinkSourceTypeSchema,
  targetUri: z.string(),
  context: z.string().max(500).optional(),
});

export type CreateBacklinkInput = z.infer<typeof createBacklinkInputSchema>;

/**
 * Parameters for deleting a backlink.
 */
export const deleteBacklinkInputSchema = z.object({
  sourceUri: z.string(),
});

export type DeleteBacklinkInput = z.infer<typeof deleteBacklinkInputSchema>;
