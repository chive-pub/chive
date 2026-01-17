/**
 * XRPC handler for pub.chive.graph.getHierarchy.
 *
 * @remarks
 * Gets hierarchical tree structure for nodes of a specific subkind.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { NodeHierarchy } from '../../../../storage/neo4j/types.js';
import {
  getHierarchyParamsSchema,
  hierarchyResponseSchema,
  type GetHierarchyParams,
  type HierarchyResponse,
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
 * Recursively maps hierarchy to response format.
 */
function mapHierarchyToResponse(hierarchy: NodeHierarchy): HierarchyResponse['roots'][number] {
  return {
    node: mapNodeToResponse(hierarchy.node),
    children: hierarchy.children.map(mapHierarchyToResponse),
    depth: hierarchy.depth,
  };
}

/**
 * Handler for pub.chive.graph.getHierarchy query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Hierarchical tree structure
 *
 * @public
 */
export async function getHierarchyHandler(
  c: Context<ChiveEnv>,
  params: GetHierarchyParams
): Promise<HierarchyResponse> {
  const { nodeService } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Getting hierarchy', {
    subkind: params.subkind,
    relationSlug: params.relationSlug,
  });

  const hierarchy = await nodeService.getHierarchy(params.subkind);

  const response: HierarchyResponse = {
    roots: hierarchy.map(mapHierarchyToResponse),
    subkind: params.subkind,
    relationSlug: params.relationSlug,
  };

  logger.info('Hierarchy retrieved', {
    subkind: params.subkind,
    rootCount: hierarchy.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.getHierarchy.
 *
 * @public
 */
export const getHierarchyEndpoint: XRPCEndpoint<GetHierarchyParams, HierarchyResponse> = {
  method: 'pub.chive.graph.getHierarchy' as never,
  type: 'query',
  description: 'Get hierarchical tree structure for a subkind',
  inputSchema: getHierarchyParamsSchema,
  outputSchema: hierarchyResponseSchema,
  handler: getHierarchyHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
