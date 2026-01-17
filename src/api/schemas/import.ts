/**
 * Import API schemas.
 *
 * @remarks
 * Zod schemas for import-related XRPC endpoints.
 *
 * @packageDocumentation
 * @public
 */
import { z } from './base.js';
// Import AND re-export from claiming.ts (single source of truth)
import {
  importSourceSchema as importSourceSchemaFromClaiming,
  type ImportSourceType,
  WELL_KNOWN_SOURCES,
} from './claiming.js';

// Re-export for external consumers
export const importSourceSchema = importSourceSchemaFromClaiming;
export { type ImportSourceType, WELL_KNOWN_SOURCES };

/**
 * Alias for ImportSourceType.
 */
export type ImportSource = string;

/**
 * Sync status schema.
 */
export const syncStatusSchema = z.enum(['active', 'stale', 'unavailable']);

export type SyncStatus = z.infer<typeof syncStatusSchema>;

/**
 * Claim status schema.
 */
export const claimStatusSchema = z.enum(['unclaimed', 'pending', 'claimed']);

export type ClaimStatus = z.infer<typeof claimStatusSchema>;

/**
 * External author schema.
 */
export const externalAuthorSchema = z.object({
  name: z.string(),
  orcid: z.string().optional(),
  affiliation: z.string().optional(),
  email: z.string().email().optional(),
});

export type ExternalAuthor = z.infer<typeof externalAuthorSchema>;

/**
 * Imported eprint schema.
 */
export const importedEprintSchema = z.object({
  id: z.number().int(),
  source: importSourceSchema,
  externalId: z.string(),
  url: z.string().url(),
  title: z.string(),
  abstract: z.string().optional(),
  authors: z.array(externalAuthorSchema),
  publicationDate: z.string().datetime().optional(),
  categories: z.array(z.string()).optional(),
  doi: z.string().optional(),
  pdfUrl: z.string().url().optional(),
  importedByPlugin: z.string(),
  importedAt: z.string().datetime(),
  lastSyncedAt: z.string().datetime().optional(),
  syncStatus: syncStatusSchema,
  claimStatus: claimStatusSchema,
  canonicalUri: z.string().optional(),
  claimedByDid: z.string().optional(),
  claimedAt: z.string().datetime().optional(),
});

export type ImportedEprint = z.infer<typeof importedEprintSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Parameters for searching imports.
 */
export const searchImportsParamsSchema = z.object({
  query: z.string().optional(),
  source: importSourceSchema.optional(),
  claimStatus: claimStatusSchema.optional(),
  authorName: z.string().optional(),
  authorOrcid: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export type SearchImportsParams = z.infer<typeof searchImportsParamsSchema>;

/**
 * Response for searching imports.
 */
export const searchImportsResponseSchema = z.object({
  eprints: z.array(importedEprintSchema),
  cursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type SearchImportsResponse = z.infer<typeof searchImportsResponseSchema>;

/**
 * Parameters for getting an import.
 */
export const getImportParamsSchema = z.object({
  source: importSourceSchema,
  externalId: z.string(),
});

export type GetImportParams = z.infer<typeof getImportParamsSchema>;

/**
 * Parameters for checking if an import exists.
 */
export const importExistsParamsSchema = z.object({
  source: importSourceSchema,
  externalId: z.string(),
});

export type ImportExistsParams = z.infer<typeof importExistsParamsSchema>;

/**
 * Response for checking if an import exists.
 */
export const importExistsResponseSchema = z.object({
  exists: z.boolean(),
});

export type ImportExistsResponse = z.infer<typeof importExistsResponseSchema>;
