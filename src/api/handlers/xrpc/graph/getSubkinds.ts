/**
 * XRPC handler for pub.chive.graph.getSubkinds.
 *
 * @remarks
 * Lists available subkind type nodes (nodes with subkind=subkind).
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import { z } from 'zod';

import {
  subkindsResponseSchema,
  type SubkindsResponse,
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
 * Handler for pub.chive.graph.getSubkinds query.
 *
 * @param c - Hono context with Chive environment
 * @returns Available subkind type nodes
 *
 * @public
 */
export async function getSubkindsHandler(c: Context<ChiveEnv>): Promise<SubkindsResponse> {
  const { nodeService } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Getting subkinds');

  const subkinds = await nodeService.getSubkinds();

  const response: SubkindsResponse = {
    subkinds: subkinds.map(mapNodeToResponse),
  };

  logger.info('Subkinds retrieved', { count: subkinds.length });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.getSubkinds.
 *
 * @public
 */
export const getSubkindsEndpoint: XRPCEndpoint<Record<string, never>, SubkindsResponse> = {
  method: 'pub.chive.graph.getSubkinds' as never,
  type: 'query',
  description: 'Get available subkind type nodes',
  inputSchema: z.object({}),
  outputSchema: subkindsResponseSchema,
  handler: getSubkindsHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
