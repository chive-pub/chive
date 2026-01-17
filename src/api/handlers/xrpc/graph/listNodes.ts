/**
 * XRPC handler for pub.chive.graph.listNodes.
 *
 * @remarks
 * Lists knowledge graph nodes with optional filtering by kind, subkind, and status.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  listNodesParamsSchema,
  nodeListResponseSchema,
  type ListNodesParams,
  type NodeListResponse,
  type GraphNodeResponse,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Maps a GraphNode to API response format.
 */
function mapNodeToResponse(node: {
  id: string;
  uri: string;
  kind: string;
  subkind?: string;
  subkindUri?: string;
  label: string;
  alternateLabels?: string[];
  description?: string;
  externalIds?: {
    system: string;
    identifier: string;
    uri?: string;
    matchType?: string;
  }[];
  metadata?: Record<string, unknown>;
  status: string;
  deprecatedBy?: string;
  proposalUri?: string;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
}): GraphNodeResponse {
  return {
    id: node.id,
    uri: node.uri,
    kind: node.kind as 'type' | 'object',
    subkind: node.subkind,
    subkindUri: node.subkindUri,
    label: node.label,
    alternateLabels: node.alternateLabels,
    description: node.description,
    externalIds: node.externalIds?.map((ext) => ({
      system: ext.system as
        | 'wikidata'
        | 'ror'
        | 'orcid'
        | 'isni'
        | 'viaf'
        | 'lcsh'
        | 'fast'
        | 'credit'
        | 'spdx'
        | 'fundref'
        | 'mesh'
        | 'aat'
        | 'gnd'
        | 'anzsrc'
        | 'arxiv',
      identifier: ext.identifier,
      uri: ext.uri,
      matchType: ext.matchType as
        | 'exact'
        | 'close'
        | 'broader'
        | 'narrower'
        | 'related'
        | undefined,
    })),
    metadata: node.metadata as GraphNodeResponse['metadata'],
    status: node.status as 'proposed' | 'provisional' | 'established' | 'deprecated',
    deprecatedBy: node.deprecatedBy,
    proposalUri: node.proposalUri,
    createdAt: node.createdAt.toISOString(),
    createdBy: node.createdBy,
    updatedAt: node.updatedAt?.toISOString(),
  };
}

/**
 * Handler for pub.chive.graph.listNodes query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Node list with pagination
 *
 * @public
 */
export async function listNodesHandler(
  c: Context<ChiveEnv>,
  params: ListNodesParams
): Promise<NodeListResponse> {
  const { nodeService } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Listing nodes', {
    kind: params.kind,
    subkind: params.subkind,
    status: params.status,
    limit: params.limit,
  });

  const result = await nodeService.listNodes({
    kind: params.kind,
    subkind: params.subkind,
    status: params.status,
    limit: params.limit,
    cursor: params.cursor,
  });

  const response: NodeListResponse = {
    nodes: result.nodes.map(mapNodeToResponse),
    cursor: result.cursor,
    hasMore: result.hasMore,
    total: result.total,
  };

  logger.info('Nodes listed', {
    kind: params.kind,
    subkind: params.subkind,
    total: result.total,
    returned: response.nodes.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.listNodes.
 *
 * @public
 */
export const listNodesEndpoint: XRPCEndpoint<ListNodesParams, NodeListResponse> = {
  method: 'pub.chive.graph.listNodes' as never,
  type: 'query',
  description: 'List knowledge graph nodes with optional filtering',
  inputSchema: listNodesParamsSchema,
  outputSchema: nodeListResponseSchema,
  handler: listNodesHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
