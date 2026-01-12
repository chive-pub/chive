/**
 * Handler for pub.chive.graph.getFieldEprints.
 *
 * @remarks
 * Returns eprints associated with a specific knowledge graph field.
 * Supports pagination and sorting.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { NotFoundError } from '../../../../types/errors.js';
import {
  getFieldEprintsParamsSchema,
  fieldEprintsResponseSchema,
  type GetFieldEprintsParams,
  type FieldEprintsResponse,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.graph.getFieldEprints.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Eprints in the specified field
 *
 * @throws {NotFoundError} When field is not found
 */
export async function getFieldEprintsHandler(
  c: Context<ChiveEnv>,
  params: GetFieldEprintsParams
): Promise<FieldEprintsResponse> {
  const logger = c.get('logger');
  const { graph, metrics } = c.get('services');

  logger.debug('Getting field eprints', { fieldId: params.fieldId });

  // Verify field exists
  const field = await graph.getField(params.fieldId);
  if (!field) {
    throw new NotFoundError('Field', params.fieldId);
  }

  // Get eprints for this field using faceted browse
  const browseResult = await graph.browseFaceted({
    facets: {
      personality: [params.fieldId],
    },
    limit: params.limit ?? 20,
    cursor: params.cursor,
  });

  // Enrich with view counts
  const eprintsWithViews = await Promise.all(
    browseResult.eprints.map(async (p) => {
      const viewCount = await metrics.getViewCount(p.uri);
      // Get primary author (first in order) for display
      const primaryAuthor = p.authors.find((a) => a.order === 1) ?? p.authors[0];
      return {
        uri: p.uri as string,
        title: p.title,
        abstract: p.abstract?.slice(0, 500), // Truncate abstract for summary
        authorDid: primaryAuthor?.did ?? p.submittedBy,
        authorName: primaryAuthor?.name,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
        pdsUrl: p.source.pdsEndpoint,
        views: viewCount,
      };
    })
  );

  return {
    eprints: eprintsWithViews,
    cursor: browseResult.cursor,
    hasMore: browseResult.hasMore,
    total: browseResult.total,
  };
}

/**
 * Endpoint definition for pub.chive.graph.getFieldEprints.
 *
 * @public
 */
export const getFieldEprintsEndpoint: XRPCEndpoint<
  GetFieldEprintsParams,
  FieldEprintsResponse
> = {
  method: 'pub.chive.graph.getFieldEprints' as never,
  type: 'query',
  description: 'Get eprints in a knowledge graph field',
  inputSchema: getFieldEprintsParamsSchema,
  outputSchema: fieldEprintsResponseSchema,
  handler: getFieldEprintsHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
