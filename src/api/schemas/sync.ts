/**
 * Sync API schemas.
 *
 * @remarks
 * Zod schemas for PDS sync-related XRPC endpoints.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

/**
 * Staleness check result schema.
 */
export const stalenessCheckResultSchema = z.object({
  uri: z.string(),
  isStale: z.boolean(),
  indexedCID: z.string(),
  pdsCID: z.string().optional(),
  error: z.string().optional(),
});

export type StalenessCheckResult = z.infer<typeof stalenessCheckResultSchema>;

/**
 * Refresh result schema.
 */
export const refreshResultSchema = z.object({
  refreshed: z.boolean(),
  changed: z.boolean(),
  previousCID: z.string(),
  currentCID: z.string(),
  error: z.string().optional(),
});

export type RefreshResult = z.infer<typeof refreshResultSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Parameters for checking staleness.
 */
export const checkStalenessParamsSchema = z.object({
  uri: z.string(),
});

export type CheckStalenessParams = z.infer<typeof checkStalenessParamsSchema>;

/**
 * Parameters for refreshing a record.
 */
export const refreshRecordInputSchema = z.object({
  uri: z.string(),
});

export type RefreshRecordInput = z.infer<typeof refreshRecordInputSchema>;

/**
 * Parameters for verifying sync state.
 */
export const verifySyncParamsSchema = z.object({
  uri: z.string(),
});

export type VerifySyncParams = z.infer<typeof verifySyncParamsSchema>;

/**
 * Verify sync response schema.
 */
export const verifySyncResponseSchema = z.object({
  uri: z.string(),
  indexed: z.boolean(),
  inSync: z.boolean(),
  indexedAt: z.string().datetime().optional(),
  lastSyncedAt: z.string().datetime().optional(),
  staleDays: z.number().optional(),
});

export type VerifySyncResponse = z.infer<typeof verifySyncResponseSchema>;
