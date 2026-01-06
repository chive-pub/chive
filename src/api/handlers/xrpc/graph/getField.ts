/**
 * XRPC handler for pub.chive.graph.getField.
 *
 * @remarks
 * Retrieves a knowledge graph field by ID with optional relationships,
 * children, and ancestor path.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { NotFoundError } from '../../../../types/errors.js';
import {
  getFieldParamsSchema,
  fieldDetailSchema,
  type GetFieldParams,
  type FieldDetail,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.graph.getField query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Field details with optional relationships and hierarchy
 * @throws NotFoundError if field not found
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.graph.getField?id=physics&includeChildren=true
 *
 * Response:
 * {
 *   "id": "physics",
 *   "name": "Physics",
 *   "children": [...],
 *   "ancestors": [{ "id": "science", "name": "Science" }]
 * }
 * ```
 *
 * @public
 */
export async function getFieldHandler(
  c: Context<ChiveEnv>,
  params: GetFieldParams
): Promise<FieldDetail> {
  const { graph } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Getting field', {
    id: params.id,
    includeRelationships: params.includeRelationships,
    includeChildren: params.includeChildren,
  });

  const field = await graph.getField(params.id);

  if (!field) {
    throw new NotFoundError('Field', params.id);
  }

  // Build response from typed FieldDetail
  const response: FieldDetail = {
    id: field.id,
    uri: field.uri,
    name: field.name,
    description: field.description,
    parentId: field.parentId,
    status: field.status,
    preprintCount: field.preprintCount,
    externalIds: field.externalIds?.map((ext) => ({
      source: ext.source as 'wikidata' | 'lcsh' | 'fast' | 'mesh' | 'arxiv',
      id: ext.id,
      url: ext.url,
    })),
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt?.toISOString(),
  };

  // Fetch related fields if requested
  if (params.includeRelationships) {
    const related = await graph.getRelatedFields(params.id, 1);
    response.relationships = related.map((r) => ({
      type: r.type as
        | 'broader'
        | 'narrower'
        | 'related'
        | 'equivalent'
        | 'influences'
        | 'influenced_by',
      targetId: r.targetId,
      targetName: r.targetName,
      strength: r.strength,
    }));
  }

  // Fetch child fields if requested
  if (params.includeChildren) {
    const children = await graph.getChildFields(params.id);
    response.children = children.map((child) => ({
      id: child.id,
      name: child.name,
      preprintCount: child.preprintCount,
    }));
  }

  // Fetch ancestor path if requested
  if (params.includeAncestors) {
    const ancestors = await graph.getAncestorPath(params.id);
    response.ancestors = ancestors.map((ancestor) => ({
      id: ancestor.id,
      name: ancestor.name,
    }));
  }

  logger.info('Field retrieved', {
    id: params.id,
    hasRelationships: !!response.relationships?.length,
    hasChildren: !!response.children?.length,
    hasAncestors: !!response.ancestors?.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.getField.
 *
 * @public
 */
export const getFieldEndpoint: XRPCEndpoint<GetFieldParams, FieldDetail> = {
  method: 'pub.chive.graph.getField' as never,
  type: 'query',
  description: 'Get a knowledge graph field by ID',
  inputSchema: getFieldParamsSchema,
  outputSchema: fieldDetailSchema,
  handler: getFieldHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
