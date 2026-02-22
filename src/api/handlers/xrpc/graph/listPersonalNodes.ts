/**
 * XRPC handler for pub.chive.graph.listPersonalNodes.
 *
 * @remarks
 * Lists the authenticated user's personal graph nodes with optional
 * filtering by subkind. Requires authentication since personal nodes
 * are private to their owner.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  PersonalNodeView,
} from '../../../../lexicons/generated/types/pub/chive/graph/listPersonalNodes.js';
import { AuthenticationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Default number of personal nodes per page.
 */
const DEFAULT_LIMIT = 50;

/**
 * Maximum number of personal nodes per page.
 */
const MAX_LIMIT = 100;

/** Re-exported query parameters for pub.chive.graph.listPersonalNodes. */
export type ListPersonalNodesParams = QueryParams;

/** Re-exported personal node view type. */
export type { PersonalNodeView };

/** Re-exported output schema for pub.chive.graph.listPersonalNodes. */
export type ListPersonalNodesOutput = OutputSchema;

/**
 * XRPC method for pub.chive.graph.listPersonalNodes query.
 *
 * @public
 */
export const listPersonalNodes: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: true,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { personalGraph } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    if (!user?.did) {
      throw new AuthenticationError('Authentication required');
    }

    if (!personalGraph) {
      return {
        encoding: 'application/json',
        body: { nodes: [] },
      };
    }

    const limit = Math.min(
      typeof params.limit === 'number' ? params.limit : DEFAULT_LIMIT,
      MAX_LIMIT
    );
    logger.debug('Listing personal nodes', {
      did: user.did,
      limit,
      subkind: params.subkind,
    });

    const nodes = await personalGraph.searchPersonalNodes(user.did, '', {
      subkind: params.subkind,
      limit,
    });

    const response: OutputSchema = {
      nodes: nodes.map((node) => ({
        uri: node.uri as string,
        id: node.id,
        kind: node.kind,
        subkind: node.subkind,
        label: node.label,
        alternateLabels: node.alternateLabels,
        description: node.description,
        status: node.status,
        createdAt: node.createdAt.toISOString(),
      })),
    };

    logger.info('Personal nodes listed', {
      did: user.did,
      count: response.nodes.length,
      subkind: params.subkind,
    });

    return { encoding: 'application/json', body: response };
  },
};
