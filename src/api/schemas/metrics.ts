/**
 * Metrics API schemas.
 *
 * @remarks
 * Zod schemas for metrics-related XRPC endpoints.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

/**
 * Preprint metrics schema.
 */
export const preprintMetricsSchema = z.object({
  totalViews: z.number().int(),
  uniqueViews: z.number().int(),
  totalDownloads: z.number().int(),
  views24h: z.number().int(),
  views7d: z.number().int(),
  views30d: z.number().int(),
});

export type PreprintMetrics = z.infer<typeof preprintMetricsSchema>;

/**
 * Trending entry schema.
 */
export const trendingEntrySchema = z.object({
  uri: z.string(),
  score: z.number().int(),
});

export type TrendingEntry = z.infer<typeof trendingEntrySchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Parameters for recording a view.
 */
export const recordViewInputSchema = z.object({
  uri: z.string(),
  viewerDid: z.string().optional(),
});

export type RecordViewInput = z.infer<typeof recordViewInputSchema>;

/**
 * Parameters for recording a download.
 */
export const recordDownloadInputSchema = z.object({
  uri: z.string(),
  viewerDid: z.string().optional(),
});

export type RecordDownloadInput = z.infer<typeof recordDownloadInputSchema>;

/**
 * Parameters for getting metrics.
 */
export const getMetricsParamsSchema = z.object({
  uri: z.string(),
});

export type GetMetricsParams = z.infer<typeof getMetricsParamsSchema>;

/**
 * Parameters for getting view count.
 */
export const getViewCountParamsSchema = z.object({
  uri: z.string(),
});

export type GetViewCountParams = z.infer<typeof getViewCountParamsSchema>;

/**
 * Response for view count.
 */
export const viewCountResponseSchema = z.object({
  count: z.number().int(),
});

export type ViewCountResponse = z.infer<typeof viewCountResponseSchema>;

/**
 * Parameters for getting trending preprints.
 */
export const getTrendingParamsSchema = z.object({
  window: z.enum(['24h', '7d', '30d']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type GetTrendingParams = z.infer<typeof getTrendingParamsSchema>;

/**
 * Response for trending preprints.
 */
export const trendingResponseSchema = z.object({
  trending: z.array(trendingEntrySchema),
});

export type TrendingResponse = z.infer<typeof trendingResponseSchema>;

// ============================================================================
// Search Click/Dwell Schemas (for LTR training data)
// ============================================================================

/**
 * Parameters for recording a search result click.
 */
export const recordSearchClickInputSchema = z.object({
  impressionId: z.string().uuid(),
  uri: z.string(),
  position: z.number().int().min(0),
});

export type RecordSearchClickInput = z.infer<typeof recordSearchClickInputSchema>;

/**
 * Parameters for recording dwell time.
 */
export const recordDwellTimeInputSchema = z.object({
  impressionId: z.string().uuid(),
  uri: z.string(),
  dwellTimeMs: z.number().int().min(0),
});

export type RecordDwellTimeInput = z.infer<typeof recordDwellTimeInputSchema>;

/**
 * Parameters for recording a download from search.
 */
export const recordSearchDownloadInputSchema = z.object({
  impressionId: z.string().uuid(),
  uri: z.string(),
});

export type RecordSearchDownloadInput = z.infer<typeof recordSearchDownloadInputSchema>;
