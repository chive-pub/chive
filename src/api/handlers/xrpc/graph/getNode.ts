/**
 * XRPC handler for pub.chive.graph.getNode.
 *
 * @remarks
 * Retrieves a unified knowledge graph node by AT-URI.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/graph/getNode.js';
import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError, ValidationError } from '../../../../types/errors.js';
import { isAtUri } from '../../../../utils/at-uri.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Convert a value to ISO string, handling both Date objects and strings.
 *
 * Handles dates that have been serialized through JSON (e.g., Redis cache).
 * Returns current time as fallback for invalid/malformed dates to prevent
 * "Invalid date" errors on field pages.
 *
 * @param value - Date object, date string, or undefined
 * @returns ISO 8601 formatted date string
 */
function toISOString(value: Date | string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      return new Date().toISOString();
    }
    return value.toISOString();
  }
  // String value: validate it parses to a valid date
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return value;
}

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
  createdAt: Date | string;
  createdBy?: string;
  updatedAt?: Date | string;
}): OutputSchema {
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
    metadata: node.metadata as OutputSchema['metadata'],
    status: node.status,
    deprecatedBy: node.deprecatedBy,
    proposalUri: node.proposalUri,
    createdAt: toISOString(node.createdAt),
    createdBy: node.createdBy,
    updatedAt: node.updatedAt ? toISOString(node.updatedAt) : undefined,
  };
}

/**
 * XRPC method for pub.chive.graph.getNode query.
 *
 * @public
 */
export const getNode: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { nodeService, edgeService } = c.get('services');
    const logger = c.get('logger');

    // Validate required parameter
    if (!params.id) {
      throw new ValidationError('Missing required parameter: id', 'id');
    }

    logger.debug('Getting node', { id: params.id, includeEdges: params.includeEdges });

    // Support both AT-URI and UUID formats for the id parameter
    // Frontend may pass full AT-URIs, backend stores nodes by UUID
    const node = isAtUri(params.id)
      ? await nodeService.getNode(params.id as AtUri)
      : await nodeService.getNodeById(params.id);

    if (!node) {
      throw new NotFoundError('Node', params.id);
    }

    const response = mapNodeToResponse(node);

    if (params.includeEdges) {
      const edgeResult = await edgeService.listEdges({ sourceUri: node.uri });
      response.edges = edgeResult.edges.map((edge) => ({
        id: edge.id,
        uri: edge.uri,
        cid: edge.cid,
        sourceUri: edge.sourceUri,
        targetUri: edge.targetUri,
        relationUri: edge.relationUri,
        relationSlug: edge.relationSlug,
        // Lexicon expects weight as integer 0-1000 (scaled from 0-1)
        weight: edge.weight !== undefined ? Math.round(edge.weight * 1000) : undefined,
        metadata: edge.metadata
          ? {
              // Lexicon expects confidence as integer 0-1000 (scaled from 0-1)
              confidence:
                edge.metadata.confidence !== undefined
                  ? Math.round(edge.metadata.confidence * 1000)
                  : undefined,
              startDate: edge.metadata.startDate?.toISOString(),
              endDate: edge.metadata.endDate?.toISOString(),
              source: edge.metadata.source,
            }
          : undefined,
        status: edge.status,
        proposalUri: edge.proposalUri,
        createdAt: edge.createdAt.toISOString(),
        createdBy: edge.createdBy,
        updatedAt: edge.updatedAt?.toISOString(),
      }));
    }

    logger.info('Node retrieved', { id: params.id, hasEdges: !!response.edges?.length });

    return { encoding: 'application/json', body: response };
  },
};
