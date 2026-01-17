/**
 * XRPC handler for pub.chive.graph.getRelations.
 *
 * @remarks
 * Lists available relation types (nodes with subkind=relation).
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import { relationsResponseSchema, type RelationsResponse } from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.graph.getRelations query.
 *
 * @param c - Hono context with Chive environment
 * @returns Available relation types
 *
 * @public
 */
export async function getRelationsHandler(c: Context<ChiveEnv>): Promise<RelationsResponse> {
  const { edgeService } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Getting relations');

  const relations = await edgeService.getRelationTypes();

  const response: RelationsResponse = {
    relations: relations.map((rel) => ({
      slug: rel.slug,
      label: rel.label,
      description: rel.description,
      inverseSlug: rel.inverseSlug,
    })),
  };

  logger.info('Relations retrieved', { count: relations.length });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.getRelations.
 *
 * @public
 */
export const getRelationsEndpoint: XRPCEndpoint<Record<string, never>, RelationsResponse> = {
  method: 'pub.chive.graph.getRelations' as never,
  type: 'query',
  description: 'Get available relation types',
  inputSchema: z.object({}),
  outputSchema: relationsResponseSchema,
  handler: getRelationsHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
