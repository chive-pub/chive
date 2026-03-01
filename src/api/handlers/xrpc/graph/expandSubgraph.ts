/**
 * XRPC handler for pub.chive.graph.expandSubgraph.
 *
 * @remarks
 * Expands a subgraph from root URIs using server-side breadth-first search.
 * This replaces client-side BFS that would otherwise require 100+ sequential
 * API calls. Public endpoint (no authentication required) since personal
 * graph data is accessible to all.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/graph/expandSubgraph.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Default BFS depth when not specified.
 */
const DEFAULT_DEPTH = 2;

/**
 * Default maximum nodes when not specified.
 */
const DEFAULT_MAX_NODES = 100;

/**
 * Maximum allowed root URIs per request.
 */
const MAX_ROOT_URIS = 10;

/**
 * XRPC method for pub.chive.graph.expandSubgraph query.
 *
 * @public
 */
export const expandSubgraph: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { personalGraph } = c.get('services');
    const logger = c.get('logger');

    if (!params.rootUris || params.rootUris.length === 0) {
      throw new ValidationError('At least one root URI is required', 'rootUris', 'required');
    }

    if (params.rootUris.length > MAX_ROOT_URIS) {
      throw new ValidationError(
        `At most ${MAX_ROOT_URIS} root URIs allowed`,
        'rootUris',
        'max_length'
      );
    }

    if (!personalGraph) {
      return {
        encoding: 'application/json',
        body: { nodes: [], edges: [], truncated: false },
      };
    }

    const depth = typeof params.depth === 'number' ? params.depth : DEFAULT_DEPTH;
    const maxNodes = typeof params.maxNodes === 'number' ? params.maxNodes : DEFAULT_MAX_NODES;

    logger.debug('Expanding subgraph', {
      rootUris: params.rootUris,
      depth,
      edgeTypes: params.edgeTypes,
      maxNodes,
    });

    const result = await personalGraph.expandSubgraph(params.rootUris, {
      depth,
      edgeTypes: params.edgeTypes,
      maxNodes,
    });

    if (!result.ok) {
      logger.error('Subgraph expansion failed', result.error, {
        rootUris: params.rootUris,
      });
      return {
        encoding: 'application/json',
        body: { nodes: [], edges: [], truncated: false },
      };
    }

    const { nodes, edges, truncated } = result.value;

    logger.info('Subgraph expanded', {
      rootCount: params.rootUris.length,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      truncated,
    });

    return {
      encoding: 'application/json',
      body: {
        nodes: nodes.map((node) => ({
          uri: node.uri,
          label: node.label,
          kind: node.kind,
          subkind: node.subkind,
          description: node.description,
          metadata: node.metadata,
        })),
        edges: edges.map((edge) => ({
          uri: edge.uri,
          sourceUri: edge.sourceUri,
          targetUri: edge.targetUri,
          relationSlug: edge.relationSlug,
          label: edge.label,
          weight: edge.weight,
        })),
        truncated,
      },
    };
  },
};
