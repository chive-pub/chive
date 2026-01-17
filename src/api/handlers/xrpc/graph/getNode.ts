/**
 * XRPC handler for pub.chive.graph.getNode.
 *
 * @remarks
 * Retrieves a unified knowledge graph node by AT-URI.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { NotFoundError } from '../../../../types/errors.js';
import {
  getNodeParamsSchema,
  nodeWithEdgesSchema,
  type GetNodeParams,
  type NodeWithEdges,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Convert a value to ISO string, handling both Date objects and strings.
 * This handles dates that have been serialized through JSON (e.g., Redis cache).
 */
function toISOString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  // Already a string (from JSON deserialization)
  return value;
}

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
  createdAt: Date | string;
  createdBy?: string;
  updatedAt?: Date | string;
}): NodeWithEdges {
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
    metadata: node.metadata as NodeWithEdges['metadata'],
    status: node.status as 'proposed' | 'provisional' | 'established' | 'deprecated',
    deprecatedBy: node.deprecatedBy,
    proposalUri: node.proposalUri,
    createdAt: toISOString(node.createdAt),
    createdBy: node.createdBy,
    updatedAt: node.updatedAt ? toISOString(node.updatedAt) : undefined,
  };
}

/**
 * Handler for pub.chive.graph.getNode query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Node details with optional edges
 * @throws NotFoundError if node not found
 *
 * @public
 */
export async function getNodeHandler(
  c: Context<ChiveEnv>,
  params: GetNodeParams
): Promise<NodeWithEdges> {
  const { nodeService, edgeService } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Getting node', { id: params.id, includeEdges: params.includeEdges });

  const node = await nodeService.getNodeById(params.id);

  if (!node) {
    throw new NotFoundError('Node', params.id);
  }

  const response = mapNodeToResponse(node);

  if (params.includeEdges) {
    const edgeResult = await edgeService.listEdges({ sourceUri: node.uri });
    response.edges = edgeResult.edges.map((edge) => ({
      id: edge.id,
      uri: edge.uri,
      sourceUri: edge.sourceUri,
      targetUri: edge.targetUri,
      relationUri: edge.relationUri,
      relationSlug: edge.relationSlug,
      weight: edge.weight,
      metadata: edge.metadata
        ? {
            confidence: edge.metadata.confidence,
            startDate: edge.metadata.startDate?.toISOString(),
            endDate: edge.metadata.endDate?.toISOString(),
            source: edge.metadata.source,
          }
        : undefined,
      status: edge.status as 'proposed' | 'established' | 'deprecated',
      proposalUri: edge.proposalUri,
      createdAt: edge.createdAt.toISOString(),
      createdBy: edge.createdBy,
      updatedAt: edge.updatedAt?.toISOString(),
    }));
  }

  logger.info('Node retrieved', { id: params.id, hasEdges: !!response.edges?.length });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.getNode.
 *
 * @public
 */
export const getNodeEndpoint: XRPCEndpoint<GetNodeParams, NodeWithEdges> = {
  method: 'pub.chive.graph.getNode' as never,
  type: 'query',
  description: 'Get a knowledge graph node by ID',
  inputSchema: getNodeParamsSchema,
  outputSchema: nodeWithEdgesSchema,
  handler: getNodeHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
