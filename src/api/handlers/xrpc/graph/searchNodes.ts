/**
 * XRPC handler for pub.chive.graph.searchNodes.
 *
 * @remarks
 * Full-text search for knowledge graph nodes with optional filtering.
 *
 * @packageDocumentation
 * @public
 */

import type { GraphNode } from '../../../../lexicons/generated/types/pub/chive/graph/listNodes.js';
import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/graph/searchNodes.js';
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
 * XRPC method for pub.chive.graph.searchNodes query.
 *
 * @public
 */
export const searchNodes: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { nodeService, personalGraph } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

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
      kind: params.kind as 'type' | 'object' | undefined,
      subkind: params.subkind,
      status: params.status as
        | 'proposed'
        | 'provisional'
        | 'established'
        | 'deprecated'
        | undefined,
      limit,
      cursor: params.cursor,
    });

    let mergedNodes: GraphNode[] = result.nodes.map(mapNodeToResponse);

    // When authenticated, merge personal graph nodes into results
    if (user?.did && personalGraph) {
      const personalNodes = await personalGraph
        .searchPersonalNodes(user.did, params.query, {
          subkind: params.subkind,
          limit,
        })
        .catch(() => []);

      if (personalNodes.length > 0) {
        const existingUris = new Set(mergedNodes.map((n) => n.uri));

        const personalMapped: GraphNode[] = personalNodes
          .filter((pn) => !existingUris.has(pn.uri as string))
          .map((pn) => ({
            id: pn.id,
            uri: pn.uri as string,
            kind: pn.kind,
            subkind: pn.subkind,
            label: pn.label,
            alternateLabels: pn.alternateLabels,
            description: pn.description,
            metadata: pn.metadata as GraphNode['metadata'],
            status: pn.status,
            createdAt: pn.createdAt.toISOString(),
            isPersonal: true,
          }));

        // Prepend personal nodes so they appear first
        mergedNodes = [...personalMapped, ...mergedNodes];
      }
    }

    const response: OutputSchema = {
      nodes: mergedNodes,
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

    return { encoding: 'application/json', body: response };
  },
};
