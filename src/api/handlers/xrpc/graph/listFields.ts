/**
 * XRPC handler for pub.chive.graph.listFields.
 *
 * @remarks
 * Lists knowledge graph fields with optional filtering by status
 * and parent field.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  listFieldsParamsSchema,
  fieldListResponseSchema,
  type ListFieldsParams,
  type FieldListResponse,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.graph.listFields query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Paginated list of fields
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.graph.listFields?status=approved&limit=50
 *
 * Response:
 * {
 *   "fields": [...],
 *   "total": 150,
 *   "hasMore": true,
 *   "cursor": "50"
 * }
 * ```
 *
 * @public
 */
export async function listFieldsHandler(
  c: Context<ChiveEnv>,
  params: ListFieldsParams
): Promise<FieldListResponse> {
  const { graph } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Listing fields', {
    status: params.status,
    parentId: params.parentId,
    limit: params.limit,
    cursor: params.cursor,
  });

  const result = await graph.listFields({
    status: params.status,
    parentId: params.parentId,
    limit: params.limit,
    cursor: params.cursor,
  });

  // Map to response schema
  const response: FieldListResponse = {
    fields: result.fields.map((f) => ({
      id: f.id,
      uri: f.uri,
      name: f.name,
      description: f.description,
      parentId: f.parentId,
      status: f.status as 'proposed' | 'under_review' | 'approved' | 'deprecated',
      preprintCount: f.preprintCount,
      externalIds: f.externalIds?.map((ext) => ({
        source: ext.source as 'wikidata' | 'lcsh' | 'fast' | 'mesh' | 'arxiv',
        id: ext.id,
        url: ext.url,
      })),
      createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
      updatedAt: f.updatedAt instanceof Date ? f.updatedAt.toISOString() : f.updatedAt,
    })),
    total: result.total,
    hasMore: result.hasMore,
    cursor: result.cursor,
  };

  logger.info('Fields listed', {
    count: response.fields.length,
    total: response.total,
    hasMore: response.hasMore,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.listFields.
 *
 * @public
 */
export const listFieldsEndpoint: XRPCEndpoint<ListFieldsParams, FieldListResponse> = {
  method: 'pub.chive.graph.listFields' as never,
  type: 'query',
  description: 'List knowledge graph fields',
  inputSchema: listFieldsParamsSchema,
  outputSchema: fieldListResponseSchema,
  handler: listFieldsHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
