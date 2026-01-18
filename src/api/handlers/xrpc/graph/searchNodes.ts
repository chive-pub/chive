/**
 * XRPC handler for pub.chive.graph.searchNodes.
 *
 * @remarks
 * Full-text search for knowledge graph nodes with optional filtering.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  searchNodesParamsSchema,
  nodeSearchResponseSchema,
  type SearchNodesParams,
  type NodeSearchResponse,
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
 * Handler for pub.chive.graph.searchNodes query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated search parameters
 * @returns Nodes matching search criteria
 *
 * @public
 */
export async function searchNodesHandler(
  c: Context<ChiveEnv>,
  params: SearchNodesParams
): Promise<NodeSearchResponse> {
  const { nodeService } = c.get('services');
  const logger = c.get('logger');

  const limit = params.limit ?? 20;

  logger.debug('Searching nodes', {
    query: params.query,
    kind: params.kind,
    subkind: params.subkind,
    status: params.status,
    limit,
    cursor: params.cursor,
  });

  const result = await nodeService.searchNodes(params.query, {
    kind: params.kind,
    subkind: params.subkind,
    status: params.status,
    limit,
    cursor: params.cursor,
  });

  const response: NodeSearchResponse = {
    nodes: result.nodes.map(mapNodeToResponse),
    cursor: result.cursor,
    hasMore: result.hasMore ?? result.nodes.length >= limit,
    total: result.total,
  };

  logger.info('Node search completed', {
    query: params.query,
    total: result.total,
    returned: response.nodes.length,
    hasMore: response.hasMore,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.searchNodes.
 *
 * @public
 */
export const searchNodesEndpoint: XRPCEndpoint<SearchNodesParams, NodeSearchResponse> = {
  method: 'pub.chive.graph.searchNodes' as never,
  type: 'query',
  description: 'Search knowledge graph nodes',
  inputSchema: searchNodesParamsSchema,
  outputSchema: nodeSearchResponseSchema,
  handler: searchNodesHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
