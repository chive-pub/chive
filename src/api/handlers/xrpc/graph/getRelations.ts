/**
 * XRPC handler for pub.chive.graph.getRelations.
 *
 * @remarks
 * Lists available relation types (nodes with subkind=relation).
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/graph/getRelations.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.graph.getRelations query.
 *
 * @public
 */
export const getRelations: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ c }): Promise<XRPCResponse<OutputSchema>> => {
    const { edgeService } = c.get('services');
    const logger = c.get('logger');

    logger.debug('Getting relations');

    const relations = await edgeService.getRelationTypes();

    const response: OutputSchema = {
      relations: relations.map((rel) => ({
        slug: rel.slug,
        label: rel.label,
        description: rel.description,
        inverseSlug: rel.inverseSlug,
      })),
    };

    logger.info('Relations retrieved', { count: relations.length });

    return { encoding: 'application/json', body: response };
  },
};
