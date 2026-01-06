/**
 * Common API schemas for request/response validation.
 *
 * @remarks
 * Provides reusable Zod schemas for pagination, response envelopes, and
 * ATProto-compliant response fields (pdsUrl for transparency).
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

import { PAGINATION } from '../config.js';

/**
 * AT URI schema.
 *
 * @remarks
 * Validates AT Protocol URI format: `at://did/collection/rkey`
 *
 * @public
 */
export const atUriSchema = z
  .string()
  .regex(
    /^at:\/\/did:[a-z]+:[a-zA-Z0-9._:%-]+\/[a-zA-Z0-9.]+\/[a-zA-Z0-9._~-]+$/,
    'Invalid AT URI format'
  )
  .describe('AT Protocol URI (at://did/collection/rkey)');

/**
 * DID schema.
 *
 * @remarks
 * Validates Decentralized Identifier format: `did:method:identifier`
 *
 * @public
 */
export const didSchema = z
  .string()
  .regex(/^did:[a-z]+:[a-zA-Z0-9._:%-]+$/, 'Invalid DID format')
  .describe('Decentralized Identifier');

/**
 * CID schema.
 *
 * @remarks
 * Validates Content Identifier format (base32 multihash).
 *
 * @public
 */
export const cidSchema = z
  .string()
  .regex(/^[a-zA-Z0-9]+$/, 'Invalid CID format')
  .describe('Content Identifier');

/**
 * Pagination query parameters schema.
 *
 * @example
 * ```typescript
 * const params = paginationQuerySchema.parse({
 *   limit: '25',
 *   cursor: 'abc123'
 * });
 * // { limit: 25, cursor: 'abc123' }
 * ```
 *
 * @public
 */
export const paginationQuerySchema = z.object({
  /**
   * Maximum items to return.
   */
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION.minLimit)
    .max(PAGINATION.maxLimit)
    .default(PAGINATION.defaultLimit)
    .describe('Maximum number of items to return'),

  /**
   * Pagination cursor for next page.
   */
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
});

/**
 * Pagination query parameters type.
 *
 * @public
 */
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Pagination response fields schema.
 *
 * @public
 */
export const paginationResponseSchema = z.object({
  /**
   * Cursor for next page (undefined if no more results).
   */
  cursor: z.string().optional().describe('Cursor for next page'),

  /**
   * Whether more results are available.
   */
  hasMore: z.boolean().describe('Whether more results are available'),

  /**
   * Total count (optional, may be expensive to compute).
   */
  total: z.number().int().optional().describe('Total result count'),
});

/**
 * Creates a paginated response schema.
 *
 * @typeParam T - Item schema type
 * @param itemSchema - Schema for list items
 * @param name - Name for the items array field
 * @returns Paginated response schema
 *
 * @example
 * ```typescript
 * const preprintListSchema = paginatedResponse(preprintSummarySchema, 'preprints');
 * ```
 *
 * @public
 */
export function paginatedResponse<T extends z.ZodTypeAny>(
  itemSchema: T,
  name = 'data'
): z.ZodObject<
  Record<
    string,
    z.ZodArray<T> | z.ZodOptional<z.ZodString> | z.ZodBoolean | z.ZodOptional<z.ZodNumber>
  >
> {
  return z.object({
    [name]: z.array(itemSchema).describe('Result items'),
    cursor: z.string().optional().describe('Cursor for next page'),
    hasMore: z.boolean().describe('Whether more results are available'),
    total: z.number().int().optional().describe('Total result count'),
  }) as z.ZodObject<
    Record<
      string,
      z.ZodArray<T> | z.ZodOptional<z.ZodString> | z.ZodBoolean | z.ZodOptional<z.ZodNumber>
    >
  >;
}

/**
 * PDS source tracking schema.
 *
 * @remarks
 * Required for ATProto compliance. All responses returning indexed data
 * must include the source PDS URL for transparency.
 *
 * @public
 */
export const pdsSourceSchema = z.object({
  /**
   * PDS endpoint URL where authoritative data lives.
   */
  pdsUrl: z.string().url().describe('Source PDS endpoint URL'),

  /**
   * Direct URL to fetch record from PDS.
   */
  pdsRecordUrl: z.string().url().optional().describe('Direct URL to fetch authoritative record'),

  /**
   * When this record was last synced from PDS.
   */
  lastSyncedAt: z.string().datetime().optional().describe('When record was last synced from PDS'),
});

/**
 * PDS source type.
 *
 * @public
 */
export type PDSSource = z.infer<typeof pdsSourceSchema>;

/**
 * Index metadata schema.
 *
 * @remarks
 * Metadata about when and how a record was indexed.
 *
 * @public
 */
export const indexMetadataSchema = z.object({
  /**
   * When the record was indexed by Chive.
   */
  indexedAt: z.string().datetime().describe('When record was indexed'),

  /**
   * CID of the indexed record version.
   */
  cid: cidSchema.describe('Content identifier of indexed version'),
});

/**
 * Author reference schema.
 *
 * @public
 */
export const authorRefSchema = z.object({
  /**
   * Author's DID.
   */
  did: didSchema,

  /**
   * Author's handle (e.g., "alice.bsky.social").
   */
  handle: z.string().optional().describe('Author handle'),

  /**
   * Display name.
   */
  displayName: z.string().optional().describe('Display name'),

  /**
   * Avatar URL.
   */
  avatar: z.string().url().optional().describe('Avatar URL'),
});

/**
 * Author reference type.
 *
 * @public
 */
export type AuthorRef = z.infer<typeof authorRefSchema>;

/**
 * Timestamp query parameter schema.
 *
 * @remarks
 * Parses ISO 8601 datetime strings from query parameters.
 *
 * @public
 */
export const timestampQuerySchema = z.string().datetime().optional().describe('ISO 8601 datetime');

/**
 * Sort order schema.
 *
 * @public
 */
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc').describe('Sort order');

/**
 * Search query schema.
 *
 * @public
 */
export const searchQuerySchema = z.object({
  /**
   * Search query string.
   */
  q: z.string().min(1).max(500).describe('Search query'),

  /**
   * Pagination limit.
   */
  limit: z.coerce.number().int().min(1).max(100).default(50).describe('Maximum results'),

  /**
   * Pagination cursor.
   */
  cursor: z.string().optional().describe('Pagination cursor'),

  /**
   * Sort order.
   */
  sort: z.enum(['relevance', 'date', 'views']).default('relevance').describe('Sort order'),
});

/**
 * Search query type.
 *
 * @public
 */
export type SearchQueryParams = z.infer<typeof searchQuerySchema>;
