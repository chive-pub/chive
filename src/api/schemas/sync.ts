/**
 * Sync API schemas.
 *
 * @remarks
 * Zod schemas for PDS sync-related XRPC endpoints.
 *
 * @packageDocumentation
 * @public
 */

import { z } from './base.js';

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

/**
 * Parameters for indexing a record from PDS.
 */
export const indexRecordInputSchema = z.object({
  uri: z.string().describe('AT URI of the record to index'),
});

export type IndexRecordInput = z.infer<typeof indexRecordInputSchema>;

/**
 * Index record response schema.
 */
export const indexRecordResponseSchema = z.object({
  uri: z.string(),
  indexed: z.boolean(),
  cid: z.string().optional(),
  error: z.string().optional(),
});

export type IndexRecordResponse = z.infer<typeof indexRecordResponseSchema>;

// ============================================================================
// PDS Registration Schemas
// ============================================================================

/**
 * Parameters for registering a PDS.
 */
export const registerPDSInputSchema = z.object({
  pdsUrl: z.string().url().describe('PDS endpoint URL to register'),
});

export type RegisterPDSInput = z.infer<typeof registerPDSInputSchema>;

/**
 * Register PDS response schema.
 */
export const registerPDSResponseSchema = z.object({
  pdsUrl: z.string(),
  registered: z.boolean(),
  status: z.enum(['pending', 'already_exists', 'scanned']),
  message: z.string().optional(),
});

export type RegisterPDSResponse = z.infer<typeof registerPDSResponseSchema>;
