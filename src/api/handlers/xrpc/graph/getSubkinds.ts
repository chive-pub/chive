/**
 * XRPC handler for pub.chive.graph.getSubkinds.
 *
 * @remarks
 * Lists available subkind type nodes (nodes with subkind=subkind).
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/graph/getSubkinds.js';
import type { GraphNode } from '../../../../lexicons/generated/types/pub/chive/graph/listNodes.js';
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
 * XRPC method for pub.chive.graph.getSubkinds query.
 *
 * @public
 */
export const getSubkinds: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ c }): Promise<XRPCResponse<OutputSchema>> => {
    const { nodeService } = c.get('services');
    const logger = c.get('logger');

    logger.debug('Getting subkinds');

    const subkinds = await nodeService.getSubkinds();

    const response: OutputSchema = {
      subkinds: subkinds.map(mapNodeToResponse),
    };

    logger.info('Subkinds retrieved', { count: subkinds.length });

    return { encoding: 'application/json', body: response };
  },
};
