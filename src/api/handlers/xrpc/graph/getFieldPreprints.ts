/**
 * Handler for pub.chive.graph.getFieldPreprints.
 *
 * @remarks
 * Returns preprints associated with a specific knowledge graph field.
 * Supports pagination and sorting.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { NotFoundError } from '../../../../types/errors.js';
import {
  getFieldPreprintsParamsSchema,
  fieldPreprintsResponseSchema,
  type GetFieldPreprintsParams,
  type FieldPreprintsResponse,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.graph.getFieldPreprints.
 *
 * @param c - Hono context
 * @param params - Request parameters
 * @returns Preprints in the specified field
 *
 * @throws {NotFoundError} When field is not found
 */
export async function getFieldPreprintsHandler(
  c: Context<ChiveEnv>,
  params: GetFieldPreprintsParams
): Promise<FieldPreprintsResponse> {
  const logger = c.get('logger');
  const { graph, metrics } = c.get('services');

  logger.debug('Getting field preprints', { fieldId: params.fieldId });

  // Verify field exists
  const field = await graph.getField(params.fieldId);
  if (!field) {
    throw new NotFoundError('Field', params.fieldId);
  }

  // Get preprints for this field using faceted browse
  const browseResult = await graph.browseFaceted({
    facets: {
      personality: [params.fieldId],
    },
    limit: params.limit ?? 20,
    cursor: params.cursor,
  });

  // Enrich with view counts
  const preprintsWithViews = await Promise.all(
    browseResult.preprints.map(async (p) => {
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
    preprints: preprintsWithViews,
    cursor: browseResult.cursor,
    hasMore: browseResult.hasMore,
    total: browseResult.total,
  };
}

/**
 * Endpoint definition for pub.chive.graph.getFieldPreprints.
 *
 * @public
 */
export const getFieldPreprintsEndpoint: XRPCEndpoint<
  GetFieldPreprintsParams,
  FieldPreprintsResponse
> = {
  method: 'pub.chive.graph.getFieldPreprints' as never,
  type: 'query',
  description: 'Get preprints in a knowledge graph field',
  inputSchema: getFieldPreprintsParamsSchema,
  outputSchema: fieldPreprintsResponseSchema,
  handler: getFieldPreprintsHandler,
  auth: 'optional',
  rateLimit: 'anonymous',
};
