/**
 * XRPC handler for pub.chive.backlink.list.
 *
 * @remarks
 * Lists backlinks to a preprint from ATProto ecosystem sources including
 * Semble collections, Leaflet lists, Whitewind blogs, and Bluesky shares.
 *
 * **ATProto Compliance:**
 * - Read-only query from Chive's backlink index
 * - Never writes to user PDSes
 * - Index data rebuildable from firehose events
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  listBacklinksParamsSchema,
  listBacklinksResponseSchema,
  type ListBacklinksParams,
  type ListBacklinksResponse,
} from '../../../schemas/backlink.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.backlink.list query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Paginated list of backlinks to the target preprint
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.backlink.list?targetUri=at://did:plc:abc/pub.chive.preprint.submission/xyz&limit=20
 *
 * Response:
 * {
 *   "backlinks": [
 *     {
 *       "id": 1,
 *       "sourceUri": "at://did:plc:def/app.bsky.feed.post/ghi",
 *       "sourceType": "bluesky.post",
 *       "targetUri": "at://did:plc:abc/pub.chive.preprint.submission/xyz",
 *       "indexedAt": "2024-01-15T10:00:00Z",
 *       "deleted": false
 *     }
 *   ],
 *   "cursor": "next_page_cursor",
 *   "hasMore": true
 * }
 * ```
 *
 * @public
 */
export async function listBacklinksHandler(
  c: Context<ChiveEnv>,
  params: ListBacklinksParams
): Promise<ListBacklinksResponse> {
  const logger = c.get('logger');
  const { backlink } = c.get('services');

  // Debug logging for E2E test debugging
  logger.info('listBacklinks called', {
    targetUri: params.targetUri,
    sourceType: params.sourceType,
    limit: params.limit,
    cursor: params.cursor,
  });

  const result = await backlink.getBacklinks(params.targetUri, {
    sourceType: params.sourceType,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  });

  // Debug: log result count
  logger.info('listBacklinks result', {
    targetUri: params.targetUri,
    sourceType: params.sourceType,
    backlinksCount: result.backlinks.length,
    hasCursor: !!result.cursor,
  });

  return {
    backlinks: result.backlinks.map((bl) => ({
      id: bl.id,
      sourceUri: bl.sourceUri,
      sourceType: bl.sourceType,
      targetUri: bl.targetUri,
      context: bl.context,
      indexedAt: bl.indexedAt.toISOString(),
      deleted: bl.deleted,
    })),
    cursor: result.cursor,
    hasMore: result.cursor !== undefined,
  };
}

/**
 * Endpoint definition for pub.chive.backlink.list.
 *
 * @public
 */
export const listBacklinksEndpoint: XRPCEndpoint<ListBacklinksParams, ListBacklinksResponse> = {
  method: 'pub.chive.backlink.list' as never,
  type: 'query',
  description: 'List backlinks to a preprint',
  inputSchema: listBacklinksParamsSchema,
  outputSchema: listBacklinksResponseSchema,
  handler: listBacklinksHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
