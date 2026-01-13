/**
 * Activity logging API schemas.
 *
 * @remarks
 * Zod schemas for activity logging XRPC endpoints.
 * Activity logging tracks user-initiated write actions and correlates
 * them with firehose events for complete audit trail.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

/**
 * Activity action types.
 */
export const activityActionSchema = z.enum(['create', 'update', 'delete']);

export type ActivityAction = z.infer<typeof activityActionSchema>;

/**
 * Activity status.
 */
export const activityStatusSchema = z.enum(['pending', 'confirmed', 'failed', 'timeout']);

export type ActivityStatus = z.infer<typeof activityStatusSchema>;

/**
 * Activity categories (semantic action types).
 */
export const activityCategorySchema = z.enum([
  'eprint_submit',
  'eprint_update',
  'eprint_delete',
  'review_create',
  'review_update',
  'review_delete',
  'endorsement_create',
  'endorsement_delete',
  'tag_create',
  'tag_delete',
  'profile_update',
  'proposal_create',
  'vote_create',
]);

export type ActivityCategory = z.infer<typeof activityCategorySchema>;

/**
 * Activity record schema.
 */
export const activitySchema = z.object({
  id: z.string().uuid().describe('Unique activity identifier'),
  actorDid: z.string().describe('DID of user who initiated the action'),
  collection: z.string().describe('NSID of the record collection'),
  rkey: z.string().describe('Record key'),
  action: activityActionSchema.describe('Action type'),
  category: activityCategorySchema.describe('Semantic category'),
  status: activityStatusSchema.describe('Activity status'),
  initiatedAt: z.string().datetime().describe('When user initiated the action'),
  confirmedAt: z.string().datetime().nullable().describe('When firehose confirmed'),
  firehoseUri: z.string().nullable().describe('AT URI from firehose'),
  firehoseCid: z.string().nullable().describe('CID from firehose'),
  targetUri: z.string().nullable().describe('Target record URI'),
  targetTitle: z.string().nullable().describe('Target record title'),
  latencyMs: z.number().nullable().describe('Latency from UI to firehose (ms)'),
  errorCode: z.string().nullable().describe('Error code if failed'),
  errorMessage: z.string().nullable().describe('Error message if failed'),
});

export type Activity = z.infer<typeof activitySchema>;

// ============================================================================
// Log Activity Schemas
// ============================================================================

/**
 * Parameters for logging a new activity.
 */
export const logActivityParamsSchema = z.object({
  collection: z.string().describe('NSID of the record collection'),
  rkey: z.string().describe('Record key (TID)'),
  action: activityActionSchema.describe('Action type'),
  category: activityCategorySchema.describe('Semantic category'),
  targetUri: z.string().optional().describe('Target record URI'),
  targetTitle: z.string().max(500).optional().describe('Target record title'),
  traceId: z.string().length(32).optional().describe('OpenTelemetry trace ID'),
  spanId: z.string().length(16).optional().describe('OpenTelemetry span ID'),
  uiContext: z.record(z.string(), z.unknown()).optional().describe('UI context metadata'),
  recordSnapshot: z.record(z.string(), z.unknown()).optional().describe('Record data snapshot'),
});

export type LogActivityParams = z.infer<typeof logActivityParamsSchema>;

/**
 * Response for logging a new activity.
 */
export const logActivityResponseSchema = z.object({
  activityId: z.string().uuid().describe('Created activity ID'),
});

export type LogActivityResponse = z.infer<typeof logActivityResponseSchema>;

// ============================================================================
// Mark Failed Schemas
// ============================================================================

/**
 * Parameters for marking an activity as failed.
 */
export const markFailedParamsSchema = z.object({
  collection: z.string().describe('NSID of the record collection'),
  rkey: z.string().describe('Record key (TID)'),
  errorCode: z.string().max(50).describe('Error code'),
  errorMessage: z.string().max(1000).describe('Error message'),
});

export type MarkFailedParams = z.infer<typeof markFailedParamsSchema>;

/**
 * Response for marking an activity as failed.
 */
export const markFailedResponseSchema = z.object({
  success: z.boolean(),
});

export type MarkFailedResponse = z.infer<typeof markFailedResponseSchema>;

// ============================================================================
// Get Activity Feed Schemas
// ============================================================================

/**
 * Parameters for getting user's activity feed.
 */
export const getActivityFeedParamsSchema = z.object({
  category: activityCategorySchema.optional().describe('Filter by category'),
  status: activityStatusSchema.optional().describe('Filter by status'),
  limit: z.coerce.number().int().min(1).max(100).optional().describe('Maximum results'),
  cursor: z.string().optional().describe('Pagination cursor'),
});

export type GetActivityFeedParams = z.infer<typeof getActivityFeedParamsSchema>;

/**
 * Response for getting user's activity feed.
 */
export const getActivityFeedResponseSchema = z.object({
  activities: z.array(activitySchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type GetActivityFeedResponse = z.infer<typeof getActivityFeedResponseSchema>;

// ============================================================================
// Get Activity Schemas
// ============================================================================

/**
 * Parameters for getting a single activity.
 */
export const getActivityParamsSchema = z.object({
  id: z.string().uuid().describe('Activity ID'),
});

export type GetActivityParams = z.infer<typeof getActivityParamsSchema>;

/**
 * Response for getting a single activity.
 */
export const getActivityResponseSchema = z.object({
  activity: activitySchema.nullable(),
});

export type GetActivityResponse = z.infer<typeof getActivityResponseSchema>;

// ============================================================================
// Correlation Metrics Schemas
// ============================================================================

/**
 * Correlation metrics entry.
 */
export const correlationMetricsEntrySchema = z.object({
  hour: z.string().datetime().describe('Hour bucket'),
  category: activityCategorySchema.describe('Activity category'),
  total: z.number().int().describe('Total activities'),
  confirmed: z.number().int().describe('Confirmed activities'),
  failed: z.number().int().describe('Failed activities'),
  timeout: z.number().int().describe('Timed out activities'),
  pending: z.number().int().describe('Pending activities'),
  confirmationRatePct: z.number().describe('Confirmation rate percentage'),
  avgLatencyMs: z.number().nullable().describe('Average latency (ms)'),
  p95LatencyMs: z.number().nullable().describe('P95 latency (ms)'),
});

export type CorrelationMetricsEntry = z.infer<typeof correlationMetricsEntrySchema>;

/**
 * Parameters for getting correlation metrics.
 */
export const getCorrelationMetricsParamsSchema = z.object({});

export type GetCorrelationMetricsParams = z.infer<typeof getCorrelationMetricsParamsSchema>;

/**
 * Response for getting correlation metrics.
 */
export const getCorrelationMetricsResponseSchema = z.object({
  metrics: z.array(correlationMetricsEntrySchema),
  pendingCount: z.number().int().describe('Current pending activity count'),
});

export type GetCorrelationMetricsResponse = z.infer<typeof getCorrelationMetricsResponseSchema>;
