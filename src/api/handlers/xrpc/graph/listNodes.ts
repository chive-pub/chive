/**
 * XRPC handler for pub.chive.graph.listNodes.
 *
 * @remarks
 * Lists knowledge graph nodes with optional filtering by kind, subkind, and status.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
  GraphNode,
} from '../../../../lexicons/generated/types/pub/chive/graph/listNodes.js';
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
 * XRPC method for pub.chive.graph.listNodes query.
 *
 * @public
 */
export const listNodes: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { nodeService } = c.get('services');
    const logger = c.get('logger');

    logger.debug('Listing nodes', {
      kind: params.kind,
      subkind: params.subkind,
      status: params.status,
      limit: params.limit,
    });

    const result = await nodeService.listNodes({
      kind: params.kind as 'type' | 'object' | undefined,
      subkind: params.subkind,
      status: params.status as
        | 'proposed'
        | 'provisional'
        | 'established'
        | 'deprecated'
        | undefined,
      limit: params.limit,
      cursor: params.cursor,
    });

    const response: OutputSchema = {
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

    return { encoding: 'application/json', body: response };
  },
};
