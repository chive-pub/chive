/**
 * XRPC handler for pub.chive.graph.getHierarchy.
 *
 * @remarks
 * Gets hierarchical tree structure for nodes of a specific subkind.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  HierarchyItem,
} from '../../../../lexicons/generated/types/pub/chive/graph/getHierarchy.js';
import type { GraphNode } from '../../../../lexicons/generated/types/pub/chive/graph/listNodes.js';
import type { NodeHierarchy } from '../../../../storage/neo4j/types.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Maps a GraphNode to API response format.
 */
function mapNodeToResponse(node: {
  id: string;
  uri: string;
  cid?: string;
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
}): GraphNode {
  return {
    id: node.id,
    uri: node.uri,
    cid: node.cid,
    kind: node.kind,
    subkind: node.subkind,
    subkindUri: node.subkindUri,
    label: node.label,
    alternateLabels: node.alternateLabels,
    description: node.description,
    externalIds: node.externalIds?.map((ext) => ({
      system: ext.system,
      identifier: ext.identifier,
      uri: ext.uri,
      matchType: ext.matchType,
    })),
    metadata: node.metadata as GraphNode['metadata'],
    status: node.status,
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
function mapHierarchyToResponse(hierarchy: NodeHierarchy): HierarchyItem {
  return {
    node: mapNodeToResponse(hierarchy.node),
    children: hierarchy.children.map(mapHierarchyToResponse),
    depth: hierarchy.depth,
  };
}

/**
 * XRPC method for pub.chive.graph.getHierarchy query.
 *
 * @public
 */
export const getHierarchy: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { nodeService } = c.get('services');
    const logger = c.get('logger');

    logger.debug('Getting hierarchy', {
      subkind: params.subkind,
      relationSlug: params.relationSlug,
    });

    const hierarchy = await nodeService.getHierarchy(params.subkind);

    const response: OutputSchema = {
      roots: hierarchy.map(mapHierarchyToResponse),
      subkind: params.subkind,
      relationSlug: params.relationSlug,
    };

    logger.info('Hierarchy retrieved', {
      subkind: params.subkind,
      rootCount: hierarchy.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
